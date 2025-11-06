import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { generateTTS } from './utils/tts.js';
import db from './db-postgres.js';
import { bot } from './bot.js';

dotenv.config();

const connection = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null, // Important for BullMQ
});

if (!process.env.REDIS_URL) {
  console.warn('⚠️ REDIS_URL not set. Queue will not function.');
}

// Create a new queue
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

// Export the connection for reuse
export { connection };

console.log('🔊 TTS Queue initialized.');
