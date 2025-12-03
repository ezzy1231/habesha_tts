import { isDonorBanned, buildBanMessage } from '../utils/ban.js';

// Registers /command handlers without altering existing bot behavior.
export const registerCommands = (bot, deps = {}) => {
  if (!bot) return;

  const {
    db,
    getUserByTelegramId,
    userStates,
    pendingDonations,
  } = deps;

  if (!db || !getUserByTelegramId || !userStates || !pendingDonations) {
    console.warn('[Bot] Missing dependencies for command handlers; skipping registration.');
    return;
  }

  const streamerEmojis = ['🥇', '🥈', '🥉', '🎮', '🕹️', '🎰', '🧩', '🎧', '🎫', '🎟️'];

  const checkBanAndNotify = async (chatId, user) => {
    if (isDonorBanned(user)) {
      await bot.sendMessage(chatId, buildBanMessage(user));
      return true;
    }
    return false;
  };

  const sendStreamerSelectionMenu = async (chatId) => {
    const streamers = (
      await db.query(
        "SELECT telegram_id, username, full_name FROM users WHERE role = 'streamer' AND registration_status = 'approved' ORDER BY streamer_order ASC"
      )
    ).rows;

    if (streamers.length === 0) {
      await bot.sendMessage(chatId, "⚠️ እስካሁን ምንም Streamer የለም።");
      return false;
    }

    const formatStreamerLabel = (streamer, index) => {
      const displayName = streamer.full_name || streamer.username;
      const emoji = streamerEmojis[index % streamerEmojis.length];
      return `${emoji} ${displayName}`;
    };

    const buttons = [];
    for (let i = 0; i < streamers.length; i += 2) {
      const row = [
        {
          text: formatStreamerLabel(streamers[i], i),
          callback_data: `choose_streamer_${streamers[i].telegram_id}`,
        },
      ];
      if (streamers[i + 1]) {
        row.push({
          text: formatStreamerLabel(streamers[i + 1], i + 1),
          callback_data: `choose_streamer_${streamers[i + 1].telegram_id}`,
        });
      }
      buttons.push(row);
    }

    await bot.sendMessage(chatId, '🎯 *ልገሳ ለመላክ Streamer ይምረጡ* 👇', {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons },
    });
    return true;
  };

  bot.onText(/\/start/, async (msg) => {
    const {
      chat: { id: chatId },
      from: { id: fromId, first_name },
    } = msg;
    const tgId = String(fromId);

    // Clear any previous state
    await userStates.delete(tgId);

    const user = await getUserByTelegramId(tgId);

    if (user) {
      await bot.sendMessage(chatId, `👋 እንኳን ደህና መጡ ${first_name}! እንደ ${user.role} ተመዝግበዋል።`);
      if (await checkBanAndNotify(chatId, user)) {
        return;
      }
    }

    await bot.sendMessage(chatId, "👋 እንኳን ደህና መጡ! እባክዎ ሚናዎን ይምረጡ:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "💰 እንደ Donor ይመዝገቡ", callback_data: "register_donor" }],
        ],
      },
    });
  });

  bot.onText(/\/streamer|\/register_streamer/, async (msg) => {
    const tgId = String(msg.from.id);
    const user = await getUserByTelegramId(tgId);
    if (user && user.role === 'streamer') {
      bot.sendMessage(msg.chat.id, '\u26a0\ufe0f You are already registered as a streamer.');
      return;
    }
    await userStates.set(tgId, { step: 'await_streamer_full_name' });
    bot.sendMessage(msg.chat.id, '🎮 *የ Streamer ምዝገባ ፕሮግራም*\n━━━━━━━━━━━━━━━━\n\n👋 እንኳን ደህና መጡ!\n\n📝 *እንዲሞሉ የሚጠበቁ መረጃዎች:*\n   1️⃣ ሙሉ ስም\n   2️⃣ የማህበራዊ ሚዲያ አካውንት\n   3️⃣ ስልክ ቁጥር\n   4️⃣ የፕሮፋይል ፎቶ\n\n✍️ እባክዎ *ሙሉ ስምዎን* ያስገቡ:', { parse_mode: 'Markdown' });
  });

  bot.onText(/\/donate/, async (msg) => {
    const tgId = String(msg.from.id);
    const user = await getUserByTelegramId(tgId);
    if (!user || user.role !== "donor") {
      await bot.sendMessage(msg.chat.id, "❌ መጀመሪያ እንደ ለጋሽ መመዝገብ አለብዎት።");
      return;
    }
    if (await checkBanAndNotify(msg.chat.id, user)) return;
    await sendStreamerSelectionMenu(msg.chat.id);
  });

  bot.onText(/\/balance/, async (msg) => {
    const tgId = String(msg.from.id);
    const user = await getUserByTelegramId(tgId);
    if (!user || user.role !== "donor") return;
    if (await checkBanAndNotify(msg.chat.id, user)) return;
    bot.sendMessage(
      msg.chat.id,
      `💼 የ Wallet ቀሪ ሂሳብ: ${Number(user.balance || 0).toFixed(2)} ብር`
    );
  });

  bot.onText(/\/reset/, async (msg) => {
    const tgId = String(msg.from.id);
    const chatId = msg.chat.id;

    try {
      await userStates.delete(tgId);
      await pendingDonations.delete(tgId);
      await db.query("DELETE FROM users WHERE telegram_id = $1", [tgId]);
      bot.sendMessage(chatId, '🔄 ስብስብ ነጻ ተደርጓል። እንደገና ይመዝገቡ። /start ይጫኑ');
    } catch (error) {
      console.error('Error during reset:', error);
      bot.sendMessage(chatId, '❌ ስብስ ማጥፋት አልተቻለም። እንደገና ይሞክሩ።');
    }
  });

  bot.onText(/\/recharge/, async (msg) => {
    const tgId = String(msg.from.id);
    const user = await getUserByTelegramId(tgId);

    if (!user || user.role !== "donor") {
      await bot.sendMessage(
        msg.chat.id,
        '❌ መጀመሪያ እንደ ለጋሽ መመዝገብ አለብዎት። /start ይጫኑ እና "እንደ ለጋሽ ይመዝገቡ" ይምረጡ።'
      );
      return;
    }

    if (await checkBanAndNotify(msg.chat.id, user)) return;

    await userStates.set(tgId, { step: "recharge_select_amount" });
    bot.sendMessage(
      msg.chat.id,
      '💳 የቴሌብር መሙያ\n\n📱 ወደ 251-939976687 ገንዘብ ይላኩ።\n\n💰 የሚሞሉትን መጠን ይምረጡ:',
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '💵 100 ብር', callback_data: 'recharge_amount_100' },
              { text: '💵 200 ብር', callback_data: 'recharge_amount_200' },
            ],
            [
              { text: '💵 300 ብር', callback_data: 'recharge_amount_300' },
              { text: '💵 500 ብር', callback_data: 'recharge_amount_500' },
            ],
            [
              { text: '💵 600 ብር', callback_data: 'recharge_amount_600' },
              { text: '✏️ ሌላ መጠን', callback_data: 'recharge_amount_custom' },
            ],
          ],
        },
      }
    );
  });

  bot.onText(/\/change_name/, async (msg) => {
    const tgId = String(msg.from.id);
    const chatId = msg.chat.id;
    const user = await getUserByTelegramId(tgId);

    if (!user || user.role !== 'donor') {
      await bot.sendMessage(chatId, '❌ መጀመሪያ እንደ ለጋሽ መመዝገብ አለብዎት። /start ይጫኑ እና "እንደ ለጋሽ ይመዝገቡ" ይምረጡ።');
      return;
    }

    if (await checkBanAndNotify(chatId, user)) return;

    await userStates.set(tgId, { step: 'change_display_name', user_id: user.id });
    const currentName = user.display_name || user.username || 'ያልተገለጸ ስም';
    await bot.sendMessage(
      chatId,
      `🪪 አሁን የታየው ስም: ${currentName}\n\n✏️ እባክዎ አዲስ ስምዎን (በአማርኛ) ያስገቡ።\n🚫 የተከለከሉ ቃላት ቢኖሩ ይዟል ብለን እንቆማለን።`
    );
  });

  bot.onText(/\/quickdonate/, async (msg) => {
    const tgId = String(msg.from.id);
    const user = await getUserByTelegramId(tgId);
    if (!user || user.role !== "donor") {
      bot.sendMessage(msg.chat.id, "❌ መጀመሪያ እንደ ለጋሽ መመዝገብ አለብዎት።");
      return;
    }
    if (await checkBanAndNotify(msg.chat.id, user)) return;
    await sendStreamerSelectionMenu(msg.chat.id);
  });

  bot.onText(/\/complaint/, async (msg) => {
    const tgId = String(msg.from.id);
    await userStates.set(tgId, { step: "awaiting_complaint" });
    bot.sendMessage(msg.chat.id, "📝 እባክዎ ቅሬታዎን ወይም አስተያየትዎን ያስገቡ:");
  });
};