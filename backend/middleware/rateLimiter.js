import rateLimit from 'express-rate-limit';

const isDev = (process.env.NODE_ENV || 'development') === 'development';

function keyByTelegramId(req) {
  // Prefer explicit body field
  const tid = req.body?.telegram_user_id || req.body?.telegram_id || req.query?.telegram_user_id || req.query?.telegram_id;
  return String(tid || req.ip || 'unknown');
}

export const otpRequestLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: isDev ? 1000 : 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${keyByTelegramId(req)}|${req.ip}`,
  message: { error: 'Too many OTP requests. Please try again in 5 minutes.' },
});

export const otpVerifyLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isDev ? 1000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${keyByTelegramId(req)}|${req.ip}`,
  message: { error: 'Too many verification attempts. Please try again later.' },
});

export const dashboardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 5000 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'GET' || (req.user && req.user.role === 'admin'),
  keyGenerator: (req) => String(req.streamerId || req.ip || 'anon'),
  message: { error: 'Too many requests from this account.' },
});
