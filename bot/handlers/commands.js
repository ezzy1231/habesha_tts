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

    const buttons = streamers.map((s) => [
      {
        text: s.full_name || s.username,
        callback_data: `choose_streamer_${s.telegram_id}`,
      },
    ]);

    await bot.sendMessage(chatId, "ልገሳ ለመላክ Streamer ይምረጡ:", {
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
    await userStates.delete(tgId);
    const user = await getUserByTelegramId(tgId);
    if (user) {
      bot.sendMessage(chatId, `👋 እንኳን ደህና መጡ ${first_name}! እንደ ${user.role} ተመዝግበዋል።`);
      return;
    }
    bot.sendMessage(chatId, "👋 እንኳን ደህና መጡ! እባክዎ ሚናዎን ይምረጡ:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🎥 እንደ Streamer ይመዝገቡ", callback_data: "register_streamer" }],
          [{ text: "💰 እንደ Doner ይመዝገቡ", callback_data: "register_donor" }],
        ],
      },
    });
  });

  bot.onText(/\/donate/, async (msg) => {
    const tgId = String(msg.from.id);
    const user = await getUserByTelegramId(tgId);
    if (!user || user.role !== "donor") {
      bot.sendMessage(msg.chat.id, "❌ መጀመሪያ እንደ ለጋሽ መመዝገብ አለብዎት።");
      return;
    }
    await sendStreamerSelectionMenu(msg.chat.id);
  });

  bot.onText(/\/balance/, async (msg) => {
    const tgId = String(msg.from.id);
    const user = await getUserByTelegramId(tgId);
    if (!user || user.role !== "donor") return;
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
      bot.sendMessage(chatId, '🔄 ስብስ ነጻ ተደርጓል። እንደገና ይመዝገቡ። /start ይጫኑ');
    } catch (error) {
      console.error('Error during reset:', error);
      bot.sendMessage(chatId, '❌ ስብስ ማጥፋት አልተቻለም። እንደገና ይሞክሩ።');
    }
  });

  bot.onText(/\/recharge/, async (msg) => {
    const tgId = String(msg.from.id);
    const user = await getUserByTelegramId(tgId);
    if (!user || user.role !== "donor") {
      await userStates.set(tgId, { step: "await_registration", after_registration: "recharge" });
      bot.sendMessage(
        msg.chat.id,
        '❌ መጀመሪያ እንደ ለጋሽ መመዝገብ አለብዎት። /start ይጫኑ እና "እንደ ለጋሽ ይመዝገቡ" ይምረጡ።'
      );
      return;
    }
    await userStates.set(tgId, { step: "recharge_name" });
    bot.sendMessage(
      msg.chat.id,
      '💳 የቴሌብር መሙያ: ቢያንስ 100 ብር ወደ 251-939976687 ገንዘብ ይላኩ።\n\n💰 አሁን በቴሌብር ክፍያ ላይ የተጠቀሙበትን ትክክለኛ ስም ያስገቡ:'
    );
  });

  bot.onText(/\/quickdonate/, async (msg) => {
    const tgId = String(msg.from.id);
    const user = await getUserByTelegramId(tgId);
    if (!user || user.role !== "donor") {
      bot.sendMessage(msg.chat.id, "❌ መጀመሪያ እንደ ለጋሽ መመዝገብ አለብ።");
      return;
    }
    await sendStreamerSelectionMenu(msg.chat.id);
  });

  bot.onText(/\/complaint/, async (msg) => {
    const tgId = String(msg.from.id);
    await userStates.set(tgId, { step: "awaiting_complaint" });
    bot.sendMessage(msg.chat.id, "📝 እባክዎ ቅሬታዎን ወይም አስተያየትዎን ያስገቡ:");
  });
};
