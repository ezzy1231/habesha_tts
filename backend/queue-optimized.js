import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import dotenv from 'dotenv';
// Avoid circular import with bot.js by importing dynamically in handlers
// import { bot } from './bot.js';
import db from './db-postgres.js';
import { generateTTS } from '../bot/utils/tts.js';

dotenv.config();

// Optimized Redis connection with connection pooling
const connection = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  retryDelayOnFailover: 100,
  lazyConnect: true,
  keepAlive: 30000,
  family: 4,
  connectTimeout: 10000,
  // Allow blocking commands (e.g., BRPOP, XREADGROUP) without false timeouts in BullMQ
  commandTimeout: null,
});

if (!process.env.REDIS_URL) {
  console.warn('⚠️ REDIS_URL not set. Queue will not function.');
}

// Optimized queue configuration
export const ttsQueue = new Queue('tts-generation', {
  connection,
  defaultJobOptions: {
    removeOnComplete: 10, // Keep last 10 completed jobs
    removeOnFail: 20,     // Keep last 20 failed jobs
    attempts: 2,           // Retry once on failure
    backoff: {
      type: 'fixed',       // Fixed delay is faster than exponential
      delay: 2000,
    },
  },
});

// Optimized worker with concurrency control
const worker = new Worker('tts-generation', async (job) => {
  const startTime = Date.now();
  console.log(`[Worker] Processing job ${job.id} for donation ${job.data.donationId}. Data: ${JSON.stringify(job.data)}`);
  
  const { donationId, spokenText, engine, voice, stylePrompt, price, tgId, link_uuid, streamer_id, donorName, chatId } = job.data;
  let client;
  
  try {
    client = await db.getClient(); // Acquire client from pool
    console.log(`[Worker] Job ${job.id}: Acquired database client.`);

    // 1. Generate TTS (most time-consuming operation)
    console.log(`[Worker] Job ${job.id}: Generating TTS for donation ${donationId}...`);
    const audioFile = await generateTTS(donationId, spokenText, engine, voice, stylePrompt);
    console.log(`[Worker] Job ${job.id}: TTS generated. Audio file: ${audioFile}`);
    
    // 2. Atomically update donation status and balances
    console.log(`[Worker] Job ${job.id}: Starting database transaction...`);
    await client.query('BEGIN');

    // Update donation status to 'paid' only if it's not already paid
    const updateDonationRes = await client.query(
      "UPDATE donations SET status='paid', amount=$1, audio_file=$2 WHERE id=$3 AND status != 'paid'",
      [price, audioFile, donationId]
    );

    // Only if the donation was successfully marked as 'paid' (meaning it wasn't paid before)...
    if (updateDonationRes.rowCount > 0) {
      console.log(`[Worker] Job ${job.id}: Donation ${donationId} status updated to 'paid'. Proceeding with balance updates.`);
      
      // Atomically update balances
      const [donorResult, streamerResult] = await Promise.all([
        client.query('UPDATE users SET balance = balance - $1 WHERE telegram_id = $2 RETURNING balance', [price, tgId]),
        client.query('UPDATE users SET balance = balance + $1 WHERE telegram_id = $2 RETURNING balance', [price, streamer_id])
      ]);

      const newDonorBalance = Number(donorResult.rows[0]?.balance || 0);
      
      console.log(`[Worker] Job ${job.id}: Balances updated for donor ${tgId} and streamer ${streamer_id}.`);
      
      await client.query('COMMIT');
      console.log(`[Worker] Job ${job.id}: Database transaction committed.`);
      
      const processingTime = Date.now() - startTime;
      console.log(`[Worker] Job ${job.id} completed in ${processingTime}ms`);
      
      // Prepare result data
      const result = {
        donationData: {
          id: donationId,
          donor_name: donorName,
          text: job.data.originalText,
          amount: price,
          audio_url: audioFile,
          status: 'paid',
          created_at: new Date().toISOString(),
          link_uuid: link_uuid,
        },
        chatId,
        newDonorBalance,
        price,
      };
      
      // Handle success immediately
      await handleSuccess(result);
      
      return result;

    } else {
      // If rowCount is 0, the donation was already paid. Commit the transaction and do nothing.
      await client.query('COMMIT');
      console.log(`[Worker] Job ${job.id}: Donation ${donationId} was already processed. No balance changes made. Transaction committed.`);
      // We can consider this a success, as the state is correct.
      // We might not need to send a notification again, but for simplicity, we'll skip it.
      return { message: "Donation already processed." };
    }
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`[Worker] Job ${job.id} failed after ${processingTime}ms:`, error);
    console.error(`[Worker] Job ${job.id}: Error details:`, error.message, error.stack);

    // Best-effort rollback in case a transaction was started
    try {
      if (client) {
        await client.query('ROLLBACK');
        console.log(`[Worker] Job ${job.id}: Database transaction rolled back.`);
      }
    } catch (rbErr) {
      console.warn(`[Worker] Job ${job.id}: Error during rollback (might be no active transaction):`, rbErr.message);
    }
    
    // Handle failure immediately
    await handleFailure(job, error);
    
    // Update donation status for failed moderation
    if (error.name === 'ContentModerationError') {
      try {
        if (client) {
          await client.query("UPDATE donations SET status='failed_moderation' WHERE id=$1", [donationId]);
          console.log(`[Worker] Job ${job.id}: Donation ${donationId} status updated to 'failed_moderation'.`);
        }
      } catch (dbError) {
        console.error(`[Worker] Job ${job.id}: Failed to update donation status to 'failed_moderation':`, dbError);
      }
      // Only re-throw for retry on the first attempt
      if (job.attemptsMade < job.opts.attempts) {
        throw error; // Re-throw to trigger a retry
      }
    } else {
      // For other errors, always re-throw to mark the job as failed
      throw error;
    }
  } finally {
    if (client) {
      client.release(); // Release client back to the pool
      console.log(`[Worker] Job ${job.id}: Released database client.`);
    }
  }
}, { 
  connection,
  concurrency: 3, // Process up to 3 jobs concurrently
  limiter: {
    max: 10, // Max 10 jobs per 10 seconds
    duration: 10000,
  }
});

