import { resolveOverlayStreamer } from '../routes/overlay.js';

// OBS overlays currently connected, per streamer room (link_uuid -> Set<socket.id>).
// In-memory is fine while Cloud Run runs a single instance (--max-instances 1).
// If you scale out, move this to Redis (or use the socket.io Redis adapter + fetchSockets).
const overlaySockets = new Map();

export const overlayStatusFor = (room) => ({ connected: (overlaySockets.get(room)?.size || 0) > 0 });

/** Wire the overlay-related socket events for one connected client. */
export function registerOverlaySocketHandlers(io, socket) {
  socket.on('join_overlay', async (token, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    try {
      const streamer = await resolveOverlayStreamer(token);
      if (!streamer) return reply({ ok: false, error: 'invalid_token' });
      const room = streamer.link_uuid;
      socket.join(room);
      socket.data.overlayRoom = room;
      if (!overlaySockets.has(room)) overlaySockets.set(room, new Set());
      overlaySockets.get(room).add(socket.id);
      io.to(room).emit('overlay_status', overlayStatusFor(room));
      reply({ ok: true });
    } catch (error) {
      console.error('[Socket] join_overlay failed:', error?.message || error);
      reply({ ok: false, error: 'server_error' });
    }
  });

  socket.on('disconnect', () => {
    const room = socket.data.overlayRoom;
    if (!room || !overlaySockets.has(room)) return;
    overlaySockets.get(room).delete(socket.id);
    if (overlaySockets.get(room).size === 0) overlaySockets.delete(room);
    io.to(room).emit('overlay_status', overlayStatusFor(room));
  });
}
