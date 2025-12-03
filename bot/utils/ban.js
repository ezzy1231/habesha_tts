const ETHIOPIA_TZ = 'Africa/Addis_Ababa';

export function isDonorBanned(user) {
  if (!user || user.role !== 'donor') return false;
  if (!user.is_banned) return false;
  if (user.ban_expires_at) {
    const expires = new Date(user.ban_expires_at);
    if (Number.isNaN(expires.getTime())) return true;
    if (expires <= new Date()) return false;
  }
  return true;
}

export function formatBanExpiry(expiresAt) {
  if (!expiresAt) return 'ቋሚ (permanent)';
  try {
    return new Intl.DateTimeFormat('am-ET', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: ETHIOPIA_TZ,
    }).format(new Date(expiresAt));
  } catch (error) {
    return new Date(expiresAt).toISOString();
  }
}

export function buildBanMessage(user) {
  const reason = user?.ban_reason ? `• ምክንያት: ${user.ban_reason}` : '• ምክንያት: አስተዳዳሪ ተወስኖበታል';
  const expiry = user?.ban_expires_at ? `• ስርዓቱ እስከ: ${formatBanExpiry(user.ban_expires_at)}` : '• ስርዓቱ ቋሚ ነው';
  return [
    '⛔ መለያዎ በጊዜያዊ ገደብ ላይ ነው።',
    reason,
    expiry,
    '\nእባክዎ ለተጨማሪ መረጃ ከ Admin ጋር ይነጋገሩ።'
  ].join('\n');
}
