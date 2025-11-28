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
import streamerAuthRoutes from './routes/streamerAuth.js';

import { ttsQueue } from './queue-optimized.js';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// --- Allowed Origins (Dev + Prod) ---
const normalizeOrigin = (value) => {
  if (!value) return null;
  let trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  // Remove trailing slash for consistent comparisons
  return trimmed.replace(/\/$/, '');
};

const localIp = ip.address();
const configuredOrigins = new Set();

const rawOriginEnvValues = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_URLS,
  process.env.ALLOWED_ORIGINS,
];

rawOriginEnvValues.forEach((entry) => {
  if (!entry) return;
  entry.split(',').forEach((chunk) => {
    const normalized = normalizeOrigin(chunk);
    if (normalized) configuredOrigins.add(normalized);
  });
});

// Ensure primary production domain stays allowed even if env vars misconfigured
['https://habeshatts.com'].forEach((origin) => {
  const normalized = normalizeOrigin(origin);
  if (normalized) configuredOrigins.add(normalized);
});

// Backwards compatibility: default frontend when nothing configured
if (configuredOrigins.size === 0) {
  configuredOrigins.add('http://localhost:5173');
}
const devOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  `http://${localIp}:5173`,
  'http://localhost:3000',
]);
const allowedOriginsSet = new Set([...configuredOrigins, ...devOrigins]);
const isDevEnv = (process.env.NODE_ENV || 'development') !== 'production';

console.log('🚀 Using centralized queue manager with built-in worker and event listeners.');

// --- Middleware ---
app.use(cors({
  origin: (origin, callback) => {
    // Allow same-origin (no Origin header) and explicit allowed origins
    if (!origin) return callback(null, true);
    const normalizedOrigin = normalizeOrigin(origin);
    if (allowedOriginsSet.has(normalizedOrigin)) return callback(null, true);
    // In dev, allow local network hosts (e.g., 192.168.x.x:5173, 10.x.x.x:5173)
    if (isDevEnv && /^http:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+):\d+$/.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Admin-Token"],
  credentials: true,
}));
app.use(express.json());
app.use('/public', express.static('public'));

// --- API Routes ---
app.use('/api/v1/streamer', streamerAuthRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/streamer', streamerRoutes);
app.use('/api/payment', paymentRoutes);

// --- Health Check Endpoint ---
app.get('/health', async (req, res) => {
  try {
    // Check Redis connection
    let redisStatus = 'disconnected';
    try {
      await redis.ping();
      redisStatus = 'connected';
    } catch (e) {
      console.error('Health check - Redis ping failed:', e.message);
    }

    // Check database connection
    let dbStatus = 'disconnected';
    try {
      await db.get('SELECT 1');
      dbStatus = 'connected';
    } catch (e) {
      console.error('Health check - DB query failed:', e.message);
    }

    // Check bot status
    const botStatus = lockAcquired ? 'active' : 'inactive';

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        redis: redisStatus,
        database: dbStatus,
        bot: botStatus,
      },
      environment: process.env.NODE_ENV || 'development',
    };

    // Return 503 if critical services are down
    if (redisStatus === 'disconnected' || dbStatus === 'disconnected') {
      return res.status(503).json({ ...health, status: 'unhealthy' });
    }

    res.status(200).json(health);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// --- Socket.IO Setup ---
const io = new Server(server, {
  cors: {
    // Allow the same set as HTTP above
    origin: Array.from(allowedOriginsSet),
    methods: ["GET", "POST"],
    credentials: true,
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
