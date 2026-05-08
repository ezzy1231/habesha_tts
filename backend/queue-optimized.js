import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import dotenv from 'dotenv';
// Avoid circular import with bot.js by importing dynamically in handlers
// import { bot } from './bot.js';
import db from './db-postgres.js';
import { generateTTS } from '../bot/utils/tts.js';

dotenv.config();

const CLOUD_QUEUE_NAME = 'tts-generation';
const GEMINI_QUEUE_NAME = 'gemini-tts-generation';
const CLOUD_CONCURRENCY = Number(process.env.TTS_WORKER_CONCURRENCY || 10);
const CLOUD_RATE_LIMIT_MAX = Number(process.env.TTS_QUEUE_RATE_LIMIT_MAX || 30);
const CLOUD_RATE_LIMIT_DURATION_MS = Number(process.env.TTS_QUEUE_RATE_LIMIT_DURATION_MS || 10000);
const GEMINI_CONCURRENCY = Number(process.env.GEMINI_TTS_WORKER_CONCURRENCY || 1);
const GEMINI_RATE_LIMIT_MAX = Number(process.env.GEMINI_TTS_RATE_LIMIT_MAX || 4);
const GEMINI_RATE_LIMIT_DURATION_MS = Number(process.env.GEMINI_TTS_RATE_LIMIT_DURATION_MS || 60000);

const shouldUseTls = (url) => {
  if (!url) return false;
  const lowered = String(url).toLowerCase();
  if (lowered.startsWith('rediss://')) return true;
  return lowered.includes('.upstash.io');
};

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
  ...(shouldUseTls(process.env.REDIS_URL) ? { tls: {} } : {}),
});

if (!process.env.REDIS_URL) {
  console.warn('⚠️ REDIS_URL not set. Queue will not function.');
}

// Optimized queue configuration
export const ttsQueue = new Queue(CLOUD_QUEUE_NAME, {
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

export const geminiTtsQueue = new Queue(GEMINI_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 20,
    attempts: 1,
  },
});

export function enqueueTTSJob(jobName, payload, options = {}) {
  const queue = payload?.engine === 'gemini' ? geminiTtsQueue : ttsQueue;
  return queue.add(jobName, payload, options);
}

function isGeminiQuotaError(error) {
  const details = `${error?.message || ''} ${error?.details || ''}`;
  return error?.code === 8 && /Quota exceeded|RESOURCE_EXHAUSTED|aiplatform\.googleapis\.com\/global_generate_content_requests_per_minute_per_project_per_base_model/i.test(details);
}

async function updateDonationStatus(donationId, status) {
  try {
    await db.query('UPDATE donations SET status=$1 WHERE id=$2', [status, donationId]);
  } catch (error) {
    console.error(`[Worker] Failed to update donation ${donationId} to status "${status}":`, error);
  }
}

