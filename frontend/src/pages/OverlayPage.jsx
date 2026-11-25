import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import io from 'socket.io-client';

// OBS Browser Source overlay: /overlay/:token
// Look and sound come from the streamer's dashboard (Overlay page) and update live.
// Query params still work and win over the saved settings:
//   ?demo=1                      show a sample alert every 12 s (for positioning in OBS)
//   ?position=top|center|bottom  ?volume=0..100  ?chime=0|1  ?scale=0.5..2

const BASE_URL = import.meta.env.VITE_BASE_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/api\/?$/, '');
const API_URL = import.meta.env.VITE_API_URL || `${BASE_URL}/api`;
const CHIME_URL = `${BASE_URL}/public/sounds/notification.mp3`;
const HOLD_AFTER_AUDIO_MS = 1800;
const MAX_ALERT_MS = 90000;
const MAX_SOUND_MS = 10000; // soundboard clips never play longer than this
const MEDIA_LOAD_GRACE_MS = 15000;
const FLAG_COLORS = ['#078930', '#FCDD09', '#DA121A'];

const DEFAULT_CONFIG = {
  theme: 'habesha', position: 'bottom', durationMs: 9000, chime: true, volume: 1, scale: 1,
  imageUrl: null, tiers: [], mediaMaxSeconds: 60,
};

const DEMO_ALERT = {
  id: 'demo', kind: 'tts', donor_name: 'Abebe', amount: 100, text: 'ሰላም! ጥሩ ስርጭት ነው፣ በርታ! 🎉', audio_url: null, demo: true,
};

function resolveAudioUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

const safeHttps = (u) => (typeof u === 'string' && /^https:\/\/\S+$/i.test(u) ? u : null);

function formatAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return String(amount ?? '');
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function playAudio(src, volume, { onProgress, maxMs = MAX_ALERT_MS } = {}) {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.volume = Math.min(1, Math.max(0, volume));
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      clearTimeout(cap);
      audio.ontimeupdate = null;
      audio.onended = null;
      audio.onerror = null;
      resolve(result);
    };
    const cap = setTimeout(() => { audio.pause(); finish(maxMs < MAX_ALERT_MS ? 'ended' : 'timeout'); }, maxMs);
    audio.ontimeupdate = () => {
      if (!onProgress) return;
      const total = Math.min(audio.duration || 0, maxMs / 1000);
      if (total > 0) onProgress(Math.min(1, audio.currentTime / total));
    };
    audio.onended = () => finish('ended');
    audio.onerror = () => finish('error');
    audio.src = src;
    const p = audio.play();
    if (p && typeof p.catch === 'function') {
      p.catch((err) => finish(err?.name === 'NotAllowedError' ? 'blocked' : 'error'));
    }
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Resolves on the next click/key press (only needed outside OBS, where autoplay can be blocked)
const waitForInteraction = () => new Promise((resolve) => {
  const done = () => {
    window.removeEventListener('pointerdown', done);
    window.removeEventListener('keydown', done);
    resolve();
  };
  window.addEventListener('pointerdown', done);
  window.addEventListener('keydown', done);
});

let ytApiPromise = null;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!ytApiPromise) {
    ytApiPromise = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.async = true;
      s.onerror = () => { ytApiPromise = null; reject(new Error('YouTube API failed to load')); };
      document.head.appendChild(s);
    });
  }
  return ytApiPromise;
}

