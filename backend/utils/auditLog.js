import db from '../db-postgres.js';

export async function logOtpAction({ telegram_id, action, status, error_message = null, ip_address = null, user_agent = null }) {
  try {
    await db.query(
      `INSERT INTO otp_audit_logs (telegram_id, action, status, error_message, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [telegram_id || null, action || null, status || null, error_message || null, ip_address || null, user_agent || null]
    );
  } catch (e) {
    // best-effort logging
    console.warn('[AuditLog] Failed to write audit log:', e?.message || e);
  }
}
