export function emitAdminEvent(type, payload = {}) {
  if (!type) {
    console.warn('[AdminNotify] Missing event type, skipping emit.');
    return;
  }

  if (!global.socketIO) {
    console.warn(`[AdminNotify] socketIO not initialized. Event "${type}" was not emitted.`);
    return;
  }

  const event = {
    type,
    payload,
    timestamp: new Date().toISOString(),
  };

  try {
    global.socketIO.to('admin').emit('admin_update', event);
  } catch (error) {
    console.error('[AdminNotify] Failed to emit admin event:', error);
  }
}