/** Plays a YouTube video inside `host` from `start` for at most `maxSeconds`. Resolves when it stops. */
async function playYouTube(host, { videoId, start, maxSeconds, volume, onProgress }) {
  if (!host) return 'error';
  let YT;
  try { YT = await loadYouTubeApi(); } catch { return 'error'; }
  return new Promise((resolve) => {
    const el = document.createElement('div');
    host.appendChild(el);
    let player = null;
    let done = false;
    let ticker = null;
    let stopTimer = null;
    const finish = (result) => {
      if (done) return;
      done = true;
      clearTimeout(loadCap);
      clearTimeout(stopTimer);
      clearInterval(ticker);
      try { player?.stopVideo(); player?.destroy(); } catch { /* already gone */ }
      host.innerHTML = '';
      resolve(result);
    };
    // Never hang the queue: a video that never starts gives up after the grace period.
    const loadCap = setTimeout(() => finish('timeout'), MEDIA_LOAD_GRACE_MS + maxSeconds * 1000);
    player = new YT.Player(el, {
      width: '100%',
      height: '100%',
      videoId,
      playerVars: { autoplay: 1, start, controls: 0, disablekb: 1, fs: 0, modestbranding: 1, rel: 0, playsinline: 1, iv_load_policy: 3 },
      events: {
        onReady: (e) => { e.target.setVolume(Math.round(volume * 100)); e.target.playVideo(); },
        onStateChange: (e) => {
          if (e.data === YT.PlayerState.PLAYING && !stopTimer) {
            const startedAt = Date.now();
            stopTimer = setTimeout(() => finish('ended'), maxSeconds * 1000);
            ticker = setInterval(() => onProgress?.(Math.min(1, (Date.now() - startedAt) / (maxSeconds * 1000))), 250);
          }
          if (e.data === YT.PlayerState.ENDED) finish('ended');
        },
        onError: () => finish('error'),
      },
    });
  });
}

/** Highest tier the amount reaches, or null. */
function tierFor(amount, tiers) {
  const n = Number(amount) || 0;
  return [...(tiers || [])].sort((a, b) => b.minAmount - a.minAmount).find((t) => n >= t.minAmount) || null;
}

/** Socket and API payloads come in two shapes; the queue uses one. */
function normalize(item) {
  if (!item || item.id == null) return null;
  return {
    id: item.id,
    kind: item.kind || 'tts',
    donor_name: item.donor_name ?? item.donorName ?? null,
    amount: item.amount,
    text: item.text ?? item.message ?? null,
    title: item.title ?? null,
    audio_url: item.audio_url ?? null,
    video_id: item.video_id ?? item.videoId ?? null,
    start: Number(item.start || 0),
    maxSeconds: item.maxSeconds ? Number(item.maxSeconds) : null,
    is_demo: Boolean(item.is_demo ?? item.isDemo),
    demo: Boolean(item.demo),
  };
}

