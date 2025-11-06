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
import db from './db-postgres.js';
// Bot will be imported dynamically after acquiring single-instance lock
let bot = null;

// Prevent multiple bot instances across processes using a pid file
import fs from 'fs';
import path from 'path';

const lockFile = path.resolve('.bot_instance.lock');
try {
  if (fs.existsSync(lockFile)) {
    // Check if the PID in the lock file is still running
    const oldPidStr = fs.readFileSync(lockFile, 'utf8').trim();
    const oldPid = Number(oldPidStr);
    let isRunning = false;
    if (!Number.isNaN(oldPid)) {
      try {
        process.kill(oldPid, 0); // Does not actually kill; checks existence
        isRunning = true;
      } catch (e) {
        // ESRCH means process does not exist; other errors we treat as running to be safe
        if (e.code === 'ESRCH') {
          isRunning = false;
        } else {
          isRunning = true;
        }
      }
    }

    if (isRunning) {
      console.error('❌ Another bot instance is already running (lock file present). Please stop it first.');
      process.exit(1);
    } else {
      console.warn('⚠️ Stale bot lock detected. Removing and continuing.');
      try { fs.unlinkSync(lockFile); } catch (e) {}
    }
  }
  fs.writeFileSync(lockFile, String(process.pid));
  process.env.BOT_INSTANCE_LOCK = 'true';
} catch (e) {
  console.error('❌ Failed to create bot instance lock:', e);
  process.exit(1);
}

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
app.use(cors());
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
server.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Server running on http://localhost:${PORT} and http://${ip.address()}:${PORT}`);
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) console.log('🔊 TTS: Google Cloud configured');
  // Dynamically import bot after server and lock are ready
  try {
    const mod = await import('../bot/bot.js');
    bot = mod.bot;
  } catch (e) {
    console.error('❌ Failed to initialize Telegram bot:', e?.message || e);
  }
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Please stop the other process or change the PORT in .env`);
    process.exit(1);
  } else {
    console.error('❌ Server error:', err);
    process.exit(1);
  }
});

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
  try {
    console.log('[Shutdown] Closing database connection pool...');
    await db.end();
    console.log('[Shutdown] Database connection pool closed.');
  } catch (error) {
    console.error('[Shutdown] Error closing database pool:', error.message);
  }

  // 4. Close the server
  server.close(() => {
    console.log('[Shutdown] HTTP server closed.');
    // Release bot instance lock and remove pid file
    try {
      if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
    } catch (e) {
      console.error('[Shutdown] Failed to remove lock file:', e);
    }
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
