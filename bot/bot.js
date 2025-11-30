import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import db from "../backend/db-postgres.js";
import { ttsQueue } from '../backend/queue-optimized.js';
import { emitAdminEvent } from "../backend/utils/adminNotifications.js";
import { registerCommands } from "./handlers/commands.js";
import { registerCallbacks } from "./handlers/callbacks.js";
import { registerMessageFlows } from "./handlers/messages.js";
import { createStateStore } from "./stateStore.js";

dotenv.config();

// --- Bot Singleton Initialization ---
const bot = (() => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("[Telegram] TELEGRAM_BOT_TOKEN not set. Bot will not start.");
    return null;
  }
  
  // Use polling only in development; Production uses Webhooks
  const usePolling = process.env.NODE_ENV !== 'production';
  
  const botInstance = new TelegramBot(token, { polling: usePolling });
  
  if (usePolling) {
    botInstance.on("polling_error", (err) => console.error("[Telegram] Polling Error:", err?.response?.body || err.message));
  }
  botInstance.on("webhook_error", (err) => console.error("[Telegram] Webhook Error:", err?.response?.body || err.message));
  
  console.log(`📱 Telegram Bot initialized. Mode: ${usePolling ? 'Polling (Dev)' : 'Webhook (Prod)'}`);
  return botInstance;
})();

// --- Settings Management ---
let settingsCache = null;
async function loadSettings() {
  try {
    const res = await db.query("SELECT key, value FROM settings");
    const loadedSettings = res.rows.reduce((acc, row) => {
      try {
        if (row.key === 'filteredWords') {
          acc[row.key] = JSON.parse(row.value);
        } else if (['maxChars', 'stepChars', 'basePrice', 'incrementPrice'].includes(row.key)) {
          acc[row.key] = Number(row.value);
        } else {
          acc[row.key] = row.value;
        }
      } catch (parseError) {
        console.warn(`[Bot Settings] Could not parse setting '${row.key}':`, parseError.message);
        acc[row.key] = row.value; // Keep as string if parsing fails
      }
      return acc;
    }, {});

    // Ensure filteredWords is always an array and normalize entries for reliable matching
    let normalizedFiltered = [];
    try {
      const arr = Array.isArray(loadedSettings.filteredWords) ? loadedSettings.filteredWords : [];
      normalizedFiltered = Array.from(new Set(
        arr
          .map(s => String(s))
          .map(s => s.normalize('NFC').trim().toLowerCase())
          .filter(s => s.length > 0)
      ));
    } catch {}

    settingsCache = {
      maxChars: 600,
      stepChars: 30,
      basePrice: 20,
      incrementPrice: 10,
      ...loadedSettings,
      filteredWords: normalizedFiltered,
    };
    console.log("🔄 Bot settings loaded/reloaded.", settingsCache);
  } catch (error) {
    console.error("Error loading settings for bot:", error);
    settingsCache = { maxChars: 600, stepChars: 30, basePrice: 20, incrementPrice: 10, filteredWords: [] };
  }
}
loadSettings();
async function getSettings() {
  if (!settingsCache) await loadSettings();
  return settingsCache;
}
async function reloadSettings() {
  await loadSettings();
}

// --- Helper Functions ---
const safeAnswerCallback = async (queryId, options = {}) => {
  try {
    await bot.answerCallbackQuery(queryId, options);
  } catch (error) {
    if (error.code === 'ETELEGRAM' && error.message.includes('query is too old')) {
      // This is expected behavior for old queries, ignore silently
    } else {
      console.error('[Telegram] Error answering callback query:', error.message);
    }
  }
};

// --- State Stores (Redis-backed with in-memory fallback) ---
const userStates = createStateStore({
  namespace: 'bot:user-state',
  defaultTtlSeconds: Number(process.env.BOT_USER_STATE_TTL_SECONDS ?? 60 * 30),
});

const pendingDonations = createStateStore({
  namespace: 'bot:pending-donation',
  defaultTtlSeconds: Number(process.env.BOT_PENDING_DONATION_TTL_SECONDS ?? 60 * 15),
});

// --- DB Helpers ---
async function getUserByTelegramId(id) {
  const res = await db.query("SELECT * FROM users WHERE telegram_id = $1", [id]);
  return res.rows[0] || null;
}

if (bot) {

  registerCommands(bot, {
    db,
    getUserByTelegramId,
    userStates,
    pendingDonations,
  });

  registerMessageFlows(bot, {
    db,
    getUserByTelegramId,
    userStates,
    pendingDonations,
    getSettings,
    emitAdminEvent,
  });

  registerCallbacks(bot, {
    db,
    getUserByTelegramId,
    userStates,
    pendingDonations,
    safeAnswerCallback,
    ttsQueue,
  });

}

export { bot, reloadSettings };
