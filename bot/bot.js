import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import db from "../backend/db-postgres.js";
import { generateStreamerLink } from "../backend/utils/generateLink.js";
import { ttsQueue } from '../backend/queue-optimized.js';
import crypto from 'crypto';

dotenv.config();

// --- Bot Singleton Initialization ---
const bot = (() => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("[Telegram] TELEGRAM_BOT_TOKEN not set. Bot will not start.");
    return null;
  }
  const botInstance = new TelegramBot(token, { polling: true });
  botInstance.on("polling_error", (err) => console.error("[Telegram] Polling Error:", err?.response?.body || err.message));
  botInstance.on("webhook_error", (err) => console.error("[Telegram] Webhook Error:", err?.response?.body || err.message));
  
  
  console.log('📱 Telegram Bot singleton initialized.');
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

// --- In-memory Stores ---
const pendingDonations = new Map();
const userStates = new Map();

// --- DB Helpers ---
async function getUserByTelegramId(id) {
  const res = await db.query("SELECT * FROM users WHERE telegram_id = $1", [id]);
  return res.rows[0] || null;
}

// --- Bot Event Handlers ---
if (bot) {

  //================================================================================
  // TEXT-BASED COMMANDS (/start, /donate, etc.)
  //================================================================================

  bot.onText(/\/start/, async (msg) => {
    const { chat: { id: chatId }, from: { id: fromId, first_name } } = msg;
    const tgId = String(fromId);
    userStates.delete(tgId); // Clear any previous state
    const user = await getUserByTelegramId(tgId);
    if (user) {
      bot.sendMessage(chatId, `👋 እንኳን ደህና መጡ ${first_name}! እንደ ${user.role} ተመዝግበዋል።`);
    } else {
      bot.sendMessage(chatId, "👋 እንኳን ደህና መጡ! እባክዎ ሚናዎን ይምረጡ:", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🎥 እንደ Streamer ይመዝገቡ", callback_data: "register_streamer" }],
            [{ text: "💰 እንደ Doner ይመዝገቡ", callback_data: "register_donor" }]
          ]
        }
      });
    }
  });

  bot.onText(/\/donate/, async (msg) => {
    const tgId = String(msg.from.id);
    const user = await getUserByTelegramId(tgId);
    if (!user || user.role !== "donor") {
      bot.sendMessage(msg.chat.id, "❌ መጀመሪያ እንደ ለጋሽ መመዝገብ አለብዎት።");
      return;
    }
    const streamers = (await db.query("SELECT telegram_id, username, full_name FROM users WHERE role = 'streamer' AND registration_status = 'approved' ORDER BY streamer_order ASC")).rows;
    if (streamers.length === 0) {
      bot.sendMessage(msg.chat.id, "⚠️ እስካሁን ምንም Streamer የለም።");
      return;
    }
    const buttons = streamers.map(s => ([{ text: s.full_name || s.username, callback_data: `choose_streamer_${s.telegram_id}` }]));
    bot.sendMessage(msg.chat.id, "ልገሳ ለመላክ Streamer ይምረጡ:", { reply_markup: { inline_keyboard: buttons } });
  });

  bot.onText(/\/balance/, async (msg) => {
    const tgId = String(msg.from.id);
    const user = await getUserByTelegramId(tgId);
    if (!user || user.role !== 'donor') return;
    bot.sendMessage(msg.chat.id, `💼 የ Wallet ቀሪ ሂሳብ: ${Number(user.balance || 0).toFixed(2)} ብር`);
  });

