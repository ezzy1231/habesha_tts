import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { ttsJobProcessor } from './worker-processor.js';
import { bot } from './bot.js';
import db from './db-postgres.js';

dotenv.config();

// Single Redis connection
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

// Create worker with direct event handling
const worker = new Worker('tts-generation', async (job) => {
  console.log(`[Worker] Processing job ${job.id} for donation ${job.data.donationId}`);
  
  try {
    // Process the job using the existing processor
    const result = await ttsJobProcessor(job);
    
    // Handle success directly in worker
    console.log(`[Worker] Job ${job.id} completed successfully, sending confirmation...`);
    await handleJobSuccess(job, result);
    
    return result;
  } catch (error) {
    console.error(`[Worker] Job ${job.id} failed:`, error);
    
    // Handle failure directly in worker
    await handleJobFailure(job, error);
    
    throw error; // Re-throw to mark job as failed
  }
}, { connection });

// Handle successful job completion
async function handleJobSuccess(job, result) {
  try {
    const { donationData, chatId, newDonorBalance, price } = result;
    
    // Emit real-time event to streamer dashboard
    if (global.socketIO && donationData.link_uuid) {
      console.log(`[Worker] Emitting socket event to room ${donationData.link_uuid}`);
      global.socketIO.to(donationData.link_uuid).emit('new_donation', donationData);
    }

    // Notify the donor
    if (bot && chatId) {
      console.log(`[Worker] Sending Telegram confirmation to chatId ${chatId}`);
      await bot.sendMessage(chatId, `✅ ክፍያ ተሳክቷል! የ ${price.toFixed(2)} ብር ልገሳዎ ተልኳል።\nአዲስ ቀሪ ሂሳብ: ${newDonorBalance.toFixed(2)} ብር`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '💰 ሌላ ልገሳ ላክ', callback_data: 'quick_donate' }]
          ]
        }
      });
      console.log(`[Worker] Telegram confirmation sent for job ${job.id}`);
    }
  } catch (error) {
    console.error(`[Worker] Error in success handler for job ${job.id}:`, error);
  }
}

// Handle job failure
async function handleJobFailure(job, error) {
  try {
    const { chatId, donationId } = job.data;
    
    if (error.name === 'ContentModerationError') {
      console.log(`[Worker] ContentModerationError for job ${job.id}, updating database...`);
      // Update donation status
      await db.query("UPDATE donations SET status='failed_moderation' WHERE id=$1", [donationId]);
      
      if (bot && chatId) {
        await bot.sendMessage(chatId, '❌ Your message was rejected by content filters and could not be read. You have not been charged.', {
          reply_markup: {
            inline_keyboard: [
              [{ text: '💰 Send New Donation', callback_data: 'quick_donate' }]
            ]
          }
        });
        console.log(`[Worker] Content moderation rejection sent for job ${job.id}`);
      }
    } else {
      console.log(`[Worker] General error for job ${job.id}, notifying user...`);
      if (bot && chatId) {
        await bot.sendMessage(chatId, '❌ An unexpected error occurred while processing your donation. Please try again.');
        console.log(`[Worker] General error message sent for job ${job.id}`);
      }
    }
  } catch (handlerError) {
    console.error(`[Worker] Error in failure handler for job ${job.id}:`, handlerError);
  }
}

console.log('🔊 TTS Queue and Worker initialized with direct event handling.');

// Export connection for reuse if needed
export { connection };