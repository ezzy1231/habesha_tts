import { isDonorBanned, buildBanMessage } from '../utils/ban.js';

const DONOR_BAN_STEPS = new Set([
  'set_display_name',
  'change_display_name',
  'awaiting_donation',
  'recharge_custom_amount',
  'recharge_name',
  'recharge_photo',
]);

export const registerMessageFlows = (bot, deps = {}) => {
  if (!bot) return;

  const {
    db,
    getUserByTelegramId,
    userStates,
    pendingDonations,
    getSettings,
    emitAdminEvent,
  } = deps;

  if (!db || !getUserByTelegramId || !userStates || !pendingDonations || !getSettings || !emitAdminEvent) {
    console.warn('[Bot] Missing dependencies for message handlers; skipping registration.');
    return;
  }

  bot.on('message', async (msg) => {
    if (msg.text && msg.text.startsWith('/')) return;

    const {
      chat: { id: chatId },
      from: { id: fromId },
      text,
      photo,
    } = msg;

    const tgId = String(fromId);
    const state = await userStates.get(tgId);
    
    if (state) {
      console.log(`[Bot] Message handler: user=${tgId}, step=${state.step}, text="${text}"`);
    }

    if (!state) return;

    const user = await getUserByTelegramId(tgId);

    if (user && DONOR_BAN_STEPS.has(state.step) && isDonorBanned(user)) {
      await userStates.delete(tgId);
      await bot.sendMessage(chatId, buildBanMessage(user));
      return;
    }

    if (state.step === 'await_streamer_full_name' && text) {
      await userStates.set(tgId, { step: 'await_streamer_social_link', fullName: text.trim() });
      await bot.sendMessage(chatId, '✅ *ስምዎ በተሳካ ሁኔታ ተመዝግቧል!*\n\n📱 *የማህበራዊ ሚዲያ አካውንት*\n━━━━━━━━━━━━━━━━\n\n🔗 እባክዎ የእርስዎ የ TikTok ወይም YouTube መለያ ሊንክ ያስገቡ\n\n💡 *ምሳሌ:*\n   • `https://tiktok.com/@username`\n   • `https://youtube.com/@channel`', { parse_mode: 'Markdown' });
      return;
    }

    if (state.step === 'await_streamer_social_link' && text) {
      if (!text.startsWith('http://') && !text.startsWith('https://')) {
        await bot.sendMessage(chatId, '❌ ልክ ያልሆነ ሊንክ ነው። እባክዎ በ http:// ወይም https:// የሚጀምር ሊንክ ያስገቡ።');
        return;
      }
      await userStates.set(tgId, { ...state, step: 'await_streamer_phone_number', socialLink: text.trim() });
      await bot.sendMessage(chatId, '✅ *ሊንኩ በተሳካ ሁኔታ ተመዝግቧል!*\n\n📞 *ስልክ ቁጥር*\n━━━━━━━━━━━━━━━━\n\n📱 እባክዎ የእርስዎን ስልክ ቁጥር ያስገቡ\n\n💡 *ቅርጸት:* `2519XXXXXXXX`\n   (በ 2519 የሚጀምር 12 አሃዞች)', { parse_mode: 'Markdown' });
      return;
    }

    if (state.step === 'await_streamer_phone_number' && text) {
      const phoneNumber = text.trim();
      if (!/^2519\d{8}$/.test(phoneNumber)) {
        await bot.sendMessage(chatId, '❌ ልክ ያልሆነ ስልክ ቁጥር ነው። እባክዎ በ 2519 የሚጀምር እና 12 አሃዞች ያለው ስልክ ቁጥር ያስገቡ።');
        return;
      }
      await userStates.set(tgId, { ...state, step: 'await_streamer_picture', phoneNumber });
      await bot.sendMessage(chatId, '✅ *ስልክ ቁጥርዎ በተሳካ ሁኔታ ተመዝግቧል!*\n\n📸 *የፕሮፋይል ፎቶ*\n━━━━━━━━━━━━━━━━\n\n🖼️ እባክዎ የእርስዎን ፕሮፋይል ፎቶ ይላኩ\n\n✨ *ጥራቱ ከፍ ያለ እና ግልጽ ፎቶ ይምረጡ*', { parse_mode: 'Markdown' });
      return;
    }

    if (state.step === 'await_streamer_picture' && photo) {
      const fileId = photo[photo.length - 1].file_id;
      const { fullName, socialLink, phoneNumber } = state;
      const username = msg.from.username || msg.from.first_name;

      try {
        const insertRes = await db.query(
          `INSERT INTO users (telegram_id, username, role, registration_status, full_name, social_link, phone_number, profile_picture_file_id, streamer_order)
           VALUES ($1, $2, 'streamer', 'pending', $3, $4, $5, $6, (SELECT COALESCE(MAX(streamer_order), 0) + 1 FROM users WHERE role = 'streamer')) RETURNING id`,
          [tgId, username, fullName, socialLink, phoneNumber, fileId]
        );
        await userStates.delete(tgId);
        await bot.sendMessage(chatId, '🎉 *ምዝገባዎ በተሳካ ሁኔታ ተጠናቅቋል!*\n━━━━━━━━━━━━━━━━\n\n✅ መረጃዎ ተቀብሏል\n⏳ አሁን በአስተዳዳሪው በመገምገም ላይ ነው\n\n📬 *ምን ይከተላል?*\n   • ጥያቄዎ በቅርቡ ይገመገማል\n   • ውጤቱ በቴሌግራም መልዕክት ይደርስዎታል\n   • ከተፈቀደ የዳሽቦርድ ሊንክዎን ይቀበላሉ\n\n🙏 ስለ መመዝገብዎ እናመሰግናለን!', { parse_mode: 'Markdown' });
        emitAdminEvent('streamer_request_created', {
          telegramId: tgId,
          fullName,
          username,
          phoneNumber,
          userId: insertRes.rows[0]?.id,
        });
      } catch (error) {
        console.error('Error creating pending streamer registration:', error);
        await bot.sendMessage(chatId, '❌ በምዝገባ ወቅት ስህተት ተፈጥሯል። እባክዎ ቆይተው እንደገና ይሞክሩ።');
      }
      return;
    }

    if ((state.step === 'set_display_name' || state.step === 'change_display_name') && text) {
      const proposedName = text.normalize('NFC').trim();
      if (proposedName.length < 2 || proposedName.length > 48) {
        await bot.sendMessage(chatId, '⚠️ ስምዎ በ 2-48 ቁምፊዎች መካከል መሆን አለበት።');
        return;
      }

      const { filteredWords } = await getSettings();
      const containsFiltered = filteredWords.some((word) => proposedName.toLowerCase().includes(word));
      if (containsFiltered) {
        await bot.sendMessage(chatId, '❌ ስምዎ የተከለከሉ ቃላትን ይዟል። እባክዎ ሌላ ስም ይሞክሩ።');
        return;
      }

      try {
        if (!state.user_id) {
          throw new Error('Missing user reference for display-name update');
        }
        await db.query('UPDATE users SET display_name = $1 WHERE id = $2', [proposedName, state.user_id]);

        if (state.step === 'change_display_name') {
          await userStates.delete(tgId);
          await bot.sendMessage(chatId, '✅ አዲስ ስምዎ ተቀብሏል። እንግዲህ በሁሉም ስብስቦች ላይ ይመራል።');
        } else {
          const afterReg = state.after_registration;
          if (afterReg === 'recharge') {
            await userStates.set(tgId, { step: 'recharge_name' });
            await bot.sendMessage(
              chatId,
              '✅ ስምዎ ተቀብሏል።\n\n💳 የቴሌብር መሙያ: ወደ 251-939976687 ገንዘብ ይላኩ።\n\n💰 አሁን በቴሌብር ክፍያ ላይ የተጠቀሙበትን ትክክለኛ ስም ያስገቡ:'
            );
          } else {
            await userStates.delete(tgId);
            await bot.sendMessage(chatId, '✅ ስምዎ ተቀብሏል። አሁን ብር /recharge ያድርጉ።');
          }
        }
      } catch (error) {
        console.error('Error updating display name:', error);
        await bot.sendMessage(chatId, '❌ ስምዎን ማስቀመጥ አልተቻለም።');
      }
      return;
    }

    if (state.step === 'awaiting_donation' && text) {
      const { streamerId } = state;
      const { maxChars, stepChars, basePrice, incrementPrice, filteredWords } = await getSettings();
      try {
        const liveCheck = await db.query('SELECT live_status FROM users WHERE telegram_id = $1 AND role = \'streamer\'', [streamerId]);
        if (!liveCheck.rows[0]?.live_status) {
          await userStates.delete(tgId);
          await bot.sendMessage(chatId, 'Streamer isn\'t live right now—come back soon!');
          return;
        }
      } catch (error) {
        console.error('[Bot] Failed to verify live status before donation:', error);
        await userStates.delete(tgId);
        await bot.sendMessage(chatId, 'Streamer isn\'t live right now—come back soon!');
        return;
      }
      const length = Array.from(text).length;

      if (length === 0 || text === '0') {
        await bot.sendMessage(chatId, '⚠️ መልዕክት ባዶ ሊሆን አይችልም።');
        return;
      }
      if (length > maxChars) {
        await bot.sendMessage(chatId, `⚠️ መልዕክቱ በጣም ረጅም ነው (${length}/${maxChars}).`);
        return;
      }

      const lowerCaseText = text.normalize('NFC').toLowerCase();
      const foundFilteredWord = filteredWords.some((word) => lowerCaseText.includes(word));

      if (foundFilteredWord) {
        await userStates.delete(tgId);
        await bot.sendMessage(chatId, '❌ መልዕክትዎ ተቀባይነት የሌላቸው ቃላትን ይዟል። እባክዎ መልዕክትዎን ቀይረው እንደገና ይሞክሩ።');

        const streamers = (
          await db.query(
            "SELECT telegram_id, username, full_name, live_status FROM users WHERE role = 'streamer' AND registration_status = 'approved' ORDER BY streamer_order ASC"
          )
        ).rows;
        if (streamers.length === 0) {
          await bot.sendMessage(chatId, '⚠️ እስካሁን ምንም Streamer የለም።');
          return;
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

        await bot.sendMessage(chatId, 'ልገሳ ለመላክ Streamer ይምረጡ:', {
          reply_markup: { inline_keyboard: buttons },
        });
        return;
      }

      const steps = Math.max(1, Math.ceil(length / stepChars));
      const computedAmount = basePrice + (steps - 1) * incrementPrice;

      const {
        rows: [{ id: donationId }],
      } = await db.query(
        'INSERT INTO donations (streamer_id, donor_id, message, amount, status) VALUES ($1, $2, $3, $4, \'pending_payment\') RETURNING id',
        [streamerId, tgId, text, computedAmount]
      );

      const userPendingDonations = (await pendingDonations.get(tgId)) || [];
      await pendingDonations.set(tgId, [...userPendingDonations, { donationId, streamerId, text, chars: length, amount: computedAmount }]);
      await userStates.delete(tgId);

      const inline_keyboard = [];

      if (String(process.env.ENABLE_GEMINI_TTS).toLowerCase() === 'true') {
        inline_keyboard.push(
          [
            { text: '👩 ቁጣ ሴት', callback_data: `voice_gemini_Kore_${donationId}` },
            { text: '🧑‍🦱 ጋለ ወንድ', callback_data: `voice_gemini_Charon_${donationId}` },
          ],
          [
            { text: '👩 ደስታ ሴት', callback_data: `voice_gemini_Sulafat_${donationId}` },
            { text: '🧑‍🦱 ምሬት ወንድ', callback_data: `voice_gemini_Zubenelgenubi_${donationId}` },
          ],
          [
            { text: '👩 ንዴት ሴት', callback_data: `voice_gemini_Aoede_${donationId}` },
            { text: '🧑‍🦱 ዕልልታ ወንድ', callback_data: `voice_gemini_Enceladus_${donationId}` },
          ],
          [
            { text: '👩 ሐዘን ሴት', callback_data: `voice_gemini_Vindemiatrix_${donationId}` },
            { text: '🧑‍🦱 ብስጭት ወንድ', callback_data: `voice_gemini_Achird_${donationId}` },
          ],
          [
            { text: '👩 ጉጉት ሴት', callback_data: `voice_gemini_Despina_${donationId}` },
            { text: '🧑‍🦱 ሣቅ ወንድ', callback_data: `voice_gemini_Iapetus_${donationId}` },
          ],
        );
      }

      inline_keyboard.push([
        { text: '👩 ሴት (Wavenet)', callback_data: `voice_cloud_am-ET-Wavenet-A_${donationId}` },
        { text: '🧑‍🦱 ወንድ (Wavenet)', callback_data: `voice_cloud_am-ET-Wavenet-B_${donationId}` },
      ]);

      await bot.sendMessage(
        chatId,
        `✅ ልገሳዎ ተዘጋጅቷል!\n💬 መልዕክት: "${text}"\n💵 ዋጋ: ${computedAmount} ብር\n\n🗣 ድምፅ ይምረጡ:`,
        { reply_markup: { inline_keyboard } }
      );
      return;
    }

    if (state.step === 'recharge_custom_amount' && text) {
      const amount = parseInt(text, 10);
      if (isNaN(amount) || amount <= 0) {
        await bot.sendMessage(chatId, '❌ ትክክለኛ መጠን አይደለም። እባክዎ ቁጥር ያስገቡ።');
        return;
      }
      await userStates.set(tgId, { step: 'recharge_name', recharge_amount: amount });
      await bot.sendMessage(chatId, `✅ ${amount} ብር ተመርጧል።\n\n💰 አሁን በቴሌብር ክፍያ ላይ የተጠቀሙበትን ትክክለኛ ስም ያስገቡ:`);
      return;
    }

    if (state.step === 'recharge_name' && text) {
      const name = text.trim();
      if (name.length < 2) {
        await bot.sendMessage(chatId, '❌ ስም በጣም አጭር ነው። እባክዎ ትክክለኛ ስም ያስገቡ።');
        return;
      }
      // Preserve existing state (like recharge_amount) and update step/name
      await userStates.set(tgId, { ...state, step: 'recharge_photo', name_on_payment: name });
      await bot.sendMessage(chatId, '✅ ስምዎ ተቀብሏል።\n\n📸 እባክዎ የክፍያውን ስክሪንሾት (Screenshot) ይላኩ።');
      return;
    }

    if (state.step === 'recharge_photo' && photo) {
      const fileId = photo[photo.length - 1].file_id;
      const requestedAmount = state.recharge_amount || null;
      try {
        const user = await getUserByTelegramId(tgId);
        if (!user || user.role !== 'donor') {
          await userStates.delete(tgId);
          await bot.sendMessage(chatId, '❌ መጀመሪያ እንደ ለጋሽ መመዝገብ አለብዎት። /start ይጫኑ እና "እንደ ለጋሽ ይመዝገቡ" ይምረጡ።');
          return;
        }

        // Try to insert with requested_amount, fall back to without if column doesn't exist
        let rechargeInsert;
        try {
          rechargeInsert = await db.query(
            'INSERT INTO recharges (donor_id, name_on_payment, screenshot_file_id, status, amount, requested_amount) VALUES ($1, $2, $3, \'pending\', NULL, $4) RETURNING id',
            [tgId, state.name_on_payment, fileId, requestedAmount]
          );
        } catch (dbError) {
          // Column might not exist yet, try without it
          if (dbError.message?.includes('requested_amount')) {
            rechargeInsert = await db.query(
              'INSERT INTO recharges (donor_id, name_on_payment, screenshot_file_id, status, amount) VALUES ($1, $2, $3, \'pending\', NULL) RETURNING id',
              [tgId, state.name_on_payment, fileId]
            );
          } else {
            throw dbError;
          }
        }

        await userStates.delete(tgId);
        await bot.sendMessage(chatId, `✅ የመሙያ ጥያቄዎ ገብቷል!\n💰 የጠየቁት መጠን: ${requestedAmount || 'አልተገለጸም'} ብር\n\nአስተዳዳሪ በቅርቡ ገምግሞ ያጸድቃል።`);
        emitAdminEvent('recharge_created', {
          rechargeId: rechargeInsert.rows[0]?.id,
          donorId: tgId,
          nameOnPayment: state.name_on_payment,
          requestedAmount,
        });
      } catch (error) {
        console.error('Error creating recharge request:', error);
        await bot.sendMessage(chatId, '❌ የመሙያ ጥያቄ መፍጠር አልተቻለም።');
      }
      return;
    }

    if (state.step === 'awaiting_complaint' && text) {
      try {
        const complaintInsert = await db.query(
          'INSERT INTO complaints (telegram_id, complaint) VALUES ($1, $2) RETURNING id',
          [tgId, text.trim()]
        );
        await userStates.delete(tgId);
        
        const user = await getUserByTelegramId(tgId);
        const replyMarkup = (user && user.role === 'donor') 
          ? { inline_keyboard: [[{ text: '💰 ሌላ ልገሳ ላክ', callback_data: 'quick_donate' }]] }
          : undefined;

        await bot.sendMessage(chatId, '✅ ቅሬታዎ በተሳካ ሁኔታ ገብቷል። እናመሰግናለን!', {
          reply_markup: replyMarkup,
        });
        emitAdminEvent('complaint_created', {
          complaintId: complaintInsert.rows[0]?.id,
          telegramId: tgId,
        });
      } catch (error) {
        console.error('Error saving complaint:', error);
        await bot.sendMessage(chatId, '❌ ቅሬታዎን ማስገባት አልተቻለም። እባክዎ ቆይተው እንደገና ይሞክሩ።');
      }
    }
  });
};