export default function OverlayPage() {
  const { token } = useParams();
  const [params] = useSearchParams();
  const demo = params.get('demo') === '1';

  const [saved, setSaved] = useState(DEFAULT_CONFIG);
  const config = useMemo(() => {
    const c = { ...DEFAULT_CONFIG, ...saved };
    const pos = params.get('position');
    if (['top', 'center', 'bottom'].includes(pos)) c.position = pos;
    if (params.get('volume') !== null) c.volume = Math.min(1, Math.max(0, Number(params.get('volume')) / 100 || 0));
    if (params.get('chime') === '0') c.chime = false;
    if (params.get('chime') === '1') c.chime = true;
    if (params.get('scale')) c.scale = Math.min(2, Math.max(0.5, Number(params.get('scale')) || 1));
    return c;
  }, [saved, params]);
  const configRef = useRef(config);
  configRef.current = config;

  const [current, setCurrent] = useState(null);
  const [phase, setPhase] = useState('hidden'); // hidden | enter | exit
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('connecting'); // connecting | live | invalid | offline
  const [audioBlocked, setAudioBlocked] = useState(false);

  const queueRef = useRef([]);
  const seenRef = useRef(new Set());
  const rejectedRef = useRef(new Set());
  const runningRef = useRef(false);
  const unmountedRef = useRef(false);
  const mediaHostRef = useRef(null);

  // Transparent page for OBS, whatever the app theme says
  useEffect(() => {
    const els = [document.documentElement, document.body, document.getElementById('root')];
    els.forEach((el) => el && el.style.setProperty('background', 'transparent', 'important'));
    document.title = 'Habesha TTS Overlay';
    return () => els.forEach((el) => el && el.style.removeProperty('background'));
  }, []);

  const markPlayed = useCallback(async (id) => {
    if (!id || id === 'demo') return;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const res = await fetch(`${API_URL}/overlay/${encodeURIComponent(token)}/donations/${id}/played`, { method: 'POST' });
        if (res.ok || res.status === 404) return;
      } catch { /* retry */ }
      await wait(1000 * (attempt + 1));
    }
  }, [token]);

  /** Plays one audio file, waiting for a click if the browser blocks autoplay. */
  const playWithUnblock = useCallback(async (src, volume, opts) => {
    let result = await playAudio(src, volume, opts);
    if (result === 'blocked') {
      setAudioBlocked(true);
      await waitForInteraction();
      setAudioBlocked(false);
      result = await playAudio(src, volume, opts);
    }
    return result;
  }, []);

  const runQueue = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      while (queueRef.current.length > 0 && !unmountedRef.current) {
        const item = queueRef.current.shift();
        if (rejectedRef.current.has(String(item.id))) continue;
        const cfg = configRef.current;
        setProgress(0);
        setCurrent(item);
        setPhase('enter');

        if (item.kind === 'media' && item.video_id) {
          const maxSeconds = Math.max(5, item.maxSeconds || cfg.mediaMaxSeconds || 60);
          await wait(500); // let the card animate in
          await playYouTube(mediaHostRef.current, { videoId: item.video_id, start: item.start, maxSeconds, volume: cfg.volume, onProgress: setProgress });
          setProgress(1);
          await wait(600);
        } else if (item.kind === 'sound') {
          const src = resolveAudioUrl(item.audio_url);
          const result = src ? await playWithUnblock(src, cfg.volume, { onProgress: setProgress, maxMs: MAX_SOUND_MS }) : 'error';
          await wait(result === 'ended' ? 900 : 3000);
        } else {
          if (cfg.chime) {
            const r = await playAudio(CHIME_URL, cfg.volume * 0.6);
            if (r === 'blocked') setAudioBlocked(true);
          }
          const src = resolveAudioUrl(item.audio_url);
          const result = src ? await playWithUnblock(src, cfg.volume, { onProgress: setProgress }) : 'none';
          if (result === 'ended') { setProgress(1); await wait(HOLD_AFTER_AUDIO_MS); } else await wait(cfg.durationMs);
        }

        setPhase('exit');
        await wait(650);
        setPhase('hidden');
        setCurrent(null);
        // The alert was shown on stream (and voiced when audio loaded), so don't repeat it.
        markPlayed(item.id);
        await wait(400);
      }
    } finally {
      runningRef.current = false;
    }
  }, [markPlayed, playWithUnblock]);

  const enqueue = useCallback((raw) => {
    const item = normalize(raw);
    if (!item) return;
    const key = String(item.id);
    if (key !== 'demo' && (seenRef.current.has(key) || rejectedRef.current.has(key))) return;
    if (key !== 'demo') seenRef.current.add(key);
    queueRef.current.push(item);
    runQueue();
  }, [runQueue]);

  // Load donations that arrived while the overlay was closed, then go live
  useEffect(() => {
    unmountedRef.current = false;
    const socket = io(BASE_URL, { transports: ['websocket'], reconnection: true, reconnectionDelayMax: 10000 });

    const loadPending = async () => {
      try {
        const res = await fetch(`${API_URL}/overlay/${encodeURIComponent(token)}`);
        if (res.status === 404) { setStatus('invalid'); return false; }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.config) setSaved((s) => ({ ...s, ...data.config }));
        (data.pending || []).forEach(enqueue);
        return true;
      } catch (err) {
        console.error('[overlay] failed to load pending donations', err);
        return true; // still try the socket
      }
    };

    const join = () => {
      socket.emit('join_overlay', token, (reply) => {
        if (reply?.ok) setStatus('live');
        else if (reply?.error === 'invalid_token') setStatus('invalid');
      });
    };

    loadPending().then((ok) => { if (ok) { socket.on('connect', () => { join(); loadPending(); }); if (socket.connected) join(); } });
    socket.on('disconnect', () => setStatus('offline'));
    socket.on('new_donation', (data) => {
      if (data && data.status && data.status !== 'paid') return;
      if (data?.kind === 'media') return; // media waits for approval and arrives as media_play
      enqueue(data);
    });
    socket.on('media_play', (data) => enqueue({ ...data, kind: 'media' }));
    socket.on('media_rejected', (data) => {
      if (data?.id == null) return;
      rejectedRef.current.add(String(data.id));
      queueRef.current = queueRef.current.filter((i) => String(i.id) !== String(data.id));
    });
    socket.on('overlay_config_updated', (data) => {
      if (data?.overlay) setSaved((s) => ({ ...s, ...data.overlay }));
    });

    return () => {
      unmountedRef.current = true;
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [token, enqueue]);

  // Demo mode for positioning the source in OBS
  useEffect(() => {
    if (!demo) return undefined;
    enqueue({ ...DEMO_ALERT });
    const t = setInterval(() => {
      if (!runningRef.current) enqueue({ ...DEMO_ALERT });
    }, 12000);
    return () => clearInterval(t);
  }, [demo, enqueue]);

  const tier = current ? tierFor(current.amount, config.tiers) : null;
  const effect = tier?.effect || (config.theme === 'habesha' && current?.kind === 'tts' ? 'confetti' : 'none');
  const accent = tier?.color || null;
  const image = safeHttps(tier?.imageUrl) || safeHttps(config.imageUrl);

  const particles = useMemo(() => Array.from({ length: 28 }, (_, i) => ({
    left: `${(i * 37) % 100}%`,
    delay: `${(i % 7) * 0.06}s`,
    color: FLAG_COLORS[i % 3],
    drift: `${((i * 53) % 160) - 80}px`,
    rot: `${(i * 47) % 360}deg`,
    angle: `${(i * 360) / 28}deg`,
  })), []);

  const justify = config.position === 'top' ? 'flex-start' : config.position === 'center' ? 'center' : 'flex-end';
  const isMedia = current?.kind === 'media';
  const isSound = current?.kind === 'sound';
  const isDemoItem = current && (current.is_demo || current.demo);

  return (
    <div className="overlay-root" style={{ justifyContent: justify }}>
      <style>{OVERLAY_CSS}</style>

      {status === 'invalid' && (
        <div className="overlay-notice">Overlay link is invalid. Copy a fresh link from your Habesha TTS dashboard.</div>
      )}
      {audioBlocked && (
        <div className="overlay-notice">Audio is blocked in this browser. In OBS it plays automatically; in a normal browser click the page once.</div>
      )}

      <div style={{ transform: `scale(${config.scale})`, transformOrigin: config.position === 'top' ? 'center top' : 'center bottom' }}>
        {current && phase !== 'hidden' && (
          <div
            className={`alert-wrap ${phase} theme-${config.theme} ${isSound ? 'compact' : ''} ${effect === 'shake' && phase === 'enter' ? 'shake' : ''}`}
            key={String(current.id)}
            style={accent ? { '--accent': accent } : undefined}
          >
            {effect === 'confetti' && (
              <div className="confetti">
                {particles.map((c, i) => (
                  <span key={i} style={{ left: c.left, animationDelay: c.delay, background: c.color, '--drift': c.drift, '--rot': c.rot }} />
                ))}
              </div>
            )}
            {effect === 'fireworks' && (
              <div className="fireworks">
                {[0, 1, 2].map((b) => (
                  <div key={b} className="burst" style={{ left: `${20 + b * 30}%`, animationDelay: `${b * 0.35}s` }}>
                    {particles.slice(0, 14).map((c, i) => (
                      <i key={i} style={{ '--angle': `${(i * 360) / 14}deg`, background: accent || c.color, animationDelay: `${b * 0.35}s` }} />
                    ))}
                  </div>
                ))}
              </div>
            )}
            {image && !isSound && <img className="alert-image" src={image} alt="" referrerPolicy="no-referrer" />}
            <div className="alert-card">
              {config.theme === 'habesha' && <div className="flag-bar"><i /><i /><i /></div>}
              {isDemoItem && <span className="demo-tag">DEMO</span>}
              <div className="alert-head">
                <span className="donor">{current.donor_name || 'Someone'}</span>
                <span className="sent">{isSound ? 'played' : isMedia ? 'shared a video' : 'donated'}</span>
                {isSound && <span className="sound-label">{current.text}</span>}
              </div>
              {!isSound && <div className="amount"><span>{formatAmount(current.amount)}</span> <small>ብር</small></div>}
              {isMedia && (
                <>
                  {current.title && <div className="media-title">{current.title}</div>}
                  <div className="media-frame" ref={mediaHostRef} />
                </>
              )}
              {!isSound && current.text && <div className="message">{current.text}</div>}
              <div className="progress"><div style={{ width: `${Math.round(progress * 100)}%` }} /></div>
            </div>
          </div>
        )}
      </div>
      <span hidden data-status={status} />
    </div>
  );
}

