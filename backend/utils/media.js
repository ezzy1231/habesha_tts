// YouTube links for media share. Only YouTube hosts are accepted; the video id is extracted and
// everything else in the URL is dropped, so nothing the viewer typed reaches the overlay as-is.

const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'www.youtu.be', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);
const ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** "1h2m3s", "90", "1:30" -> seconds */
export function parseTimestamp(t) {
  if (t === null || t === undefined || t === '') return 0;
  const s = String(t).trim();
  if (/^\d+$/.test(s)) return Number(s);
  const hms = s.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (hms && (hms[1] || hms[2] || hms[3])) return Number(hms[1] || 0) * 3600 + Number(hms[2] || 0) * 60 + Number(hms[3] || 0);
  const colon = s.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
  if (colon) return Number(colon[1] || 0) * 3600 + Number(colon[2]) * 60 + Number(colon[3]);
  return 0;
}

/** @returns {{videoId: string, start: number, url: string} | null} */
export function parseYouTubeUrl(input) {
  let u;
  try {
    const raw = String(input || '').trim();
    u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(u.protocol) || !HOSTS.has(u.hostname.toLowerCase())) return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  const parts = u.pathname.split('/').filter(Boolean);
  let id = null;
  if (host === 'youtu.be') id = parts[0];
  else if (parts[0] === 'watch') id = u.searchParams.get('v');
  else if (['shorts', 'embed', 'live', 'v'].includes(parts[0])) id = parts[1];
  if (!id || !ID_RE.test(id)) return null;
  const start = Math.min(parseTimestamp(u.searchParams.get('t') || u.searchParams.get('start')), 36000);
  return { videoId: id, start, url: `https://www.youtube.com/watch?v=${id}` };
}

/**
 * Ask YouTube whether the video exists and allows embedding (oEmbed answers 401/403 for
 * embedding disabled and 404 for missing/private). Network trouble is not the viewer's fault.
 * @returns {Promise<{ok: true, title: string|null} | {ok: false, error: string}>}
 */
export async function checkYouTubeVideo(videoId, { fetchImpl = fetch } = {}) {
  try {
    const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`;
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(5000) });
    if (res.status === 401 || res.status === 403) return { ok: false, error: "That video can't be played outside YouTube" };
    if (res.status === 404 || res.status === 400) return { ok: false, error: 'Video not found (it may be private)' };
    if (!res.ok) return { ok: true, title: null };
    const json = await res.json().catch(() => ({}));
    return { ok: true, title: typeof json.title === 'string' ? json.title.slice(0, 200) : null };
  } catch {
    return { ok: true, title: null };
  }
}
