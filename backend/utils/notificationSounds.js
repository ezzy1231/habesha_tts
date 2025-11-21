import { z } from 'zod';
import db from '../db-postgres.js';

let usersNotificationSoundStorageMode = null;

function coerceNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeNotificationSoundRow(row) {
  if (!row) return null;
  const slugCandidates = [row.slug, row.code, row.key, row.identifier];
  const slug = slugCandidates.find((val) => typeof val === 'string' && val.trim().length > 0)
    || (typeof row.id !== 'undefined' ? `sound_${row.id}` : null);
  const labelCandidates = [row.display_name, row.label, row.name, row.title];
  const label = labelCandidates.find((val) => typeof val === 'string' && val.trim().length > 0)
    || slug
    || (typeof row.id !== 'undefined' ? `Sound ${row.id}` : null);
  const filePath = typeof row.file_path === 'string' && row.file_path.trim().length > 0
    ? row.file_path.trim()
    : (typeof row.path === 'string' && row.path.trim().length > 0 ? row.path.trim() : null);
  const description = typeof row.description === 'string' && row.description.trim().length > 0
    ? row.description.trim()
    : null;
  const category = typeof row.category === 'string' && row.category.trim().length > 0
    ? row.category.trim()
    : 'general';
  const durationSeconds = coerceNumber(row.duration_seconds);
  const sortOrder = coerceNumber(row.sort_order);

  return {
    id: coerceNumber(row.id) ?? row.id ?? null,
    slug,
    label,
    description,
    category,
    filePath,
    durationSeconds,
    volumeBoost: coerceNumber(row.volume_boost),
    isPremium: row.is_premium === true,
    isActive: row.is_active !== false,
    sortOrder,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function sortSounds(sounds) {
  return [...sounds].sort((a, b) => {
    const orderA = Number.isFinite(a.sortOrder) ? a.sortOrder : Number.MAX_SAFE_INTEGER;
    const orderB = Number.isFinite(b.sortOrder) ? b.sortOrder : Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    if (a.label && b.label) return a.label.localeCompare(b.label);
    return (a.id || 0) - (b.id || 0);
  });
}

export async function listNotificationSounds({ includeInactive = false } = {}) {
  const res = await db.query('SELECT * FROM notification_sounds ORDER BY id ASC');
  const rows = res.rows || [];
  const normalized = rows
    .map(normalizeNotificationSoundRow)
    .filter(Boolean)
    .filter((sound) => includeInactive || sound.isActive);
  return sortSounds(normalized);
}

export async function findNotificationSound({ slug, id, value }, { includeInactive = false } = {}) {
  if (!slug && typeof id === 'undefined' && typeof value === 'undefined') {
    return null;
  }
  const catalog = await listNotificationSounds({ includeInactive: true });
  const match = catalog.find((sound) => {
    if (!sound) return false;
    if (!includeInactive && sound.isActive === false) return false;
    if (slug && sound.slug === slug) return true;
    if (typeof id !== 'undefined' && sound.id !== null && Number(sound.id) === Number(id)) return true;
    if (typeof value !== 'undefined') {
      if (typeof value === 'string' && sound.slug === value) return true;
      if (sound.id !== null && Number(sound.id) === Number(value)) return true;
    }
    return false;
  });
  return match || null;
}

export async function getNotificationSoundStorageMode() {
  if (usersNotificationSoundStorageMode) {
    return usersNotificationSoundStorageMode;
  }
  try {
    const res = await db.query(`
      SELECT data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'notification_sound'
      LIMIT 1
    `);
    const type = (res.rows?.[0]?.data_type || '').toLowerCase();
    usersNotificationSoundStorageMode = type.includes('int') ? 'id' : 'slug';
  } catch (error) {
    console.warn('[NotificationSounds] Failed to inspect users.notification_sound column type, defaulting to slug:', error?.message || error);
    usersNotificationSoundStorageMode = 'slug';
  }
  return usersNotificationSoundStorageMode;
}

export async function buildNotificationSoundStorageValue(sound) {
  if (!sound) return null;
  const mode = await getNotificationSoundStorageMode();
  if (mode === 'id') {
    return sound.id ?? null;
  }
  return sound.slug ?? (sound.id != null ? String(sound.id) : null);
}

export const notificationSoundUpdateSchema = z.object({
  soundSlug: z.string().trim().min(1).max(120).optional(),
  soundId: z.coerce.number().int().positive().optional(),
  reset: z.boolean().optional(),
}).refine((data) => data.reset === true || data.soundSlug || typeof data.soundId !== 'undefined', {
  message: 'Provide soundSlug or soundId, or set reset to true',
});
