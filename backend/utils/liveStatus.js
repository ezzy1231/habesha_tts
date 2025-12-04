import db from '../db-postgres.js';
import { emitAdminEvent } from './adminNotifications.js';

const AUTO_END_MINUTES = Number(process.env.STREAMER_AUTO_END_MINUTES || 5);
export const STREAMER_AUTO_END_MS = AUTO_END_MINUTES * 60 * 1000;
const HEARTBEAT_RECHECK_GRACE_MS = Number(process.env.STREAMER_AUTO_END_GRACE_MS || 15000);

const watchdogTimers = new Map(); // streamerId -> timeout
const linkUuidCache = new Map();  // linkUuid -> streamerRow

const baseSelect = `
  SELECT telegram_id, username, full_name, link_uuid,
         live_status, live_since, last_live_ping
    FROM users
   WHERE role = 'streamer'
`;

function normalizeStreamerRow(row) {
  if (!row) return null;
  return {
    telegram_id: row.telegram_id,
    username: row.username,
    full_name: row.full_name,
    link_uuid: row.link_uuid,
    live_status: Boolean(row.live_status),
    live_since: row.live_since,
    last_live_ping: row.last_live_ping,
  };
}

function getIo(ioOverride) {
  return ioOverride || global.socketIO || null;
}

function emitLiveStatus(payload, ioOverride) {
  const io = getIo(ioOverride);
  if (io) {
    if (payload.linkUuid) {
      io.to(payload.linkUuid).emit('streamer_live_status', payload);
    }
    io.to('admin').emit('streamer_live_status', payload);
  }
  emitAdminEvent('streamer_live_status', payload);
}

function stopWatchdog(streamerId) {
  const timer = watchdogTimers.get(streamerId);
  if (timer) {
    clearTimeout(timer);
    watchdogTimers.delete(streamerId);
  }
}

function scheduleWatchdog(streamer, ioOverride) {
  if (!streamer?.telegram_id) return;
  stopWatchdog(streamer.telegram_id);
  const timer = setTimeout(() => runWatchdogCheck(streamer.telegram_id, ioOverride), STREAMER_AUTO_END_MS + HEARTBEAT_RECHECK_GRACE_MS);
  watchdogTimers.set(streamer.telegram_id, timer);
}

async function runWatchdogCheck(streamerId, ioOverride) {
  try {
    const { rows } = await db.query(`${baseSelect} AND telegram_id = $1`, [streamerId]);
    const streamer = normalizeStreamerRow(rows[0]);
    if (!streamer || !streamer.live_status) {
      stopWatchdog(streamerId);
      return;
    }
    const lastPing = streamer.last_live_ping ? new Date(streamer.last_live_ping).getTime() : 0;
    if (!lastPing || Date.now() - lastPing < STREAMER_AUTO_END_MS) {
      scheduleWatchdog(streamer, ioOverride);
      return;
    }
    await setStreamerLiveState({
      streamerId,
      isLive: false,
      reason: 'auto_end',
      triggeredBy: 'watchdog',
      io: ioOverride,
    });
  } catch (error) {
    console.error('[LiveStatus] Watchdog check failed:', error);
    scheduleWatchdog({ telegram_id: streamerId, live_status: true }, ioOverride);
  }
}

async function notifyStreamerAutoEnd(streamer) {
  try {
    const { bot } = await import('../../bot/bot.js');
    if (bot && streamer?.telegram_id) {
      await bot.sendMessage(
        String(streamer.telegram_id),
        '⚠️ We ended your HabeshaTTS live session after losing the dashboard connection for 5 minutes. Tap "Go Live" again once you are back.'
      );
    }
  } catch (error) {
    console.error('[LiveStatus] Failed to notify streamer about auto-end:', error?.message || error);
  }
}

export async function fetchStreamerByLinkUuid(linkUuid) {
  if (!linkUuid) return null;
  if (linkUuidCache.has(linkUuid)) {
    return linkUuidCache.get(linkUuid);
  }
  const { rows } = await db.query(`${baseSelect} AND link_uuid = $1`, [linkUuid]);
  const streamer = normalizeStreamerRow(rows[0]);
  if (streamer) {
    linkUuidCache.set(linkUuid, streamer);
  }
  return streamer;
}

export async function fetchStreamerById(streamerId) {
  if (!streamerId) return null;
  const { rows } = await db.query(`${baseSelect} AND telegram_id = $1`, [streamerId]);
  return normalizeStreamerRow(rows[0]);
}

export async function setStreamerLiveState({ streamerId, isLive, reason = 'manual', triggeredBy = 'dashboard', io }) {
  const current = await fetchStreamerById(streamerId);
  if (!current) {
    return { changed: false, streamer: null };
  }
  if (Boolean(current.live_status) === Boolean(isLive)) {
    const payload = buildPayload(current, { reason, triggeredBy, changed: false });
    return { changed: false, streamer: current, payload };
  }

  const now = new Date();
  const { rows } = await db.query(
    `UPDATE users
        SET live_status = $1,
            live_since = CASE WHEN $1 THEN COALESCE(live_since, $2::timestamptz) ELSE NULL END,
            last_live_ping = CASE WHEN $1 THEN $3::timestamptz ELSE NULL END
      WHERE telegram_id = $4
      RETURNING telegram_id, username, full_name, link_uuid, live_status, live_since, last_live_ping`,
    [Boolean(isLive), now, now, streamerId]
  );
  const updated = normalizeStreamerRow(rows[0]);
  if (!updated) {
    return { changed: false, streamer: null };
  }
  if (updated.link_uuid) {
    linkUuidCache.set(updated.link_uuid, updated);
  }

  if (updated.live_status) {
    scheduleWatchdog(updated, io);
  } else {
    stopWatchdog(streamerId);
    if (reason === 'auto_end') {
      await notifyStreamerAutoEnd(updated);
    }
  }

  const payload = buildPayload(updated, { reason, triggeredBy, changed: true });
  emitLiveStatus(payload, io);
  return { changed: true, streamer: updated, payload };
}

export async function recordStreamerHeartbeat({ linkUuid, io }) {
  if (!linkUuid) return null;
  const streamer = await fetchStreamerByLinkUuid(linkUuid);
  if (!streamer) return null;
  const { rows } = await db.query(
    `UPDATE users
        SET last_live_ping = NOW()
      WHERE telegram_id = $1
      RETURNING telegram_id, username, full_name, link_uuid, live_status, live_since, last_live_ping`,
    [streamer.telegram_id]
  );
  const updated = normalizeStreamerRow(rows[0]);
  if (updated?.link_uuid) {
    linkUuidCache.set(updated.link_uuid, updated);
  }
  if (updated?.live_status) {
    scheduleWatchdog(updated, io);
  }
  return updated;
}

function buildPayload(streamer, { reason, triggeredBy, changed }) {
  return {
    streamerId: streamer.telegram_id,
    linkUuid: streamer.link_uuid,
    username: streamer.username,
    fullName: streamer.full_name,
    liveStatus: Boolean(streamer.live_status),
    liveSince: streamer.live_since,
    lastLivePing: streamer.last_live_ping,
    reason,
    triggeredBy,
    changed,
    autoEndMinutes: AUTO_END_MINUTES,
  };
}

export function resetLiveStatusCaches() {
  watchdogTimers.forEach((timer) => clearTimeout(timer));
  watchdogTimers.clear();
  linkUuidCache.clear();
}
