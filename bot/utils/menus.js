// Shared "you're already registered" reply, used by /start and the role-picker callback
// so a registered user always gets a real message with next steps (not just a toast).
export const sendRegisteredMenu = async (bot, chatId, user) => {
  if (user.role === 'donor') {
    await bot.sendMessage(
      chatId,
      '✅ እንደ ለጋሽ (Donor) ተመዝግበዋል።\n\n' +
        '💰 /donate — ልገሳ ይላኩ\n' +
        '💳 /recharge — Wallet ይሙሉ\n' +
        '💼 /balance — ቀሪ ሂሳብ\n' +
        '🪪 /change_name — ስም ይቀይሩ\n' +
        '📝 /complaint — ቅሬታ / አስተያየት',
      {
        reply_markup: {
          inline_keyboard: [[{ text: '💰 ልገሳ ላክ', callback_data: 'quick_donate' }]],
        },
      }
    );
    return;
  }

  if (user.role === 'streamer') {
    const text =
      user.registration_status === 'approved'
        ? '🎮 እንደ Streamer ተመዝግበዋል። ዳሽቦርድዎን ከድረ-ገጹ ይክፈቱ።'
        : '⏳ የ Streamer ምዝገባዎ በአስተዳዳሪው በመገምገም ላይ ነው። ውጤቱ በቴሌግራም ይደርስዎታል።';
    await bot.sendMessage(chatId, text);
    return;
  }

  await bot.sendMessage(chatId, `✅ እንደ ${user.role} ተመዝግበዋል።`);
};