async function processTTSJob(job) {
  const startTime = Date.now();
  console.log(`[Worker:${job.queueName}] Processing job ${job.id} for donation ${job.data.donationId}. Data: ${JSON.stringify(job.data)}`);
  
  const { donationId, spokenText, engine, voice, stylePrompt, price, tgId, link_uuid, streamer_id, donorName, chatId } = job.data;
  let client;
  
  try {
    // Generate TTS before acquiring a DB client so slow syntheses do not starve the pool.
    console.log(`[Worker:${job.queueName}] Job ${job.id}: Generating TTS for donation ${donationId}...`);
    const audioFile = await generateTTS(donationId, spokenText, engine, voice, stylePrompt);
    console.log(`[Worker:${job.queueName}] Job ${job.id}: TTS generated. Audio file: ${audioFile}`);

    client = await db.getClient();
    console.log(`[Worker:${job.queueName}] Job ${job.id}: Acquired database client.`);
    
    // 2. Atomically update donation status and balances
    console.log(`[Worker:${job.queueName}] Job ${job.id}: Starting database transaction...`);
    await client.query('BEGIN');

    // Update donation status to 'paid' only if it's not already paid
    const updateDonationRes = await client.query(
      "UPDATE donations SET status='paid', amount=$1, audio_file=$2 WHERE id=$3 AND status != 'paid'",
      [price, audioFile, donationId]
    );

    // Only if the donation was successfully marked as 'paid' (meaning it wasn't paid before)...
    if (updateDonationRes.rowCount > 0) {
      console.log(`[Worker:${job.queueName}] Job ${job.id}: Donation ${donationId} status updated to 'paid'. Proceeding with balance updates.`);
      
      // Atomically update balances
      const [donorResult, streamerResult] = await Promise.all([
        client.query('UPDATE users SET balance = balance - $1 WHERE telegram_id = $2 RETURNING balance', [price, tgId]),
        client.query('UPDATE users SET balance = balance + $1 WHERE telegram_id = $2 RETURNING balance', [price, streamer_id])
      ]);

      const newDonorBalance = Number(donorResult.rows[0]?.balance || 0);
      
  console.log(`[Worker:${job.queueName}] Job ${job.id}: Balances updated for donor ${tgId} and streamer ${streamer_id}.`);
      
      await client.query('COMMIT');
  console.log(`[Worker:${job.queueName}] Job ${job.id}: Database transaction committed.`);
      
      const processingTime = Date.now() - startTime;
  console.log(`[Worker:${job.queueName}] Job ${job.id} completed in ${processingTime}ms`);
      
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
      console.log(`[Worker:${job.queueName}] Job ${job.id}: Donation ${donationId} was already processed. No balance changes made. Transaction committed.`);
      // We can consider this a success, as the state is correct.
      // We might not need to send a notification again, but for simplicity, we'll skip it.
      return { message: "Donation already processed." };
    }
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`[Worker:${job.queueName}] Job ${job.id} failed after ${processingTime}ms:`, error);
    console.error(`[Worker:${job.queueName}] Job ${job.id}: Error details:`, error.message, error.stack);

    // Best-effort rollback in case a transaction was started
    try {
      if (client) {
        await client.query('ROLLBACK');
        console.log(`[Worker:${job.queueName}] Job ${job.id}: Database transaction rolled back.`);
      }
    } catch (rbErr) {
      console.warn(`[Worker:${job.queueName}] Job ${job.id}: Error during rollback (might be no active transaction):`, rbErr.message);
    }
    
    if (error.name === 'ContentModerationError') {
      // Moderation failures are deterministic — don't retry, just update the DB and
      // notify the user directly (bypassing handleFailure's isFinalAttempt guard,
      // which would skip the notification on attempt 1 if we returned without retrying).
      await updateDonationStatus(donationId, 'failed_moderation');
      console.log(`[Worker:${job.queueName}] Job ${job.id}: Donation ${donationId} status updated to 'failed_moderation'.`);
      try {
        const { bot } = await import('../bot/bot.js');
        if (bot && chatId) {
          await bot.sendMessage(chatId,
            '❌ Your message was rejected by content filters and could not be read. You have not been charged.',
            { reply_markup: { inline_keyboard: [[{ text: '💰 ሌላ ልገሳ ላክ', callback_data: 'quick_donate' }]] } }
          );
          console.log(`[Worker] Job ${job.id}: Moderation rejection notice sent to ${chatId}.`);
        }
      } catch (notifyErr) {
        console.error(`[Worker] Job ${job.id}: Failed to send moderation rejection notice:`, notifyErr?.message || notifyErr);
      }
      return { message: 'Donation rejected by moderation.' };
    }

    if (isGeminiQuotaError(error)) {
      await updateDonationStatus(donationId, 'failed_quota');
      console.warn(`[Worker:${job.queueName}] Job ${job.id}: Gemini quota exhausted for donation ${donationId}.`);
    }

    // For all other errors let BullMQ retry (up to `attempts` times).
    // handleFailure is called here so it can notify the user on the final attempt.
    await handleFailure(job, error);
    throw error;
  } finally {
    if (client) {
      client.release(); // Release client back to the pool
      console.log(`[Worker:${job.queueName}] Job ${job.id}: Released database client.`);
    }
  }
}

const worker = new Worker(CLOUD_QUEUE_NAME, processTTSJob, { 
  connection,
  concurrency: CLOUD_CONCURRENCY,
  limiter: {
    max: CLOUD_RATE_LIMIT_MAX,
    duration: CLOUD_RATE_LIMIT_DURATION_MS,
  },
  // Reduce Redis polling to save Upstash request quota
  stalledInterval: 60000,   // Check stalled jobs every 60s (default: 30s)
  maxStalledCount: 2,
  drainDelay: 5,
});

const geminiWorker = new Worker(GEMINI_QUEUE_NAME, processTTSJob, {
  connection,
  concurrency: GEMINI_CONCURRENCY,
  limiter: {
    max: GEMINI_RATE_LIMIT_MAX,
    duration: GEMINI_RATE_LIMIT_DURATION_MS,
  },
  stalledInterval: 60000,
  maxStalledCount: 2,
  drainDelay: 5,
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
          `✅ ክፍያ ተሳክቷል! የ ${price.toFixed(2)} ብር ልገሳዎ ተልኳል።\nአዲስ ቀሪ ሂሳብ: ${newDonorBalance.toFixed(2)} ብር`, 
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '💰 ሌላ ልገሳ ላክ', callback_data: 'quick_donate' }]
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
    } else if (isGeminiQuotaError(error)) {
      message = '⏳ The Gemini voice queue is currently full due to provider quota. You have not been charged. Please try again shortly or use a standard voice.';
    } else {
      message = '❌ An unexpected error occurred while processing your donation. You have not been charged. Please try again.';
    }
    
    await bot.sendMessage(chatId, message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💰 ሌላ ልገሳ ላክ', callback_data: 'quick_donate' }]
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

function attachWorkerLogging(workerInstance, label) {
  workerInstance.on('completed', (job) => {
    console.log(`[Worker:${label}] Job ${job.id} completed successfully`);
  });

  workerInstance.on('failed', (job, err) => {
    console.log(`[Worker:${label}] Job ${job?.id} failed: ${err.message}`);
  });
}

attachWorkerLogging(worker, 'cloud');
attachWorkerLogging(geminiWorker, 'gemini');

console.log('🚀 Optimized TTS Queue and Worker initialized');

// Expose worker globally for graceful shutdown
if (typeof global !== 'undefined') {
  global.ttsWorker = worker;
  global.geminiTtsWorker = geminiWorker;
}

// Export connection for reuse
export { connection };