// Optimized success handler
async function handleSuccess(result) {
  const { donationData, chatId, newDonorBalance, price } = result;
  
  try {
    // Parallel: socket emission + telegram message
    const promises = [];
    
    // Socket emission (non-blocking, emit is synchronous)
    if (global.socketIO) {
      try {
        if (donationData.link_uuid) {
          global.socketIO.to(donationData.link_uuid).emit('new_donation', donationData);
        }
        // Also notify admin room so the Admin panel updates in real-time
        global.socketIO.to('admin').emit('new_donation', donationData);
      } catch (err) {
        console.error('[Worker] Socket emit error:', err);
      }
    }
    
    // Telegram message (blocking but fast)
    const { bot } = await import('../bot/bot.js');
    console.log(`[Worker] Success handler: bot available=${!!bot}, chatId=${chatId}`);
    if (bot && chatId) {
      promises.push(
        bot.sendMessage(chatId, 
          `✅ Payment successful! Your donation of Br ${price.toFixed(2)} has been sent.\nNew balance: Br ${newDonorBalance.toFixed(2)}`, 
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '💰 Send Another Donation', callback_data: 'quick_donate' }]
              ]
            }
          }
        )
        .then(() => console.log(`[Worker] Success handler: Telegram confirmation sent to ${chatId}`))
        .catch(err => console.error('[Worker] Telegram send error (success path):', err?.response?.body || err?.message || err))
      );
    } else {
      console.warn(`[Worker] Success handler: Skipping Telegram confirmation (bot or chatId missing).`);
    }
    
    // Wait for all operations to complete
    await Promise.allSettled(promises);
    console.log(`[Worker] Success notifications sent for donation ${donationData.id}`);
    
  } catch (error) {
    console.error('[Worker] Error in success handler:', error);
  }
}

// Optimized failure handler
async function handleFailure(job, error) {
  // Notify donor only on the final attempt to avoid duplicate failure messages
  const attempts = job?.opts?.attempts || 1;
  const isFinalAttempt = (job?.attemptsMade + 1) >= attempts;
  if (!isFinalAttempt) {
    console.warn(`[Worker] Failure handler: intermediate failure (attempt ${job?.attemptsMade + 1}/${attempts}) — skipping donor notification.`);
    return;
  }
  const { chatId, donationId } = job.data;
  
  try {
    const { bot } = await import('../bot/bot.js');
    console.log(`[Worker] Failure handler: bot available=${!!bot}, chatId=${chatId}, donationId=${donationId}`);
    if (!bot || !chatId) return;
    
    let message;
    if (error.name === 'ContentModerationError') {
      message = '❌ Your message was rejected by content filters and could not be read. You have not been charged.';
    } else {
      message = '❌ An unexpected error occurred while processing your donation. You have not been charged. Please try again.';
    }
    
    await bot.sendMessage(chatId, message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💰 Send New Donation', callback_data: 'quick_donate' }]
        ]
      }
    })
    .then(() => console.log(`[Worker] Failure handler: Telegram failure notice sent to ${chatId} for donation ${donationId}`))
    .catch(err => console.error('[Worker] Telegram send error (failure path):', err?.response?.body || err?.message || err));
    
    console.log(`[Worker] Failure notification sent for donation ${donationId}`);
    
  } catch (error) {
    console.error('[Worker] Error in failure handler:', error);
  }
}

// Worker event monitoring (minimal)
worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  console.log(`[Worker] Job ${job.id} failed: ${err.message}`);
});

console.log('🚀 Optimized TTS Queue and Worker initialized');

// Expose worker globally for graceful shutdown
if (typeof global !== 'undefined') {
  global.ttsWorker = worker;
}

// Export connection for reuse
export { connection };