bot.onText(/\/reset/, async (msg) => {
    const tgId = String(msg.from.id);
    const chatId = msg.chat.id;
    
    try {
      // Clear any pending flow state and pending donation for this user
      userStates.delete(tgId);
      pendingDonations.delete(tgId);
      
      // Clear user registration from database
      await db.query("DELETE FROM users WHERE telegram_id = $1", [tgId]);
      
      bot.sendMessage(chatId, '🔄 ስብስ ነጻ ተደርጓል። እንደገና ይመዝገቡ። /start ይጫኑ');
    } catch (error) {
      console.error('Error during reset:', error);
      bot.sendMessage(chatId, '❌ ስብስ ማጥፋት አልተቻለም። እንደገና ይሞክሩ።');
    }
  });

  bot.onText(/\/recharge/, async (msg) => {
    const tgId = String(msg.from.id);
    const user = await getUserByTelegramId(tgId);
    if (!user || user.role !== 'donor') {
      userStates.set(tgId, { step: 'await_registration', after_registration: 'recharge' });
      bot.sendMessage(msg.chat.id, '❌ መጀመሪያ እንደ ለጋሽ መመዝገብ አለብዎት። /start ይጫኑ እና "እንደ ለጋሽ ይመዝገቡ" ይምረጡ።');
      return;
    }
    userStates.set(tgId, { step: 'recharge_name' });
    bot.sendMessage(msg.chat.id, '💳 የቴሌብር መሙያ: ቢያንስ 100 ብር ወደ 251-939976687 ገንዘብ ይላኩ።\n\n💰 አሁን በቴሌብር ክፍያ ላይ የተጠቀሙበትን ትክክለኛ ስም ያስገቡ:');
  });

  bot.onText(/\/quickdonate/, async (msg) => {
    const tgId = String(msg.from.id);
    const user = await getUserByTelegramId(tgId);
    if (!user || user.role !== "donor") {
      return bot.sendMessage(msg.chat.id, "❌ መጀመሪያ እንደ ለጋሽ መመዝገብ አለብ።");
    }
    const streamers = (await db.query("SELECT telegram_id, username, full_name FROM users WHERE role = 'streamer' AND registration_status = 'approved' ORDER BY streamer_order ASC")).rows;
    if (streamers.length === 0) {
      return bot.sendMessage(msg.chat.id, "⚠️ እስካሁን ምንም Streamer የለም።");
    }
    const buttons = streamers.map(s => ([{ text: s.full_name || s.username, callback_data: `choose_streamer_${s.telegram_id}` }]));
    bot.sendMessage(msg.chat.id, "ልገሳ ለመላክ Streamer ይምረጡ:", { reply_markup: { inline_keyboard: buttons } });
  });

  bot.onText(/\/complaint/, async (msg) => {
    const tgId = String(msg.from.id);
    userStates.set(tgId, { step: 'awaiting_complaint' });
    bot.sendMessage(msg.chat.id, "📝 እባክዎ ቅሬታዎን ወይም አስተያየትዎን ያስገቡ:");
  });


  //================================================================================
  // UNIFIED MESSAGE HANDLER (State Machine)
  //================================================================================

  bot.on('message', async (msg) => {
    // Ignore commands, as they are handled by onText
    if (msg.text && msg.text.startsWith('/')) return;

    const { chat: { id: chatId }, from: { id: fromId }, text, photo } = msg;
    const tgId = String(fromId);
    const state = userStates.get(tgId);

    if (!state) return; // Not in a stateful flow

    // --- Streamer Registration Flow ---
    if (state.step === 'await_streamer_full_name' && text) {
      userStates.set(tgId, { step: 'await_streamer_social_link', fullName: text.trim() });
      bot.sendMessage(chatId, '✅ ስምዎ ተቀብሏል።\n\n🔗 እባክዎ የ TikTok ወይም YouTube መለያዎን ሊንክ ያስገቡ:');
      return;
    }
    if (state.step === 'await_streamer_social_link' && text) {
      // Basic link validation
      if (!text.startsWith('http://') && !text.startsWith('https://')) {
        bot.sendMessage(chatId, '❌ ልክ ያልሆነ ሊንክ ነው። እባክዎ በ http:// ወይም https:// የሚጀምር ሊንክ ያስገቡ።');
        return;
      }
      userStates.set(tgId, { ...state, step: 'await_streamer_phone_number', socialLink: text.trim() });
      bot.sendMessage(chatId, '✅ ሊንኩ ተቀብሏል።\n\n📞 እባክዎ ስልክ ቁጥርዎን ያስገቡ (ለምሳሌ: 2519XXXXXXXX):');
      return;
    }
    if (state.step === 'await_streamer_phone_number' && text) {
      // Basic phone number validation (e.g., starts with 2519 and has 12 digits)
      const phoneNumber = text.trim();
      if (!/^2519\d{8}$/.test(phoneNumber)) {
        bot.sendMessage(chatId, '❌ ልክ ያልሆነ ስልክ ቁጥር ነው። እባክዎ በ 2519 የሚጀምር እና 12 አሃዞች ያለው ስልክ ቁጥር ያስገቡ።');
        return;
      }
      userStates.set(tgId, { ...state, step: 'await_streamer_picture', phoneNumber: phoneNumber });
      bot.sendMessage(chatId, '✅ ስልክ ቁጥርዎ ተቀብሏል።\n\n📸 እባክዎ ፕሮፋይል ፎቶዎን ይላኩ:');
      return;
    }
    if (state.step === 'await_streamer_picture' && photo) {
      const fileId = photo[photo.length - 1].file_id;
      const { fullName, socialLink, phoneNumber } = state;
      const username = msg.from.username || msg.from.first_name;

      try {
        await db.query(
          `INSERT INTO users (telegram_id, username, role, registration_status, full_name, social_link, phone_number, profile_picture_file_id)
           VALUES ($1, $2, 'streamer', 'pending', $3, $4, $5, $6)`,
          [tgId, username, fullName, socialLink, phoneNumber, fileId]
        );
        userStates.delete(tgId);
        bot.sendMessage(chatId, '✅ ምዝገባዎ ተጠናቅቋል!\n\n⏳ ጥያቄዎ በመገምገም ላይ ነው። ይፀድቅ ወይም ውድቅ ሲደረግ መልዕክት ይደርስዎታል።');
      } catch (error) {
        console.error("Error creating pending streamer registration:", error);
        bot.sendMessage(chatId, '❌ በምዝገባ ወቅት ስህተት ተፈጥሯል። እባክዎ ቆይተው እንደገና ይሞክሩ።');
      }
      return;
    }
    // --- End Streamer Registration Flow ---

    // 1. Handle Display Name Registration
    if (state.step === 'set_display_name' && text) {
      try {
        await db.query("UPDATE users SET display_name = $1 WHERE id = $2", [text.trim(), state.user_id]);
        const afterReg = state.after_registration;
        if (afterReg === 'recharge') {
          // Continue into recharge flow directly
          userStates.set(tgId, { step: 'recharge_name' });
          bot.sendMessage(chatId, '✅ ስምዎ ተቀብሏል።\n\n💳 የቴሌብር መሙያ: ወደ 251-939976687 ገንዘብ ይላኩ።\n\n💰 አሁን በቴሌብር ክፍያ ላይ የተጠቀሙበትን ትክክለኛ ስም ያስገቡ:');
        } else {
          userStates.delete(tgId);
          bot.sendMessage(chatId, '✅ ስምዎ ተቀብሏል። አሁን ብር /recharge ያድርጉ።');
        }
      } catch (error) {
        console.error("Error updating display name:", error);
        bot.sendMessage(chatId, '❌ ስምዎን ማስቀመጥ አልተቻለም።');
      }
      return;
    }

    // 2. Handle Donation Message
    if (state.step === 'awaiting_donation' && text) {
      const { streamerId } = state;
      const { maxChars, stepChars, basePrice, incrementPrice, filteredWords } = await getSettings();
      const length = Array.from(text).length;

      if (length === 0 || text === "0") return bot.sendMessage(chatId, "⚠️ መልዕክት ባዶ ሊሆን አይችልም።");
      if (length > maxChars) return bot.sendMessage(chatId, `⚠️ መልዕክቱ በጣም ረጅም ነው (${length}/${maxChars}).`);

      // Keyword filtering
      // Normalize input and check against normalized filteredWords for robust matching
      const lowerCaseText = text.normalize('NFC').toLowerCase();
      const foundFilteredWord = filteredWords.some(word => lowerCaseText.includes(word));

      if (foundFilteredWord) {
        userStates.delete(tgId);
        await bot.sendMessage(chatId, "❌ መልዕክትዎ ተቀባይነት የሌላቸው ቃላትን ይዟል። እባክዎ መልዕክትዎን ቀይረው እንደገና ይሞክሩ።");
        
        // After rejection, prompt to choose streamer again
        const streamers = (await db.query("SELECT telegram_id, username, full_name FROM users WHERE role = 'streamer' AND registration_status = 'approved' ORDER BY streamer_order ASC")).rows;
        if (streamers.length === 0) {
          bot.sendMessage(chatId, "⚠️ እስካሁን ምንም Streamer የለም።");
          return;
        }
        const buttons = streamers.map(s => ([{ text: s.full_name || s.username, callback_data: `choose_streamer_${s.telegram_id}` }]));
        bot.sendMessage(chatId, "ልገሳ ለመላክ Streamer ይምረጡ:", { reply_markup: { inline_keyboard: buttons } });
        return;
      }

      const steps = Math.max(1, Math.ceil(length / stepChars));
      const computedAmount = basePrice + (steps - 1) * incrementPrice;

      const { rows: [{ id: donationId }] } = await db.query("INSERT INTO donations (streamer_id, donor_id, message, amount, status) VALUES ($1, $2, $3, $4, 'pending_payment') RETURNING id", [streamerId, tgId, text, computedAmount]);
      
      const userPendingDonations = pendingDonations.get(tgId) || [];
      pendingDonations.set(tgId, [...userPendingDonations, { donationId, streamerId, text, chars: length, amount: computedAmount }]);
      userStates.delete(tgId);

      const inline_keyboard = [
        [{ text: "👩 ሴት (መደበኛ)", callback_data: `voice_cloud_am-ET-Standard-A_${donationId}` }, { text: "🧑‍🦱 ወንድ (መደበኛ)", callback_data: `voice_cloud_am-ET-Standard-B_${donationId}` }],
        [{ text: "👩 ሴት (Wavenet)", callback_data: `voice_cloud_am-ET-Wavenet-A_${donationId}` }, { text: "🧑‍🦱 ወንድ (Wavenet)", callback_data: `voice_cloud_am-ET-Wavenet-B_${donationId}` }],
      ];

      if (String(process.env.ENABLE_GEMINI_TTS).toLowerCase() === 'true') {
        inline_keyboard.push(
          [{ text: "👩 Kore (Gemini)", callback_data: `voice_gemini_Kore_${donationId}` }, { text: "🧑‍🦱 Charon (Gemini)", callback_data: `voice_gemini_Charon_${donationId}` }],
          [{ text: "👩 Aoede (HD Gemini)", callback_data: `voice_gemini_Aoede_${donationId}` }, { text: "🧑‍🦱 Achird (Friendly Gemini)", callback_data: `voice_gemini_Achird_${donationId}` }],
          // New voices
          [{ text: "👩 Leda (Female Gemini)", callback_data: `voice_gemini_Leda_${donationId}` }, { text: "🧑‍🦱 Enceladus (Male Gemini)", callback_data: `voice_gemini_Enceladus_${donationId}` }]
        );
      }

      bot.sendMessage(chatId, `✅ ልገሳዎ ተዘጋጅቷል!\n💬 መልዕክት: "${text}"\n💵 ዋጋ: ${computedAmount} ብር\n\n🗣 ድምፅ ይምረጡ:`, { reply_markup: { inline_keyboard } });
      return;
    }

    // 3. Handle Recharge Flow
    if (state.step === 'recharge_name' && text) {
      userStates.set(tgId, { step: 'recharge_photo', name_on_payment: text.trim() });
      bot.sendMessage(chatId, '📸 እባክዎ የክፍያዎን ቅጽበታዊ ገጽ እይታ (screenshot) ይላኩ።');
      return;
    }
    if (state.step === 'recharge_photo' && photo) {
      const fileId = photo[photo.length - 1].file_id;
      try {
        const user = await getUserByTelegramId(tgId);
        if (!user || user.role !== 'donor') {
          userStates.delete(tgId);
          bot.sendMessage(chatId, '❌ መጀመሪያ እንደ ለጋሽ መመዝገብ አለብዎት። /start ይጫኑ እና "እንደ ለጋሽ ይመዝገቡ" ይምረጡ።');
          return;
        }
        await db.query("INSERT INTO recharges (donor_id, name_on_payment, screenshot_file_id, status, amount) VALUES ($1, $2, $3, 'pending', NULL)", [tgId, state.name_on_payment, fileId]);
        userStates.delete(tgId);
        bot.sendMessage(chatId, '✅ የመሙያ ጥያቄዎ ገብቷል! አስተዳዳሪ በቅርቡ ገምግሞ ያጸድቃል።');
      } catch (error) {
        console.error("Error creating recharge request:", error);
        bot.sendMessage(chatId, '❌ የመሙያ ጥያቄ መፍጠር አልተቻለም።');
      }
      return;
    }

    // --- Complaint Submission Flow ---
    if (state.step === 'awaiting_complaint' && text) {
      try {
        await db.query(
          "INSERT INTO complaints (telegram_id, complaint) VALUES ($1, $2)",
          [tgId, text.trim()]
        );
        userStates.delete(tgId);
        bot.sendMessage(chatId, '✅ ቅሬታዎ በተሳካ ሁኔታ ገብቷል። እናመሰግናለን!', {
          reply_markup: {
            inline_keyboard: [
              [{ text: '💰 Send Another Donation', callback_data: 'quick_donate' }]
            ]
          }
        });
      } catch (error) {
        console.error("Error saving complaint:", error);
        bot.sendMessage(chatId, '❌ ቅሬታዎን ማስገባት አልተቻለም። እባክዎ ቆይተው እንደገና ይሞክሩ።');
      }
      return;
    }
    // --- End Complaint Submission Flow ---
  });

  //================================================================================
  // UNIFIED CALLBACK HANDLER (Buttons)
  //================================================================================

  bot.on("callback_query", async (query) => {
    const { message: { chat: { id: chatId } }, from: { id: fromId, username: fromUsername, first_name }, data } = query;
    const tgId = String(fromId);
    const username = fromUsername || first_name;

    // 1. Handle Registration
    if (data.startsWith("register_")) {
      if (await getUserByTelegramId(tgId)) {
        safeAnswerCallback(query.id, { text: "አስቀድመው ተመዝግበዋል።" });
        return;
      }
      
      if (data === "register_streamer") {
        // Start the multi-step registration process
        userStates.set(tgId, { step: 'await_streamer_full_name' });
        bot.sendMessage(chatId, "✅ የ Streamer ምዝገባ ተጀምሯል።\n\nእባክዎ ሙሉ ስምዎን ያስገቡ:");
      } else { // register_donor
        const { rows: [{ id: userId }] } = await db.query("INSERT INTO users (telegram_id, username, display_name, role) VALUES ($1, $2, $3, 'donor') RETURNING id", [tgId, username, username]);
        const pending = userStates.get(tgId);
        const after_registration = pending?.after_registration || null;
        userStates.set(tgId, { step: 'set_display_name', user_id: userId, after_registration });
        bot.sendMessage(chatId, "🪪 እባክዎ ሙሉ ስምዎን (በአማርኛ) ያስገቡ።");
      }
      safeAnswerCallback(query.id);
      return;
    }

    // 2. Handle Streamer Selection -> Set state to await donation message
    if (data.startsWith("choose_streamer_")) {
      userStates.set(tgId, { step: 'awaiting_donation', streamerId: data.split("_")[2] });
      bot.sendMessage(chatId, "💬 እባክዎ የልገሳ መልዕክትዎን አሁን ይጻፉ:");
      safeAnswerCallback(query.id);
      return;
    }

    // 3. Handle Voice Selection
    if (data.startsWith("voice_")) {
      const [, engine, voice, donationIdStr] = data.split("_");
      const donationId = parseInt(donationIdStr);
      const userPendingDonations = pendingDonations.get(tgId) || [];
      const pending = userPendingDonations.find(d => d.donationId === donationId);

      if (!pending) {
        safeAnswerCallback(query.id, { text: "⚠️ የልገሳ ጊዜው አልፎበታል።" });
        return;
      }

      pending.engine = engine;
      pending.voice = voice;
      bot.sendMessage(chatId, `🗣 ድምፅ ወደ ${voice} ተቀይሯል።\n\n💰 ዋጋ: ${pending.amount} ብር። የመክፈያ ዘዴ ይምረጡ:`, {
        reply_markup: { inline_keyboard: [[{ text: `👛 ከ Wallet ይክፈሉ`, callback_data: `paywallet_${donationId}` }]] }
      });
      safeAnswerCallback(query.id);
      return;
    }

    // 4. Handle Wallet Payment
    if (data.startsWith('paywallet_')) {
      const donationIdStr = data.split('_')[1];
      const donationId = parseInt(donationIdStr);
      const userPendingDonations = pendingDonations.get(tgId) || [];
      const pendingIndex = userPendingDonations.findIndex(d => d.donationId === donationId);

      if (pendingIndex === -1) {
        safeAnswerCallback(query.id, { text: '⚠️ ጊዜው አልፎበታል።' });
        return;
      }
      const pending = userPendingDonations[pendingIndex];

      const user = await getUserByTelegramId(tgId);
      if (!user || Number(user.balance) < pending.amount) {
        return bot.sendMessage(chatId, `⚠️ በቂ ቀሪ ሂሳብ የለም። /recharge ይጠቀሙ።`);
      }

      const { rows: [donation] } = await db.query("SELECT d.*, u.link_uuid, u_donor.display_name AS donor_name FROM donations d JOIN users u ON u.telegram_id = d.streamer_id JOIN users u_donor ON u_donor.telegram_id = d.donor_id WHERE d.id = $1", [donationId]);
      if (!donation) {
        safeAnswerCallback(query.id, { text: '❌ ልገሳ አልተገኘም' });
        return;
      }

      const donorName = donation.donor_name;
      const spokenText = `ልገሳ ከ <break time="0.4s"/> <speak>${donorName} <break time="0.4s"/> የብር መጠን ${pending.amount} ብር <break time="0.4s"/> መልዕክት <break time="1s"/> ${donation.message}</speak>`;
      
      let stylePrompt = '';
      if (pending.engine === 'gemini') {
        if (pending.voice === 'Kore') stylePrompt = 'A warm, excited, and welcoming tone, speaking like a cheerful host.';
        else if (pending.voice === 'Charon') stylePrompt = 'A confident, clear, and slightly deeper voice.';
        else if (pending.voice === 'Aoede') stylePrompt = 'A high-definition, clear, and articulate female voice.';
        else if (pending.voice === 'Achird') stylePrompt = 'A friendly and approachable male voice.';
        else if (pending.voice === 'Leda') stylePrompt = 'A clear and professional female voice.';
        else if (pending.voice === 'Enceladus') stylePrompt = 'A deep and authoritative male voice.';
      }
      
      await ttsQueue.add('generate-tts', {
        donationId, spokenText, originalText: donation.message,
        engine: pending.engine, voice: pending.voice, stylePrompt, price: pending.amount,
        tgId, chatId, link_uuid: donation.link_uuid, streamer_id: donation.streamer_id, donorName,
      });

      // Remove the processed donation from the pendingDonations array
      userPendingDonations.splice(pendingIndex, 1);
      pendingDonations.set(tgId, userPendingDonations);

      bot.sendMessage(chatId, `⏳ ልገሳዎ በመሰራት ላይ ነው...`);
      safeAnswerCallback(query.id, { text: '✅ በመሰራት ላይ...' });
      return;
    }

    // 5. Handle Quick Donate
    if (data === 'quick_donate') {
      const user = await getUserByTelegramId(tgId);
      if (!user || user.role !== "donor") {
        return bot.sendMessage(chatId, "❌ መጀመሪያ እንደ ለጋሽ መመዝገብ አለብ።");
      }
      const streamers = (await db.query("SELECT telegram_id, username, full_name FROM users WHERE role = 'streamer' AND registration_status = 'approved' ORDER BY streamer_order ASC")).rows;
      if (streamers.length === 0) {
        return bot.sendMessage(chatId, "⚠️ እስካሁን ምንም Streamer የለም።");
      }
      const buttons = streamers.map(s => ([{ text: s.full_name || s.username, callback_data: `choose_streamer_${s.telegram_id}` }]));
      bot.sendMessage(chatId, "ልገሳ ለመላክ Streamer ይምረጡ:", { reply_markup: { inline_keyboard: buttons } });
      return safeAnswerCallback(query.id);
    }
  });
}

export { bot, reloadSettings };
