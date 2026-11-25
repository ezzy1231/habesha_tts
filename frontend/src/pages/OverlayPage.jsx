import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import io from 'socket.io-client';

// OBS Browser Source overlay: /overlay/:token
// Optional query params:
//   ?demo=1          show a sample alert every 12 s (for positioning in OBS)
//   ?position=top|center|bottom   (default bottom)
//   ?volume=0..100   (default 100)
//   ?chime=0         disable the chime before the voice
//   ?scale=0.5..2    size multiplier (default 1)

const BASE_URL = import.meta.env.VITE_BASE_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/api\/?$/, '');
const API_URL = import.meta.env.VITE_API_URL || `${BASE_URL}/api`;
const CHIME_URL = `${BASE_URL}/public/sounds/notification.mp3`;
const HOLD_AFTER_AUDIO_MS = 1800;
const NO_AUDIO_DISPLAY_MS = 8000;
const MAX_ALERT_MS = 90000;
const CONFETTI_COLORS = ['#078930', '#FCDD09', '#DA121A'];

const DEMO_ALERT = {
  id: 'demo',
  donor_name: 'Abebe',
  amount: 100,
  text: 'ሰላም! ጥሩ ስርጭት ነው፣ በርታ! 🎉',
  audio_url: null,
  demo: true,
};

function resolveAudioUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

function formatAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return String(amount ?? '');
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function playAudio(src, volume, onProgress) {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.volume = volume;
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
    const cap = setTimeout(() => { audio.pause(); finish('timeout'); }, MAX_ALERT_MS);
    audio.ontimeupdate = () => {
      if (onProgress && audio.duration > 0) onProgress(audio.currentTime / audio.duration);
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

export default function OverlayPage() {
  const { token } = useParams();
  const [params] = useSearchParams();
  const demo = params.get('demo') === '1';
  const position = ['top', 'center', 'bottom'].includes(params.get('position')) ? params.get('position') : 'bottom';
  const volume = Math.min(1, Math.max(0, Number(params.get('volume') ?? 100) / 100 || 0));
  const chime = params.get('chime') !== '0';
  const scale = Math.min(2, Math.max(0.5, Number(params.get('scale')) || 1));

  const [current, setCurrent] = useState(null);
  const [phase, setPhase] = useState('hidden'); // hidden | enter | exit
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('connecting'); // connecting | live | invalid | offline
  const [audioBlocked, setAudioBlocked] = useState(false);

  const queueRef = useRef([]);
  const seenRef = useRef(new Set());
  const runningRef = useRef(false);
  const unmountedRef = useRef(false);

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

  const runQueue = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      while (queueRef.current.length > 0 && !unmountedRef.current) {
        const item = queueRef.current.shift();
        setProgress(0);
        setCurrent(item);
        setPhase('enter');

        let played = false;
        if (chime) {
          const r = await playAudio(CHIME_URL, volume * 0.6);
          if (r === 'blocked') setAudioBlocked(true);
        }
        const src = resolveAudioUrl(item.audio_url);
        if (src) {
          let result = await playAudio(src, volume, setProgress);
          if (result === 'blocked') {
            // Keep the alert on screen until the page is clicked, then play it
            setAudioBlocked(true);
            await waitForInteraction();
            setAudioBlocked(false);
            result = await playAudio(src, volume, setProgress);
          }
          played = result === 'ended';
          if (!played) await wait(NO_AUDIO_DISPLAY_MS);
          else { setProgress(1); await wait(HOLD_AFTER_AUDIO_MS); }
        } else {
          await wait(NO_AUDIO_DISPLAY_MS);
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
  }, [chime, volume, markPlayed]);

  const enqueue = useCallback((donation) => {
    if (!donation || donation.id == null) return;
    const key = String(donation.id);
    if (key !== 'demo' && seenRef.current.has(key)) return;
    if (key !== 'demo') seenRef.current.add(key);
    queueRef.current.push(donation);
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
      enqueue(data);
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

  const confetti = useMemo(() => Array.from({ length: 28 }, (_, i) => ({
    left: `${(i * 37) % 100}%`,
    delay: `${(i % 7) * 0.06}s`,
    color: CONFETTI_COLORS[i % 3],
    drift: `${((i * 53) % 160) - 80}px`,
    rot: `${(i * 47) % 360}deg`,
  })), []);

  const justify = position === 'top' ? 'flex-start' : position === 'center' ? 'center' : 'flex-end';

  return (
    <div className="overlay-root" style={{ justifyContent: justify }}>
      <style>{OVERLAY_CSS}</style>

      {status === 'invalid' && (
        <div className="overlay-notice">Overlay link is invalid. Copy a fresh link from your Habesha TTS dashboard.</div>
      )}
      {audioBlocked && (
        <div className="overlay-notice">Audio is blocked in this browser. In OBS it plays automatically; in a normal browser click the page once.</div>
      )}

      {current && phase !== 'hidden' && (
        <div style={{ transform: `scale(${scale})`, transformOrigin: position === 'top' ? 'center top' : 'center bottom' }}>
        <div className={`alert-wrap ${phase}`} key={String(current.id)}>
          <div className="confetti">
            {confetti.map((c, i) => (
              <span key={i} style={{ left: c.left, animationDelay: c.delay, background: c.color, '--drift': c.drift, '--rot': c.rot }} />
            ))}
          </div>
          <div className="alert-card">
            <div className="flag-bar"><i /><i /><i /></div>
            <div className="alert-head">
              <span className="donor">{current.donor_name || 'Someone'}</span>
              <span className="sent">donated</span>
            </div>
            <div className="amount"><span>{formatAmount(current.amount)}</span> <small>ብር</small></div>
            {current.text && <div className="message">{current.text}</div>}
            <div className="progress"><div style={{ width: `${Math.round(progress * 100)}%` }} /></div>
          </div>
        </div>
        </div>
      )}
      <span hidden data-status={status} />
    </div>
  );
}

const OVERLAY_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Ethiopic:wght@500;700;800&display=swap');
.overlay-root{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;padding:4vh 3vw;overflow:hidden;pointer-events:none;
  font-family:'Noto Sans Ethiopic','Nyala','Abyssinica SIL','Inter',system-ui,sans-serif;}
.overlay-notice{pointer-events:auto;position:fixed;top:8px;left:8px;right:8px;background:rgba(0,0,0,.75);color:#fff;font:600 14px/1.4 system-ui;padding:8px 12px;border-radius:8px;text-align:center}
.alert-wrap{position:relative;width:min(640px,92vw);transform-origin:center bottom}
.alert-wrap.enter{animation:pop-in .7s cubic-bezier(.2,1.4,.4,1) both}
.alert-wrap.exit{animation:slide-out .6s ease-in both}
.alert-card{position:relative;overflow:hidden;border-radius:22px;padding:22px 26px 18px;color:#fff;
  background:linear-gradient(135deg,rgba(17,24,39,.92),rgba(31,41,55,.88));
  box-shadow:0 18px 50px rgba(0,0,0,.45),0 0 0 2px rgba(252,221,9,.55),0 0 40px rgba(252,221,9,.25);}
.alert-card::after{content:'';position:absolute;inset:0;background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.18) 45%,transparent 60%);
  transform:translateX(-120%);animation:shine 1.6s .5s ease-out both}
.flag-bar{display:flex;height:6px;margin:-22px -26px 16px}
.flag-bar i{flex:1}.flag-bar i:nth-child(1){background:#078930}.flag-bar i:nth-child(2){background:#FCDD09}.flag-bar i:nth-child(3){background:#DA121A}
.alert-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.donor{font-size:30px;font-weight:800;color:#FCDD09;text-shadow:0 2px 10px rgba(252,221,9,.35);word-break:break-word}
.sent{font-size:18px;opacity:.8}
.amount{margin-top:4px;font-size:46px;font-weight:800;line-height:1.1;animation:pulse 1.2s .6s ease-in-out 2}
.amount span{background:linear-gradient(90deg,#34d399,#FCDD09,#f87171);-webkit-background-clip:text;background-clip:text;color:transparent}
.amount small{font-size:24px;color:#fff;opacity:.85}
.message{margin-top:10px;font-size:24px;font-weight:500;line-height:1.45;word-break:break-word;max-height:7.4em;overflow:hidden;
  animation:fade-up .6s .35s both}
.progress{margin-top:14px;height:5px;border-radius:99px;background:rgba(255,255,255,.15);overflow:hidden}
.progress div{height:100%;background:linear-gradient(90deg,#078930,#FCDD09,#DA121A);transition:width .25s linear}
.confetti{position:absolute;left:0;right:0;bottom:60%;height:0;pointer-events:none}
.confetti span{position:absolute;bottom:0;width:9px;height:14px;border-radius:2px;opacity:0;animation:burst 1.6s ease-out both}
@keyframes pop-in{0%{opacity:0;transform:translateY(60px) scale(.6)}100%{opacity:1;transform:translateY(0) scale(1)}}
@keyframes slide-out{to{opacity:0;transform:translateY(40px) scale(.9)}}
@keyframes shine{to{transform:translateX(120%)}}
@keyframes pulse{50%{transform:scale(1.08)}}
@keyframes fade-up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes burst{0%{opacity:1;transform:translate(0,0) rotate(0)}100%{opacity:0;transform:translate(var(--drift),-220px) rotate(var(--rot))}}
`;