const OVERLAY_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Ethiopic:wght@500;700;800&display=swap');
.overlay-root{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;padding:4vh 3vw;overflow:hidden;pointer-events:none;
  font-family:'Noto Sans Ethiopic','Nyala','Abyssinica SIL','Inter',system-ui,sans-serif;}
.overlay-notice{pointer-events:auto;position:fixed;top:8px;left:8px;right:8px;background:rgba(0,0,0,.75);color:#fff;font:600 14px/1.4 system-ui;padding:8px 12px;border-radius:8px;text-align:center}
.alert-wrap{--accent:#FCDD09;position:relative;width:min(640px,92vw);transform-origin:center bottom;display:flex;flex-direction:column;align-items:center}
.alert-wrap.compact{width:min(440px,92vw)}
.alert-wrap.enter{animation:pop-in .7s cubic-bezier(.2,1.4,.4,1) both}
.alert-wrap.enter.shake{animation:pop-in .7s cubic-bezier(.2,1.4,.4,1) both,shake .5s .7s ease-in-out 2}
.alert-wrap.exit{animation:slide-out .6s ease-in both}
.alert-image{max-width:260px;max-height:200px;object-fit:contain;margin-bottom:-6px;filter:drop-shadow(0 10px 24px rgba(0,0,0,.45))}
.alert-card{position:relative;width:100%;box-sizing:border-box;overflow:hidden;border-radius:22px;padding:22px 26px 18px;color:#fff;
  background:linear-gradient(135deg,rgba(17,24,39,.92),rgba(31,41,55,.88));
  box-shadow:0 18px 50px rgba(0,0,0,.45),0 0 0 2px color-mix(in srgb,var(--accent) 60%,transparent),0 0 40px color-mix(in srgb,var(--accent) 28%,transparent);}
.compact .alert-card{padding:14px 20px 12px;border-radius:16px}
.alert-card::after{content:'';position:absolute;inset:0;background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.18) 45%,transparent 60%);
  transform:translateX(-120%);animation:shine 1.6s .5s ease-out both;pointer-events:none}
