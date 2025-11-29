export const registerCallbacks = (bot, deps = {}) => {
  if (!bot) return;

  const {
    db,
    getUserByTelegramId,
    userStates,
    pendingDonations,
    safeAnswerCallback,
    ttsQueue,
  } = deps;

  if (!db || !getUserByTelegramId || !userStates || !pendingDonations || !safeAnswerCallback || !ttsQueue) {
    console.warn('[Bot] Missing dependencies for callback handlers; skipping registration.');
    return;
  }

  const sendStreamerMenu = async (chatId) => {
    const streamers = (
      await db.query(
        "SELECT telegram_id, username, full_name FROM users WHERE role = 'streamer' AND registration_status = 'approved' ORDER BY streamer_order ASC"
      )
    ).rows;

    if (streamers.length === 0) {
      await bot.sendMessage(chatId, '⚠️ እስካሁን ምንም Streamer የለም።');
      return false;
    }

    const formatStreamerLabel = (streamer, index) => {
      const displayName = streamer.full_name || streamer.username;
      return `🎙️ ${displayName} · #${index + 1}`;
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

    await bot.sendMessage(chatId, 'ልገሳ ለመላክ Streamer ይምረጡ:', {
      reply_markup: { inline_keyboard: buttons },
    });
    return true;
  };

  bot.on('callback_query', async (query) => {
    const {
      message: {
        chat: { id: chatId },
      },
      from: { id: fromId, username: fromUsername, first_name },
      data,
    } = query;

    if (!data) return;

    const tgId = String(fromId);
    const username = fromUsername || first_name;

    try {
      if (data.startsWith('register_')) {
        if (await getUserByTelegramId(tgId)) {
          safeAnswerCallback(query.id, { text: 'አስቀድመው ተመዝግበዋል።' });
          return;
        }

        if (data === 'register_streamer') {
          await userStates.set(tgId, { step: 'await_streamer_full_name' });
          await bot.sendMessage(chatId, '✅ የ Streamer ምዝገባ ተጀምሯል።\n\nእባክዎ ሙሉ ስምዎን ያስገቡ:');
        } else {
          const {
            rows: [{ id: userId }],
          } = await db.query(
            "INSERT INTO users (telegram_id, username, display_name, role) VALUES ($1, $2, $3, 'donor') RETURNING id",
            [tgId, username, username]
          );
          const pending = await userStates.get(tgId);
          const after_registration = pending?.after_registration || null;
          await userStates.set(tgId, { step: 'set_display_name', user_id: userId, after_registration });
          await bot.sendMessage(chatId, '🪪 እባክዎ ሙሉ ስምዎን (በአማርኛ) ያስገቡ።');
        }
        safeAnswerCallback(query.id);
        return;
      }

      if (data.startsWith('choose_streamer_')) {
        await userStates.set(tgId, { step: 'awaiting_donation', streamerId: data.split('_')[2] });
        await bot.sendMessage(chatId, '💬 እባክዎ የልገሳ መልዕክትዎን አሁን ይጻፉ:');
        safeAnswerCallback(query.id);
        return;
      }

      if (data.startsWith('voice_')) {
        const [, engine, voice, donationIdStr] = data.split('_');
        const donationId = parseInt(donationIdStr, 10);
        const userPendingDonations = (await pendingDonations.get(tgId)) || [];
        const pending = userPendingDonations.find((d) => d.donationId === donationId);

        if (!pending) {
          safeAnswerCallback(query.id, { text: '⚠️ የልገሳ ጊዜው አልፎበታል።' });
          return;
        }

        pending.engine = engine;
        pending.voice = voice;
        await pendingDonations.set(tgId, userPendingDonations);

        await bot.sendMessage(
          chatId,
          `🗣 ድምፅ ወደ ${voice} ተቀይሯል።\n\n💰 ዋጋ: ${pending.amount} ብር። የመክፈያ ዘዴ ይምረጡ:`,
          {
            reply_markup: {
              inline_keyboard: [[{ text: '👛 ከ Wallet ይክፈሉ', callback_data: `paywallet_${donationId}` }]],
            },
          }
        );
        safeAnswerCallback(query.id);
        return;
      }

      if (data.startsWith('paywallet_')) {
        const donationId = parseInt(data.split('_')[1], 10);
        const userPendingDonations = (await pendingDonations.get(tgId)) || [];
        const pendingIndex = userPendingDonations.findIndex((d) => d.donationId === donationId);

        if (pendingIndex === -1) {
          safeAnswerCallback(query.id, { text: '⚠️ ጊዜው አልፎበታል።' });
          return;
        }

        const pending = userPendingDonations[pendingIndex];
        const user = await getUserByTelegramId(tgId);
        if (!user || Number(user.balance) < pending.amount) {
          await bot.sendMessage(chatId, '⚠️ በቂ ቀሪ ሂሳብ የለም። /recharge ይጠቀሙ።');
          return;
        }

        const {
          rows: [donation],
        } = await db.query(
          "SELECT d.*, u.link_uuid, u_donor.display_name AS donor_name FROM donations d JOIN users u ON u.telegram_id = d.streamer_id JOIN users u_donor ON u_donor.telegram_id = d.donor_id WHERE d.id = $1",
          [donationId]
        );
        if (!donation) {
          safeAnswerCallback(query.id, { text: '❌ ልገሳ አልተገኘም' });
          return;
        }

        const donorName = donation.donor_name;
        const spokenText = `<speak>ልገሳ ከ <break time="0.4s"/> ${donorName} <break time="0.4s"/> የብር መጠን ${pending.amount} ብር <break time="0.4s"/> መልዕክት <break time="1s"/> ${donation.message}</speak>`;

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
          donationId,
          spokenText,
          originalText: donation.message,
          engine: pending.engine,
          voice: pending.voice,
          stylePrompt,
          price: pending.amount,
          tgId,
          chatId,
          link_uuid: donation.link_uuid,
          streamer_id: donation.streamer_id,
          donorName,
        });

        userPendingDonations.splice(pendingIndex, 1);
        await pendingDonations.set(tgId, userPendingDonations);

        await bot.sendMessage(chatId, '⏳ ልገሳዎ በመሰራት ላይ ነው...');
        safeAnswerCallback(query.id, { text: '✅ በመሰራት ላይ...' });
        return;
      }

      if (data === 'quick_donate') {
        const user = await getUserByTelegramId(tgId);
        if (!user || user.role !== 'donor') {
          await bot.sendMessage(chatId, '❌ መጀመሪያ እንደ ለጋሽ መመዝገብ አለብ።');
          return;
        }
        await sendStreamerMenu(chatId);
        safeAnswerCallback(query.id);
        return;
      }
    } catch (error) {
      console.error('[Bot] callback_query handler error:', error);
      try {
        await safeAnswerCallback(query.id, { text: '❌ ጥያቄ ተሰናክሏል።', show_alert: true });
      } catch (e) {
        console.error('[Bot] Failed to answer callback after error:', e);
      }
    }
  });
};
