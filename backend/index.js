import dotenv from 'dotenv';
dotenv.config();

// Check for obsolete 'worker' argument
if (process.argv.includes('worker')) {
  console.error("❌ The 'worker' argument is deprecated. The application now runs as a single process.");
  console.error("   Please run 'npm start' or 'npm run dev' without any arguments.");
  process.exit(1);
}

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import ip from 'ip';
import db from './db-simple.js';
// Bot will be imported dynamically after acquiring single-instance lock
let bot = null;

import { connection as redis } from './queue-optimized.js';

const lockKey = 'bot_instance_lock';
const instanceId = Math.random().toString(36).substring(2);
let lockAcquired = false;

console.log(`[Redis Lock] Instance ID generated: ${instanceId}`);

async function acquireLock() {
  console.log(`[Redis Lock] Attempting to acquire lock with instance ID: ${instanceId}`);
  const result = await redis.set(lockKey, instanceId, 'EX', 10, 'NX');
  console.log(`[Redis Lock] acquireLock result: ${result}`);
  if (result === 'OK') {
    lockAcquired = true;
    console.log('✅ Acquired bot instance lock.');
    process.env.BOT_INSTANCE_LOCK = 'true';
    return true;
  }
  return false;
}

async function releaseLock() {
  console.log(`[Redis Lock] Attempting to release lock. Current instance ID: ${instanceId}`);
  const currentLockHolder = await redis.get(lockKey);
  console.log(`[Redis Lock] Current lock holder in Redis: ${currentLockHolder}`);
  if (lockAcquired && currentLockHolder === instanceId) {
    const delResult = await redis.del(lockKey);
    console.log(`[Redis Lock] releaseLock result (DEL): ${delResult}`);
    console.log('Released bot instance lock.');
  } else if (lockAcquired && currentLockHolder !== instanceId) {
    console.warn(`[Redis Lock] Not releasing lock: current instance (${instanceId}) is not the lock holder (${currentLockHolder}).`);
  } else {
    console.log(`[Redis Lock] Not releasing lock: lock not acquired by this instance.`);
  }
}

// Periodically refresh the lock
const lockInterval = setInterval(async () => {
  if (lockAcquired) {
    console.log(`[Redis Lock] Refreshing lock for instance ID: ${instanceId}`);
    const expireResult = await redis.expire(lockKey, 10);
    console.log(`[Redis Lock] Lock refresh result (EXPIRE): ${expireResult}`);
  }
}, 8000); // Refresh every 8 seconds, before the 10-second expiry

// Attempt to acquire the lock at startup
(async () => {
  if (!(await acquireLock())) {
    console.log('Another bot instance is already running. This instance will not process Telegram messages.');
  }
})();

// Import routes
import adminRoutes from './routes/admin.js';
import streamerRoutes from './routes/streamer.js';
import paymentRoutes from './routes/payment.js';

import { ttsQueue } from './queue-optimized.js';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

console.log('🚀 Using centralized queue manager with built-in worker and event listeners.');

// --- Middleware ---
app.use(cors({
  origin: (origin, callback) => {
    let allowedOrigin = process.env.FRONTEND_URL || "http://localhost:5173";
    if (allowedOrigin && !allowedOrigin.startsWith("http")) {
      allowedOrigin = `https://${allowedOrigin}`;
    }
    if (!origin || origin === allowedOrigin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Admin-Token"],
}));
app.use(express.json());
app.use('/public', express.static('public'));

// --- API Routes ---
app.use('/api/admin', adminRoutes);
app.use('/api/streamer', streamerRoutes);
app.use('/api/payment', paymentRoutes);

// --- Socket.IO Setup ---
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Expose io to routes and globally
app.set('io', io);
global.socketIO = io;

io.on('connection', (socket) => {
  console.log('⚡ Client connected:', socket.id);
  socket.on('join_streamer_room', (link_uuid) => {
    console.log(`Streamer joined room: ${link_uuid}`);
    socket.join(link_uuid);
  });
  socket.on('join_admin_room', () => {
    console.log('Admin joined room');
    socket.join('admin');
  });
  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
  });
});





// --- Server Start ---
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT} and http://${ip.address()}:${PORT}`);
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) console.log('🔊 TTS: Google Cloud configured');
});

// --- Bot Initialization (Lock-Protected) ---
(async () => {
  if (await acquireLock()) {
    // Only the instance that acquires the lock will initialize the bot
    try {
      console.log('🔑 Lock acquired. Initializing Telegram bot...');
      const mod = await import('../bot/bot.js');
      bot = mod.bot;
    } catch (e) {
      console.error('❌ Failed to initialize Telegram bot:', e?.message || e);
    }
  } else {
    console.log('🔒 Did not acquire lock. This instance will run as an API/worker server only.');
  }
})();

// --- Graceful Shutdown ---
const gracefulShutdown = async (signal) => {
  console.log(`\n[System] Received ${signal}. Starting graceful shutdown...`);

  // 1. Close the worker and wait for it to finish current jobs
  const workerRef = global.ttsWorker;
  if (workerRef && typeof workerRef.close === 'function') {
    try {
      console.log('[Shutdown] Closing BullMQ worker...');
      await workerRef.close();
      console.log('[Shutdown] BullMQ worker closed.');
    } catch (error) {
      console.error('[Shutdown] Error closing BullMQ worker:', error);
    }
  }
  
  // 2. Stop the Telegram bot polling
  if (bot) {
    try {
      console.log('[Shutdown] Stopping Telegram bot polling...');
      await bot.stopPolling();
      console.log('[Shutdown] Telegram bot polling stopped.');
    } catch (error) {
      console.error('[Shutdown] Error stopping bot polling:', error);
    }
  }

  // 3. Close the database connection pool
  // db-simple.js does not have a connection pool to close

  // 4. Close the server
  server.close(async () => {
    console.log('[Shutdown] HTTP server closed.');
    // Release bot instance lock
    await releaseLock();
    clearInterval(lockInterval);
    process.env.BOT_INSTANCE_LOCK = 'false';
    process.exit(0);
  });
};

// Listen for termination signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Special handler for nodemon restarts
process.once('SIGUSR2', async () => {
  await gracefulShutdown('SIGUSR2');
  process.kill(process.pid, 'SIGUSR2'); // Re-trigger the signal for nodemon
});


// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  if (reason && reason.code === 'ETELEGRAM' && reason.message && reason.message.includes('query is too old')) {
    console.log('[Telegram] Callback query timeout (expected behavior):', reason.message);
  } else {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  }
});
