import axios from 'axios';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_BASE = TELEGRAM_BOT_TOKEN
  ? `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`
  : null;

function logAlertWarning(message) {
  console.warn(`[TelegramAlert] ${message}`);
}

export async function sendTelegramAlert(chatId, text, options = {}) {
  if (!TELEGRAM_API_BASE) {
    logAlertWarning('TELEGRAM_BOT_TOKEN missing. Cannot deliver alert.');
    return;
  }

  if (!chatId || !text) {
    logAlertWarning('Missing chatId or text when attempting to send alert.');
    return;
  }

  const payload = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...options,
  };

  try {
    await axios.post(`${TELEGRAM_API_BASE}/sendMessage`, payload);
  } catch (error) {
    const description = error?.response?.data?.description;
    console.error(
      `[TelegramAlert] Failed to send alert to ${chatId}:`,
      description || error?.message || error
    );
  }
}
