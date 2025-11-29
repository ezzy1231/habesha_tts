import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { ttsJobProcessor } from './worker-processor.js';
import { bot } from './bot.js';

dotenv.config();

// Single Redis connection for all queue operations
const connection = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

if (!process.env.REDIS_URL) {
  console.warn('⚠️ REDIS_URL not set. Queue will not function.');
}

// Create queue
export const ttsQueue = new Queue('tts-generation', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});

// Create worker with same connection
const worker = new Worker('tts-generation', ttsJobProcessor, { connection });

// Set up event listeners
console.log('[Queue] Setting up event listeners for ttsQueue');
console.log('[Queue] Queue instance:', ttsQueue.name);

// Track job lifecycle
ttsQueue.on('waiting', (job) => {
  console.log(`[Queue] Job ${job.id} is waiting`);
});

ttsQueue.on('active', (job) => {
  console.log(`[Queue] Job ${job.id} is active`);
});

// Handle successful job completion
ttsQueue.on('completed', async (job, result) => {
  console.log(`[Queue] Completed handler called for job ${job.id}`);
  try {
    if (!result) {
      console.error(`[Queue] Job ${job.id} completed but returned no result. Aborting handler.`);
      return;
    }
    console.log(`[Queue] Job ${job.id} result:`, JSON.stringify(result, null, 2));

    const { donationData, chatId, newDonorBalance, price } = result;
    console.log(`[Queue] Job ${job.id}: Destructured result successfully.`);

    // Emit real-time event to the streamer dashboard
    if (global.socketIO && donationData.link_uuid) {
      console.log(`[Queue] Job ${job.id}: Emitting socket event to room ${donationData.link_uuid}.`);
      global.socketIO.to(donationData.link_uuid).emit('new_donation', donationData);
      console.log(`[Queue] Job ${job.id}: Socket event emitted.`);
    } else {
      console.warn(`[Queue] Job ${job.id}: Socket.IO or link_uuid not available. Skipping socket event.`);
    }

    // Notify the donor
    console.log(`[Queue] Job ${job.id}: Bot available: ${!!bot}, chatId: ${chatId}`);
    if (bot && chatId) {
      console.log(`[Queue] Job ${job.id}: Sending Telegram confirmation to chatId ${chatId}.`);
      try {
        await bot.sendMessage(chatId, `✅ ክፍያ ተሳክቷል! የ ${price.toFixed(2)} ብር ልገሳዎ ተልኳል።\nአዲስ ቀሪ ሂሳብ: ${newDonorBalance.toFixed(2)} ብር`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '💰 ሌላ ልገሳ ላክ', callback_data: 'quick_donate' }]
            ]
          }
        });
        console.log(`[Queue] Job ${job.id}: Telegram confirmation sent.`);
      } catch (error) {
        console.error(`[Queue] Job ${job.id}: Error sending Telegram message:`, error);
      }
    } else {
      console.warn(`[Queue] Job ${job.id}: Bot or chatId not available. Skipping Telegram message.`);
    }
    console.log(`[Queue] Job ${job.id}: 'completed' handler finished successfully.`);
  } catch (error) {
    console.error(`[Queue] CRITICAL: Error in 'completed' event handler for job ${job.id}:`, error);
  }
});

// Handle failed jobs
ttsQueue.on('failed', async (job, err) => {
  console.log(`[Queue] Failed event triggered for job ${job.id}`);
  try {
    console.error(`[Queue] Job ${job.id} failed with error: ${err.message}`);
    console.log('[Queue] Full error object:', err);
    const { chatId, donationId } = job.data;
    
    if (err.name === 'ContentModerationError') {
      console.log(`[Queue] ContentModerationError identified for job ${job.id}. Notifying user.`);
      // Update donation status in database
      await import('./db-postgres.js').then(db => 
        db.query("UPDATE donations SET status='failed_moderation' WHERE id=$1", [donationId])
      );
      
      if (bot && chatId) {
        try {
          await bot.sendMessage(chatId, '❌ Your message was rejected by content filters and could not be read. You have not been charged.', {
            reply_markup: {
              inline_keyboard: [
                [{ text: '💰 Send New Donation', callback_data: 'quick_donate' }]
              ]
            }
          });
          console.log(`[Queue] Job ${job.id}: Content moderation rejection sent to user.`);
        } catch (error) {
          console.error(`[Queue] Job ${job.id}: Error sending content moderation message:`, error);
        }
      }
    } else {
      console.log(`[Queue] A different error occurred for job ${job.id}. Notifying user.`);
      if (bot && chatId) {
        try {
          await bot.sendMessage(chatId, '❌ An unexpected error occurred while processing your donation. Please try again.');
          console.log(`[Queue] Job ${job.id}: General error message sent to user.`);
        } catch (error) {
          console.error(`[Queue] Job ${job.id}: Error sending general error message:`, error);
        }
      }
    }
  } catch (error) {
    console.error(`[Queue] CRITICAL: Error in 'failed' event handler for job ${job.id}:`, error);
  }
});

// Worker event listeners for debugging
worker.on('completed', (job) => {
  console.log(`[Worker] Worker completed job ${job.id}`);
});

worker.on('failed', (job, err) => {
  console.log(`[Worker] Worker failed job ${job.id} with error:`, err.message);
});

console.log('🔊 TTS Queue and Worker initialized with event listeners.');

// Export connection for reuse if needed
export { connection };