.flag-bar{display:flex;height:6px;margin:-22px -26px 16px}
.compact .flag-bar{margin:-14px -20px 10px;height:4px}
.flag-bar i{flex:1}.flag-bar i:nth-child(1){background:#078930}.flag-bar i:nth-child(2){background:#FCDD09}.flag-bar i:nth-child(3){background:#DA121A}
.demo-tag{position:absolute;top:12px;right:14px;font:800 11px/1 system-ui;letter-spacing:.12em;color:#111;background:#FCDD09;padding:4px 7px;border-radius:6px}
.alert-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.donor{font-size:30px;font-weight:800;color:var(--accent);text-shadow:0 2px 10px color-mix(in srgb,var(--accent) 35%,transparent);word-break:break-word}
.compact .donor{font-size:22px}
.sent{font-size:18px;opacity:.8}
.sound-label{font-size:22px;font-weight:700}
.amount{margin-top:4px;font-size:46px;font-weight:800;line-height:1.1;animation:pulse 1.2s .6s ease-in-out 2}
.amount span{background:linear-gradient(90deg,#34d399,#FCDD09,#f87171);-webkit-background-clip:text;background-clip:text;color:transparent}
.amount small{font-size:24px;color:#fff;opacity:.85}
.media-title{margin-top:6px;font-size:18px;font-weight:600;opacity:.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.media-frame{margin-top:12px;aspect-ratio:16/9;width:100%;border-radius:12px;overflow:hidden;background:#000}
.media-frame iframe{width:100%;height:100%;border:0;display:block}
.message{margin-top:10px;font-size:24px;font-weight:500;line-height:1.45;word-break:break-word;max-height:7.4em;overflow:hidden;
  animation:fade-up .6s .35s both}
.progress{margin-top:14px;height:5px;border-radius:99px;background:rgba(255,255,255,.15);overflow:hidden}
.compact .progress{margin-top:10px;height:4px}
.progress div{height:100%;background:linear-gradient(90deg,#078930,#FCDD09,#DA121A);transition:width .25s linear}
.theme-minimal .alert-card{background:rgba(10,10,10,.82);box-shadow:0 12px 30px rgba(0,0,0,.4),0 0 0 1px rgba(255,255,255,.12)}
.theme-minimal .alert-card::after{display:none}
.theme-minimal .amount span{background:none;color:#fff}
.theme-minimal .progress div{background:var(--accent)}
.theme-neon .alert-card{background:linear-gradient(135deg,rgba(24,8,48,.92),rgba(8,24,48,.9));
  box-shadow:0 0 0 2px var(--accent),0 0 28px var(--accent),inset 0 0 24px color-mix(in srgb,var(--accent) 25%,transparent)}
.theme-neon .amount span{background:none;color:#fff;text-shadow:0 0 12px var(--accent),0 0 24px var(--accent)}
.theme-neon .progress div{background:var(--accent);box-shadow:0 0 10px var(--accent)}
.confetti{position:absolute;left:0;right:0;bottom:60%;height:0;pointer-events:none;z-index:2}
.confetti span{position:absolute;bottom:0;width:9px;height:14px;border-radius:2px;opacity:0;animation:burst 1.6s ease-out both}
.fireworks{position:absolute;left:0;right:0;top:-40px;height:0;pointer-events:none;z-index:2}
.fireworks .burst{position:absolute;top:0}
.fireworks i{position:absolute;width:6px;height:6px;border-radius:50%;opacity:0;animation:firework 1.3s ease-out both}
@keyframes pop-in{0%{opacity:0;transform:translateY(60px) scale(.6)}100%{opacity:1;transform:translateY(0) scale(1)}}
@keyframes slide-out{to{opacity:0;transform:translateY(40px) scale(.9)}}
@keyframes shine{to{transform:translateX(120%)}}
@keyframes pulse{50%{transform:scale(1.08)}}
@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-10px) rotate(-1deg)}40%{transform:translateX(10px) rotate(1deg)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}
@keyframes fade-up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes burst{0%{opacity:1;transform:translate(0,0) rotate(0)}100%{opacity:0;transform:translate(var(--drift),-220px) rotate(var(--rot))}}
@keyframes firework{0%{opacity:1;transform:rotate(var(--angle)) translateX(0)}100%{opacity:0;transform:rotate(var(--angle)) translateX(110px)}}
`;
