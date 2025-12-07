import { isDonorBanned, buildBanMessage } from '../utils/ban.js';

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
        "SELECT telegram_id, username, full_name, live_status FROM users WHERE role = 'streamer' AND registration_status = 'approved' ORDER BY streamer_order ASC"
      )
    ).rows;

    if (streamers.length === 0) {
      await bot.sendMessage(chatId, '⚠️ እስካሁን ምንም Streamer የለም።');
      return false;
    }

    const formatStreamerLabel = (streamer, index) => {
      const displayName = streamer.full_name || streamer.username;
      const statusIcon = streamer.live_status ? '🟢' : '⚫️';
      const rankIcons = ['🥇', '🥈', '🥉', '🎮', '🕹️', '👾', '🎲', '🎯', '🎪', '🎭', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🎻'];
      const rankIcon = rankIcons[index] || '👤';
      return `${rankIcon} ${displayName} ${statusIcon}`;
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
    const user = await getUserByTelegramId(tgId);

    const notifyBan = async () => {
      if (user && isDonorBanned(user)) {
        await bot.sendMessage(chatId, buildBanMessage(user));
        await safeAnswerCallback(query.id, { text: '⛔ መለያዎ ተገድቧል።', show_alert: true });
        return true;
      }
      return false;
    };

    try {
      if (data === 'list_streamers') {
        if (await notifyBan()) return;
        await sendStreamerMenu(chatId);
        safeAnswerCallback(query.id);
        return;
      }

      if (data.startsWith('register_')) {
        if (user) {
          if (isDonorBanned(user)) {
            await bot.sendMessage(chatId, buildBanMessage(user));
          }
          safeAnswerCallback(query.id, { text: 'አስቀድመው ተመዝግበዋል።' });
          return;
        }

        if (data === 'register_streamer') {
          await userStates.set(tgId, { step: 'await_streamer_full_name' });
          await bot.sendMessage(chatId, '🎮 *የ Streamer ምዝገባ ፕሮግራም*\n━━━━━━━━━━━━━━━━\n\n👋 እንኳን ደህና መጡ!\n\n📝 *እንዲሞሉ የሚጠበቁ መረጃዎች:*\n   1️⃣ ሙሉ ስም\n   2️⃣ የማህበራዊ ሚዲያ አካውንት\n   3️⃣ ስልክ ቁጥር\n   4️⃣ የፕሮፋይል ፎቶ\n\n✍️ እባክዎ *ሙሉ ስምዎን* ያስገቡ:', { parse_mode: 'Markdown' });
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
        if (await notifyBan()) return;
        const streamerId = data.split('_')[2];
        let streamer;
        try {
          const { rows } = await db.query(
            "SELECT live_status, full_name, username, profile_picture_file_id FROM users WHERE telegram_id = $1 AND role = 'streamer'",
            [streamerId]
          );
          streamer = rows[0];
          if (!streamer?.live_status) {
            await userStates.delete(tgId);
            await bot.sendMessage(chatId, "⚠️ ስትሪመሩ አሁን ላይቭ አይደለም—እባክዎ ቆይተው ይመለሱ!");
            safeAnswerCallback(query.id, { text: '⚠️ Streamer offline', show_alert: true });
            return;
          }
        } catch (error) {
          console.error('[Bot] Failed to re-check live status on selection:', error);
          await userStates.delete(tgId);
          await bot.sendMessage(chatId, "⚠️ ስትሪመሩ አሁን ላይቭ አይደለም—እባክዎ ቆይተው ይመለሱ!");
          safeAnswerCallback(query.id, { text: '⚠️ Streamer offline', show_alert: true });
          return;
        }
        await userStates.set(tgId, { step: 'awaiting_donation', streamerId });
        await bot.sendMessage(chatId, '💬 እባክዎ የልገሳ መልዕክትዎን አሁን ይጻፉ:');
        safeAnswerCallback(query.id);
        return;
      }

      if (data.startsWith('voice_')) {
        if (await notifyBan()) return;
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

        const voiceLabelMap = {
          Kore: 'የተቆጣች ሴት',
          Charon: 'የተነሳሳ ወንድ',
          Sulafat: 'የተደሰተች ሴት',
          Zubenelgenubi: 'የተማረረ ወንድ',
          Aoede: 'የተናደደች ሴት',
          Enceladus: 'የፈነደቀ ወንድ',
          Vindemiatrix: 'የተከፋች ሴት',
          Achird: 'የተበሳጨ ወንድ',
          Despina: 'የጓጓች ሴት',
          Iapetus: 'የተዝናና ወንድ',
        };
        const voiceLabel = voiceLabelMap[voice] || voice;

        await bot.sendMessage(
          chatId,
          `🗣 ድምፅ ወደ ${voiceLabel} ተቀይሯል።\n\n💰 ዋጋ: ${pending.amount} ብር። የመክፈያ ዘዴ ይምረጡ:`,
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
        if (await notifyBan()) return;
        const donationId = parseInt(data.split('_')[1], 10);
        const userPendingDonations = (await pendingDonations.get(tgId)) || [];
        const pendingIndex = userPendingDonations.findIndex((d) => d.donationId === donationId);

        if (pendingIndex === -1) {
          safeAnswerCallback(query.id, { text: '⚠️ ጊዜው አልፎበታል።' });
          return;
        }

        const pending = userPendingDonations[pendingIndex];
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
        const spokenText = `<speak>ልገሳ ከ <break time="0.4s"/> ${donorName} <break time="0.4s"/> መልዕክት <break time="1s"/> ${donation.message}</speak>`;

        let stylePrompt = '';
        if (pending.engine === 'gemini') {
          if (pending.voice === 'Kore') stylePrompt = 'A high-pitched and sharply annoyed tone, with rising volume and clipped delivery.';
          else if (pending.voice === 'Charon') stylePrompt = 'An upbeat and enthusiastic tone, like a thrilled news anchor.';
          else if (pending.voice === 'Sulafat') stylePrompt = 'A sincere, contented, and friendly tone, sounding genuinely pleased and warm.';
          else if (pending.voice === 'Zubenelgenubi') stylePrompt = 'A hollow, heartbroken, and desolate tone, with a very slow, heavy, and resigned pace.';
          else if (pending.voice === 'Aoede') stylePrompt = 'A commanding, irritated tone, with a deliberate, firm, and slightly harsh cadence.';
          else if (pending.voice === 'Enceladus') stylePrompt = 'A deep, confident, and satisfied tone, conveying professional pride and pleasure.';
          else if (pending.voice === 'Vindemiatrix') stylePrompt = 'A soft, somber, and weary tone, conveying exhaustion and grief.';
          else if (pending.voice === 'Achird') stylePrompt = 'A frustrated, slightly defensive tone, with a slightly strained pace.';
          else if (pending.voice === 'Despina') stylePrompt = 'An energetic and highly inviting tone, expressing eagerness and anticipation.';
          else if (pending.voice === 'Iapetus') stylePrompt = 'A lighthearted, warm, and amused tone, with a casual, approachable quality.';
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

      if (data.startsWith('recharge_amount_')) {
        if (await notifyBan()) return;
        const amountStr = data.split('_')[2];
        console.log(`[Bot] Recharge callback: user=${tgId}, amountStr=${amountStr}`);
        if (amountStr === 'custom') {
          await userStates.set(tgId, { step: 'recharge_custom_amount' });
          await bot.sendMessage(chatId, '✏️ እባክዎ የሚሞሉትን መጠን በቁጥር ያስገቡ (ለምሳሌ: 150):');
        } else {
          const amount = parseInt(amountStr, 10);
          console.log(`[Bot] Setting recharge state: user=${tgId}, amount=${amount}`);
          await userStates.set(tgId, { step: 'recharge_name', recharge_amount: amount });
          await bot.sendMessage(chatId, `✅ ${amount} ብር ተመርጧል።\n\n💰 አሁን በቴሌብር ክፍያ ላይ የተጠቀሙበትን ትክክለኛ ስም ያስገቡ:`);
        }
        safeAnswerCallback(query.id);
        return;
      }

      if (data === 'quick_donate') {
        if (!user || user.role !== 'donor') {
          await bot.sendMessage(chatId, '❌ መጀመሪያ እንደ ለጋሽ መመዝገብ አለብ።');
          return;
        }
        if (await notifyBan()) return;
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
