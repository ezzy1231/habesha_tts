import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import io from "socket.io-client";
import DonationCard from "../components/DonationCard";
import Pagination from "../components/Pagination";
import Balance from "../components/Balance";
import ThemeToggle from '../components/ThemeToggle';
import LoadingSpinner from '../components/LoadingSpinner';
import SkeletonLoader from '../components/SkeletonLoader';

import ApiKeyModal from '../components/ApiKeyModal';
import { useAuth } from '../contexts/AuthContext';

const SOCKET_URL = import.meta.env.VITE_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000';
const socket = io(SOCKET_URL, {
  transports: ["websocket"],
  autoConnect: true,
  reconnection: false, // we handle backoff + retries manually for finer control
  forceNew: false,
});
const FLAG_ACTION_LABELS = {
  temp_ban: 'Time Ban',
  permanent_ban: 'Ban Donor',
  unban_request: 'Unban Request',
};
const DEFAULT_NOTIFICATION_SOUND_URL = `${SOCKET_URL}/public/sounds/notification.mp3`;
const ALTERNATE_NOTIFICATION_SOUND_URL = `${SOCKET_URL}/public/sounds/Notifications.mp3`;
const FALLBACK_NOTIFICATION_SOUND_URL = `${SOCKET_URL}/public/audios/notification.mp3`;
const FALLBACK_NOTIFICATION_SOUNDS = [
  {
    id: 1,
    slug: 'default_bell',
    label: 'Default Bell',
    description: 'Classic alert bell',
    filePath: '/public/sounds/notification.mp3',
    isFallback: true,
  },
  {
    id: 2,
    slug: 'sound_soft_bell',
    label: 'Soft Bell',
    description: 'Gentle alternate bell',
    filePath: '/public/sounds/Notifications.mp3',
    isFallback: true,
  },
];
const LOCAL_NOTIFICATION_SOUND_KEY = 'streamer_notification_sound_choice';
const INITIAL_RECONNECT_DELAY_MS = Number(import.meta.env.VITE_STREAMER_RECONNECT_MIN_MS || 1000);
const MAX_RECONNECT_DELAY_MS = Number(import.meta.env.VITE_STREAMER_RECONNECT_MAX_MS || 30000);
const HEARTBEAT_INTERVAL_MS = Number(import.meta.env.VITE_STREAMER_HEARTBEAT_MS || 20000);
const HEARTBEAT_TIMEOUT_MS = Number(import.meta.env.VITE_STREAMER_HEARTBEAT_TIMEOUT_MS || 12000);
const MAX_PLAYBACK_RETRIES = 2; // initial attempt + one automatic retry
const PLAYBACK_RETRY_DELAY_MS = Number(import.meta.env.VITE_STREAMER_PLAYBACK_RETRY_DELAY_MS || 4000);

const getDonationTimestamp = (donation) => {
  if (!donation) return 0;
  const rawDate = donation.created_at || donation.createdAt;
  if (rawDate) {
    const parsed = Date.parse(rawDate);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  const numericId = Number(donation.id);
  if (Number.isFinite(numericId)) {
    return numericId;
  }
  return 0;
};

export default function StreamerPage() {
  const { uuid } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, logout, authToken } = useAuth();
  const REQUIRE_JWT = (import.meta.env.VITE_REQUIRE_JWT_DASHBOARD || 'false').toLowerCase() === 'true';
  const usingSession = REQUIRE_JWT && isAuthenticated;
  const [donations, setDonations] = useState([]);
  const donationBufferRef = useRef([]);
  const processedDonationIdsRef = useRef(new Set());
  const bufferFlushIntervalRef = useRef(null);
  const [enabled, setEnabled] = useState(false);
  const [queue, setQueue] = useState([]);
  const queueRef = useRef([]);
  const playNextRef = useRef(() => {});
  const [currentPlaying, setCurrentPlaying] = useState(null);
  const [darkMode, setDarkMode] = useState(() => {
    // Check for theme in multiple possible keys for backward compatibility
    const saved = localStorage.getItem('theme') || localStorage.getItem('streamer_theme');
    return saved === 'dark';
  });
  const wakeLockRef = useRef(null);
  const keepAliveIntervalRef = useRef(null);
  const KEEP_ALIVE_INTERVAL_MS = Number(import.meta.env.VITE_STREAMER_KEEPALIVE_MS || 45000);
  const [streamerInfo, setStreamerInfo] = useState(null);
  const playedDonationsRef = useRef(new Set());
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [apiKey, setApiKey] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const audioRef = useRef(null);
  const playingRef = useRef(false);
  const audioContextRef = useRef(null);
  const gainNodeRef = useRef(null);
  const audioBufferCacheRef = useRef(new Map()); // key: audio_filename, value: AudioBuffer
  const currentTimeoutRef = useRef(null);
  const pendingRetryRef = useRef(null);
  const playbackFailuresRef = useRef(new Map());
  const [playbackWarning, setPlaybackWarning] = useState(null);
  const [flaggingDonationId, setFlaggingDonationId] = useState(null);
  const [flagToasts, setFlagToasts] = useState([]);
  const toastTimersRef = useRef([]);
  const [volume, setVolume] = useState(() => {
    const savedVolume = localStorage.getItem('tts_volume');
    return savedVolume !== null ? Number(savedVolume) : 1;
  });
  const volumeRef = useRef(volume);
  const [notificationSounds, setNotificationSounds] = useState([]);
  const [selectedNotificationSound, setSelectedNotificationSound] = useState(null);
  const [notificationSoundLoading, setNotificationSoundLoading] = useState(false);
  const [notificationSoundError, setNotificationSoundError] = useState(null);
  const [updatingNotificationSound, setUpdatingNotificationSound] = useState(false);
  const [previewingNotificationSound, setPreviewingNotificationSound] = useState(false);
  const [notificationSoundApiReady, setNotificationSoundApiReady] = useState(true);
  const [localNotificationSoundSlug, setLocalNotificationSoundSlug] = useState(() => localStorage.getItem(LOCAL_NOTIFICATION_SOUND_KEY) || '__default__');
  const audioUnlockedRef = useRef(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState(null);
  const [offlineDurationMinutes, setOfflineDurationMinutes] = useState(null);
  const [liveToggleLoading, setLiveToggleLoading] = useState(false);
  const [liveStatusMessage, setLiveStatusMessage] = useState(null);
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY_MS);
  const reconnectTimeoutRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const heartbeatTimeoutRef = useRef(null);
  const offlineDurationTimerRef = useRef(null);
  const isPageVisibleRef = useRef(typeof document !== 'undefined' ? document.visibilityState === 'visible' : true);

  const ensureAudioContext = useCallback(() => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioContextRef.current) {
      audioContextRef.current = new Ctx();
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.connect(audioContextRef.current.destination);
      gainNodeRef.current.gain.value = volumeRef.current ?? 1;
    }
    return audioContextRef.current;
  }, []);
  // Helper to build donation audio URL
  const getDonationUrl = useCallback((filename) => {
    const baseUrl = SOCKET_URL;
    return `${baseUrl}/public/audios/${encodeURIComponent(filename)}`;
  }, []);

  const getDonationCacheKey = useCallback((id) => {
    const numericId = Number(id);
    return Number.isFinite(numericId) ? numericId : String(id);
  }, []);

  const resolveNotificationSoundUrl = useCallback((soundMeta) => {
    if (soundMeta?.filePath) {
      if (/^https?:\/\//i.test(soundMeta.filePath)) {
        return soundMeta.filePath;
      }
      const normalized = soundMeta.filePath.startsWith('/') ? soundMeta.filePath : `/${soundMeta.filePath}`;
      return `${SOCKET_URL}${normalized}`;
    }
    return DEFAULT_NOTIFICATION_SOUND_URL;
  }, []);

  const getFallbackSoundBySlug = useCallback((slug) => {
    if (!slug || slug === '__default__') return FALLBACK_NOTIFICATION_SOUNDS[0];
    return FALLBACK_NOTIFICATION_SOUNDS.find((sound) => sound.slug === slug) || FALLBACK_NOTIFICATION_SOUNDS[0];
  }, []);

  const notificationSoundPreference = useMemo(() => {
    if (selectedNotificationSound) return selectedNotificationSound;
    if (streamerInfo?.notification_sound_meta) return streamerInfo.notification_sound_meta;
    if (!notificationSoundApiReady) {
      return getFallbackSoundBySlug(localNotificationSoundSlug);
    }
    return null;
  }, [selectedNotificationSound, streamerInfo?.notification_sound_meta, notificationSoundApiReady, getFallbackSoundBySlug, localNotificationSoundSlug]);

  const removeFlagToast = useCallback((toastId) => {
    setFlagToasts((prev) => prev.filter((toast) => toast.id !== toastId));
    toastTimersRef.current = toastTimersRef.current.filter((entry) => {
      if (entry.id === toastId) {
        clearTimeout(entry.timer);
        return false;
      }
      return true;
    });
  }, []);

  const pushFlagToast = useCallback(({ type = 'info', title, message }) => {
    if (!title && !message) return;
    const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setFlagToasts((prev) => [...prev, { id, type, title, message }]);
    const timer = setTimeout(() => removeFlagToast(id), 4500);
    toastTimersRef.current.push({ id, timer });
  }, [removeFlagToast]);

  const sortDonationsOldestFirst = useCallback((list = []) => {
    if (!Array.isArray(list)) return [];
    return [...list].sort((a, b) => getDonationTimestamp(a) - getDonationTimestamp(b));
  }, []);

  // Preload next donation's audio buffer to reduce gaps
  useEffect(() => {
    const preloadNext = async () => {
      if (!audioContextRef.current) return;
      if (!queue || queue.length === 0) return;
      const next = queue[0];
      const file = next?.audio_url;
      if (!file) return;
      if (audioBufferCacheRef.current.has(file)) return;
      try {
        const url = getDonationUrl(file);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arr = await res.arrayBuffer();
        const buf = await audioContextRef.current.decodeAudioData(arr);
        audioBufferCacheRef.current.set(file, buf);
        // Cap cache size to 5
        if (audioBufferCacheRef.current.size > 5) {
          const firstKey = audioBufferCacheRef.current.keys().next().value;
          audioBufferCacheRef.current.delete(firstKey);
        }
      } catch (e) {
        console.warn('[preload] Failed to preload audio:', e?.message || e);
      }
    };
    preloadNext();
  }, [queue, getDonationUrl]);

  // Create a memoized axios instance that includes the API key
  const apiClient = useMemo(() => {
    if (usingSession) {
      const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;
      return axios.create({
        baseURL: import.meta.env.VITE_API_URL,
        withCredentials: true,
        headers,
      });
    }
    if (!apiKey) {
      console.log("[apiClient] API Key is null, apiClient not created.");
      return null;
    }
    console.log("[apiClient] Creating apiClient with API Key (first 5 chars):", apiKey.substring(0, 5));
    return axios.create({
      baseURL: import.meta.env.VITE_API_URL,
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
  }, [apiKey, usingSession, authToken]);

  // On initial load, check for API Key
  useEffect(() => {
    if (usingSession) {
      setIsModalOpen(false);
      return;
    }
    const key = localStorage.getItem(`apiKey_${uuid}`);
    if (key) {
      console.log("[API Key Load] Found API Key in local storage (first 5 chars):", key.substring(0, 5));
      setApiKey(key);
    } else {
      console.log("[API Key Load] No API Key found in local storage, opening modal.");
      setIsModalOpen(true);
    }
  }, [uuid, usingSession]);

  const handleApiKeySubmit = (key) => {
    localStorage.setItem(`apiKey_${uuid}`, key);
    setApiKey(key);
    setIsModalOpen(false);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    if (!apiKey) {
      alert("An API Key is required to view your dashboard.");
      navigate('/'); // Redirect if they close without submitting
    }
  };

  // Initialize AudioContext on component mount
  useEffect(() => {
    ensureAudioContext();
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [ensureAudioContext]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const events = ['touchstart', 'touchend', 'pointerdown', 'mousedown', 'keydown'];

    const unlockContext = () => {
      if (audioUnlockedRef.current) return;
      const ctx = ensureAudioContext();
      if (!ctx) {
        audioUnlockedRef.current = true;
        return;
      }

      const finalize = () => {
        audioUnlockedRef.current = true;
        events.forEach((evt) => window.removeEventListener(evt, unlockContext));
      };

      try {
        if (ctx.state === 'running') {
          finalize();
          return;
        }

        ctx.resume()
          .then(() => {
            try {
              const buffer = ctx.createBuffer(1, 1, 22050);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(gainNodeRef.current || ctx.destination);
              source.start(0);
              source.stop(ctx.currentTime + 0.001);
            } catch (silentErr) {
              console.warn('Audio unlock pulse failed:', silentErr?.message || silentErr);
            }
            finalize();
          })
          .catch((err) => {
            audioUnlockedRef.current = false;
            console.warn('Audio context resume blocked:', err?.message || err);
          });
      } catch (err) {
        audioUnlockedRef.current = false;
        console.warn('Audio context unlock error:', err?.message || err);
      }
    };

    events.forEach((evt) => window.addEventListener(evt, unlockContext, { passive: true }));
    return () => {
      events.forEach((evt) => window.removeEventListener(evt, unlockContext));
    };
  }, [ensureAudioContext]);

  useEffect(() => {
    return () => {
      if (pendingRetryRef.current) {
        clearTimeout(pendingRetryRef.current);
        pendingRetryRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      toastTimersRef.current.forEach(({ timer }) => clearTimeout(timer));
      toastTimersRef.current = [];
    };
  }, []);

  // Update volume when it changes without recreating AudioContext
  useEffect(() => {
    if (gainNodeRef.current) {
      const currentTime = audioContextRef.current.currentTime;
      gainNodeRef.current.gain.cancelScheduledValues(currentTime);
      gainNodeRef.current.gain.setValueAtTime(gainNodeRef.current.gain.value, currentTime);
      gainNodeRef.current.gain.linearRampToValueAtTime(volume, currentTime + 0.1); // Smooth 100ms transition
    }
  }, [volume]);

  const persistLocalNotificationSound = useCallback((slugValue) => {
    const normalized = slugValue || '__default__';
    if (normalized === '__default__') {
      localStorage.removeItem(LOCAL_NOTIFICATION_SOUND_KEY);
    } else {
      localStorage.setItem(LOCAL_NOTIFICATION_SOUND_KEY, normalized);
    }
    setLocalNotificationSoundSlug(normalized);
    const fallbackSound = getFallbackSoundBySlug(normalized);
    setSelectedNotificationSound(fallbackSound);
  }, [getFallbackSoundBySlug]);

  const updateNotificationSoundPreference = useCallback(async ({ slug, reset = false }) => {
    const targetSlug = reset ? '__default__' : (slug || '__default__');
    if (!apiClient || !notificationSoundApiReady) {
      persistLocalNotificationSound(targetSlug);
      return;
    }
    setNotificationSoundError(null);
    setUpdatingNotificationSound(true);
    try {
      const path = usingSession ? `/v1/streamer/${uuid}/notification-sound` : `/streamer/${uuid}/notification-sound`;
      const payload = reset ? { reset: true } : { soundSlug: slug };
      const { data } = await apiClient.put(path, payload);
      const nextSound = data?.selectedSound || null;
      setSelectedNotificationSound(nextSound);
      setStreamerInfo((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          notification_sound: data?.selectedValue ?? null,
          notification_sound_meta: nextSound,
        };
      });
      persistLocalNotificationSound(nextSound?.slug || targetSlug);
    } catch (error) {
      setNotificationSoundError(error?.response?.data?.error || error?.message || 'Failed to update notification sound');
      persistLocalNotificationSound(targetSlug);
    } finally {
      setUpdatingNotificationSound(false);
    }
  }, [apiClient, usingSession, uuid, notificationSoundApiReady, persistLocalNotificationSound]);

  const handleNotificationSoundSelect = async (event) => {
    const value = event.target.value;
    if (!value) return;
    if (value === '__default__') {
      await updateNotificationSoundPreference({ reset: true });
      return;
    }
    await updateNotificationSoundPreference({ slug: value });
  };

  const handleResetNotificationSound = async () => {
    await updateNotificationSoundPreference({ reset: true });
  };

  const handlePreviewNotificationSound = async () => {
    setNotificationSoundError(null);
    const soundMeta = notificationSoundPreference;
    const previewUrl = resolveNotificationSoundUrl(soundMeta);
    try {
      setPreviewingNotificationSound(true);
      const audio = new Audio(previewUrl);
      audio.volume = volume;
      await audio.play();
    } catch (error) {
      setNotificationSoundError(error?.message || 'Failed to preview notification sound');
    } finally {
      setPreviewingNotificationSound(false);
    }
  };

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const resetReconnectState = useCallback(() => {
    reconnectDelayRef.current = INITIAL_RECONNECT_DELAY_MS;
    setConnectionAttempts(0);
    clearReconnectTimeout();
  }, [clearReconnectTimeout]);

  const scheduleReconnect = useCallback((reason = 'unknown') => {
    if (socket.connected || reconnectTimeoutRef.current) return;
    setConnectionStatus('reconnecting');
    setConnectionAttempts((prev) => prev + 1);
    const delay = reconnectDelayRef.current;
    console.warn(`[Socket] Scheduling reconnect in ${delay}ms (reason: ${reason})`);
    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null;
      socket.connect();
    }, delay + Math.floor(Math.random() * 500));
    reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, MAX_RECONNECT_DELAY_MS);
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    if (!socket.connected) return;

    const sendHeartbeat = () => {
      if (!socket.connected) return;
      socket.emit('streamer_heartbeat', { uuid, ts: Date.now() });
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
      }
      heartbeatTimeoutRef.current = setTimeout(() => {
        console.warn('[Socket] Heartbeat timed out, forcing reconnect.');
        setConnectionStatus('degraded');
        socket.disconnect();
        scheduleReconnect('heartbeat_timeout');
      }, HEARTBEAT_TIMEOUT_MS);
    };

    heartbeatIntervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    sendHeartbeat();
  }, [scheduleReconnect, stopHeartbeat, uuid]);

  const updateOfflineDuration = useCallback(() => {
    if (!lastHeartbeatAt) {
      setOfflineDurationMinutes(null);
      return;
    }
    const now = Date.now();
    const graceMs = HEARTBEAT_INTERVAL_MS + HEARTBEAT_TIMEOUT_MS;
    const diffMs = now - lastHeartbeatAt;
    if (diffMs <= graceMs) {
      setOfflineDurationMinutes(0);
      return;
    }
    const elapsedPastGrace = diffMs - graceMs;
    const minutes = Math.max(1, Math.ceil(elapsedPastGrace / 60000));
    setOfflineDurationMinutes(minutes);
  }, [lastHeartbeatAt]);

  useEffect(() => {
    if (connectionStatus !== 'disconnected') {
      if (offlineDurationTimerRef.current) {
        clearInterval(offlineDurationTimerRef.current);
        offlineDurationTimerRef.current = null;
      }
      setOfflineDurationMinutes(null);
      return;
    }
    updateOfflineDuration();
    offlineDurationTimerRef.current = setInterval(updateOfflineDuration, 15000);
    return () => {
      if (offlineDurationTimerRef.current) {
        clearInterval(offlineDurationTimerRef.current);
        offlineDurationTimerRef.current = null;
      }
    };
  }, [connectionStatus, updateOfflineDuration]);

  useEffect(() => {
    if (!liveStatusMessage) return undefined;
    const timer = setTimeout(() => setLiveStatusMessage(null), 6500);
    return () => clearTimeout(timer);
  }, [liveStatusMessage]);

  const applyLiveSnapshot = useCallback((snapshot = {}) => {
    setStreamerInfo((prev) => {
      if (!prev) return prev;
      const nextStatus =
        typeof snapshot.live_status !== 'undefined'
          ? snapshot.live_status
          : typeof snapshot.liveStatus !== 'undefined'
            ? snapshot.liveStatus
            : prev.live_status;
      const nextSince = snapshot.live_since ?? snapshot.liveSince ?? prev.live_since;
      const nextPing = snapshot.last_live_ping ?? snapshot.lastLivePing ?? prev.last_live_ping;
      if (nextStatus === prev.live_status && nextSince === prev.live_since && nextPing === prev.last_live_ping) {
        return prev;
      }
      return {
        ...prev,
        live_status: nextStatus,
        live_since: nextSince,
        last_live_ping: nextPing,
      };
    });
  }, []);

  // ✅ Fetch streamer info + donation history
  const fetchInitialData = useCallback(async (page = 1, { silent = false } = {}) => {
    if (!apiClient) return; // Don't fetch if the client isn't ready
    console.log(`Fetching data for streamer ${uuid} page ${page}`);
    try {
      if (!silent) {
        setLoading(true);
      }

      let newDonations;
      let newPagination;

      if (page === 1) {
        // Initial load: Use the public endpoint that gets everything.
        // We still wait for apiClient to be ready to ensure the user has authenticated.
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/streamer/${uuid}?page=${page}`);
        const rawStreamer = res.data.streamer;
        const normalizedStreamer = rawStreamer ? {
          ...rawStreamer,
          balance: typeof rawStreamer.balance === 'number'
            ? rawStreamer.balance
            : Number(rawStreamer.balance || 0),
        } : null;
        setStreamerInfo(normalizedStreamer);
        console.log("[StreamerPage] Fetched streamer balance from API:", normalizedStreamer?.balance);
        newDonations = res.data.donations || [];
        newPagination = res.data.pagination;
        console.log(`[fetchInitialData] Fetched donations (page ${page}):`, newDonations.map(d => ({ id: d.id, played: d.played })));

        const audioReady = newDonations.filter(
          (d) => d.status === "paid" && d.audio_url && !d.played
        );
        const orderedQueue = sortDonationsOldestFirst(audioReady);
        setQueue(orderedQueue);
        console.log(`[StreamerPage] 📥 Loaded ${audioReady.length} unplayed donations to queue`);

      } else {
        // Pagination: Use protected endpoint appropriate for auth method
        const path = usingSession ? `/v1/streamer/${uuid}/donations?page=${page}` : `/streamer/${uuid}/donations?page=${page}`;
        const res = await apiClient.get(path);
        newDonations = res.data.donations || [];
        newPagination = res.data.pagination;
        console.log(`[fetchInitialData] Fetched paginated donations (page ${page}):`, newDonations.map(d => ({ id: d.id, played: d.played })));
      }

      if (page === 1) {
        processedDonationIdsRef.current = new Set(newDonations.map(d => getDonationCacheKey(d.id)));
      } else {
        newDonations.forEach(d => processedDonationIdsRef.current.add(getDonationCacheKey(d.id)));
      }

      setDonations(newDonations);
      setPagination(newPagination);

    } catch (err) {
      console.error("Error fetching data:", err);
      if (err.response?.status === 403 || err.response?.status === 401) {
        alert("Forbidden: Invalid API Key. Please refresh the page and enter the correct key.");
        localStorage.removeItem(`apiKey_${uuid}`);
        setApiKey(null); // Clear the bad key
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [uuid, apiClient, usingSession, getDonationCacheKey, sortDonationsOldestFirst]);

  useEffect(() => {
    if (!streamerInfo) {
      setSelectedNotificationSound(null);
      return;
    }
    if (streamerInfo.notification_sound_meta) {
      setSelectedNotificationSound(streamerInfo.notification_sound_meta);
    } else if (!streamerInfo.notification_sound_meta) {
      setSelectedNotificationSound(null);
    }
  }, [streamerInfo]);

  useEffect(() => {
    if (!apiClient || !streamerInfo) return;
    let cancelled = false;
    const fetchSounds = async () => {
      setNotificationSoundLoading(true);
      setNotificationSoundError(null);
      try {
        const path = usingSession ? `/v1/streamer/${uuid}/notification-sounds` : `/streamer/${uuid}/notification-sounds`;
        const { data } = await apiClient.get(path);
        if (cancelled) return;
        const allowedSlugs = new Set(['sound_default_ping', 'sound_soft_bell']);
        const catalog = Array.isArray(data?.sounds)
          ? data.sounds.filter((sound) => allowedSlugs.has(sound.slug))
          : [];
        setNotificationSounds(catalog);
        if (data?.selectedSound) {
          setSelectedNotificationSound(data.selectedSound);
        }
        setNotificationSoundApiReady(true);
      } catch (error) {
        if (cancelled) return;
        setNotificationSoundApiReady(false);
        setNotificationSounds(FALLBACK_NOTIFICATION_SOUNDS);
        const fallbackSelection = getFallbackSoundBySlug(localNotificationSoundSlug);
        setSelectedNotificationSound(fallbackSelection);
        setNotificationSoundError(error?.response?.data?.error || error?.message || 'Failed to load notification sounds');
      } finally {
        if (!cancelled) {
          setNotificationSoundLoading(false);
        }
      }
    };
    fetchSounds();
    return () => {
      cancelled = true;
    };
  }, [apiClient, streamerInfo, usingSession, uuid, getFallbackSoundBySlug, localNotificationSoundSlug]);

  // ✅ Mark a donation as played and persist it
  const markAsPlayed = useCallback(async (id) => {
    if (!apiClient) return;
    const cacheKey = getDonationCacheKey(id);
    if (playedDonationsRef.current.has(cacheKey)) return;

    // Update the UI immediately
    setDonations(prev => prev.map(d => d.id === id ? { ...d, played: true } : d));
    playedDonationsRef.current.add(cacheKey);

    try {
      const path = usingSession ? `/v1/streamer/${uuid}/donations/${id}/played` : `/streamer/${uuid}/donations/${id}/played`;
      await apiClient.post(path);
      console.log("✅ Donation marked as played in DB:", id);
    } catch (error) {
      console.error("❌ Error marking donation as played:", error.response?.status, error.response?.data, error);
      // If API fails, revert the UI update
      setDonations(prev => prev.map(d => d.id === id ? { ...d, played: false } : d));
      playedDonationsRef.current.delete(cacheKey);
    }
  }, [uuid, apiClient, usingSession, getDonationCacheKey]);

  const handleLiveToggle = useCallback(async () => {
    if (!apiClient || !streamerInfo) return;
    setLiveStatusMessage(null);
    setLiveToggleLoading(true);
    try {
      const endpoint = usingSession ? `/v1/streamer/${uuid}/live` : `/streamer/${uuid}/live`;
      const method = streamerInfo.live_status ? 'delete' : 'post';
      const { data } = await apiClient[method](endpoint);
      if (data?.streamer) {
        applyLiveSnapshot(data.streamer);
        const nowLive = data.streamer.live_status ?? data.streamer.liveStatus;
        setLiveStatusMessage({
          type: 'success',
          message: nowLive ? 'You are now live.' : 'You are now offline.',
        });
      }
    } catch (error) {
      const message = error?.response?.data?.error || error?.message || 'Failed to update live status';
      setLiveStatusMessage({ type: 'error', message });
    } finally {
      setLiveToggleLoading(false);
    }
  }, [apiClient, streamerInfo, usingSession, uuid, applyLiveSnapshot]);

  const handleLiveStatusEvent = useCallback((event) => {
    if (!event) return;
    const eventUuid = event.linkUuid || event.link_uuid;
    if (eventUuid !== uuid) return;
    applyLiveSnapshot(event);
    const liveValue = typeof event.live_status !== 'undefined' ? event.live_status : event.liveStatus;
    if (liveValue === false && event.reason === 'auto_end') {
      setLiveStatusMessage({
        type: 'warning',
        message: 'We ended your live session after missing heartbeats for 5 minutes.',
      });
      setLiveToggleLoading(false);
    }
  }, [applyLiveSnapshot, uuid]);

  useEffect(() => {
    socket.on('streamer_live_status', handleLiveStatusEvent);
    return () => {
      socket.off('streamer_live_status', handleLiveStatusEvent);
    };
  }, [handleLiveStatusEvent]);

  const handleFlagDonation = useCallback(async (donationId, action) => {
    if (!apiClient || !donationId) return;
    setFlaggingDonationId(donationId);
    const label = FLAG_ACTION_LABELS[action] || 'Flag';
    try {
      const path = usingSession
        ? `/v1/streamer/${uuid}/donations/${donationId}/flag`
        : `/streamer/${uuid}/donations/${donationId}/flag`;
      const { data } = await apiClient.post(path, { action });
      const nextFlag = data?.flag || {
        status: 'pending',
        action,
        actionLabel: label,
      };

      setDonations((prev) =>
        prev.map((donation) =>
          donation.id === donationId
            ? {
                ...donation,
                flag: nextFlag,
              }
            : donation
        )
      );

      pushFlagToast({
        type: 'success',
        title: 'Admins notified',
        message: `${label} request sent for review.`,
      });
    } catch (error) {
      const message = error?.response?.data?.error || error?.message || 'Failed to notify admins';
      pushFlagToast({
        type: 'error',
        title: 'Could not send flag',
        message,
      });
    } finally {
      setFlaggingDonationId(null);
    }
  }, [apiClient, usingSession, uuid, pushFlagToast]);

  const requestWakeLock = useCallback(async () => {
    if (typeof navigator === 'undefined') return;
    const wakeLockApi = navigator.wakeLock;
    if (!wakeLockApi?.request) return;
    if (document.visibilityState === 'hidden') return;
    if (wakeLockRef.current) return;
    try {
      const sentinel = await wakeLockApi.request('screen');
      wakeLockRef.current = sentinel;
      sentinel.addEventListener('release', () => {
        console.log('[WakeLock] Screen lock released');
        wakeLockRef.current = null;
      }, { once: true });
      console.log('[WakeLock] Screen lock acquired');
    } catch (err) {
      console.warn('[WakeLock] Unable to acquire screen lock:', err?.message || err);
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (!wakeLockRef.current) return;
    try {
      await wakeLockRef.current.release();
    } catch (err) {
      console.warn('[WakeLock] Failed to release screen lock:', err?.message || err);
    } finally {
      wakeLockRef.current = null;
    }
  }, []);

  const clearPlaybackFailure = useCallback((donationId, { clearWarning = true } = {}) => {
    if (!donationId) return;
    const cacheKey = getDonationCacheKey(donationId);
    playbackFailuresRef.current.delete(cacheKey);
    if (clearWarning && playbackFailuresRef.current.size === 0) {
      setPlaybackWarning(null);
    }
  }, [getDonationCacheKey]);

  const handlePlaybackFailure = useCallback((donation, reason) => {
    if (!donation) return;

    if (reason === 'autoplay_blocked') {
      setPlaybackWarning('Browser blocked audio playback. Tap the "Audio On" button and interact with the page to resume the queue.');
      return;
    }

    const cacheKey = getDonationCacheKey(donation.id);
    const attempts = (playbackFailuresRef.current.get(cacheKey) || 0) + 1;
    playbackFailuresRef.current.set(cacheKey, attempts);

    const baseMessage = `Donation #${donation.id} audio failed (${reason}).`;

    if (attempts >= MAX_PLAYBACK_RETRIES) {
      playbackFailuresRef.current.delete(cacheKey);
      setQueue((prev) => prev.filter((item) => item.id !== donation.id));
      audioBufferCacheRef.current.delete(donation.audio_url);
      setPlaybackWarning(`${baseMessage} Skipped after automatic retry.`);
      markAsPlayed(donation.id);
      return;
    }

    setPlaybackWarning(`${baseMessage} Retrying automatically (${attempts}/${MAX_PLAYBACK_RETRIES - 1})...`);

    if (pendingRetryRef.current) {
      clearTimeout(pendingRetryRef.current);
    }

    pendingRetryRef.current = setTimeout(() => {
      pendingRetryRef.current = null;
      if (!playingRef.current && queueRef.current.length > 0) {
        playNextRef.current?.();
      }
    }, PLAYBACK_RETRY_DELAY_MS);
  }, [getDonationCacheKey, markAsPlayed]);

  // ✅ Play next queued donation
  const playNext = useCallback(() => {
    console.log(`[playNext] Called. enabled: ${enabled}, playingRef.current: ${playingRef.current}, queue.length: ${queue.length}`);
    if (!enabled || playingRef.current || queue.length === 0) {
      console.log("[playNext] Conditions not met for playback.");
      return;
    }

    const nextDonation = queue[0];
    playingRef.current = true;
    setCurrentPlaying(nextDonation.id);

    const audioFilename = nextDonation.audio_url;
    const donationUrl = getDonationUrl(audioFilename);
    const notificationUrlPrimary = resolveNotificationSoundUrl(notificationSoundPreference);
    const notificationUrlFallback = FALLBACK_NOTIFICATION_SOUND_URL;

    const failAndRetry = (reason) => {
      if (currentTimeoutRef.current) {
        clearTimeout(currentTimeoutRef.current);
        currentTimeoutRef.current = null;
      }
      playingRef.current = false;
      setCurrentPlaying(null);
      handlePlaybackFailure(nextDonation, reason);
    };

    const playDonation = async () => {
      console.log(`[playDonation] Attempting to play donation ${nextDonation.id}. AudioContext state: ${audioContextRef.current?.state}`);
      if (!audioContextRef.current) {
        console.error("❌ [playDonation] AudioContext not initialized.");
        failAndRetry('audio_context_missing');
        return;
      }

      try {
        // Ensure context is running
        if (audioContextRef.current.state === 'suspended') {
          console.log("[playDonation] AudioContext is suspended, attempting to resume...");
          try {
            await audioContextRef.current.resume();
            console.log("[playDonation] AudioContext resumed successfully. State:", audioContextRef.current.state);
          } catch (e) {
            console.error("❌ [playDonation] Failed to resume AudioContext for donation:", e.name, e.message, e);
            failAndRetry('resume_failed');
            return;
          }
        }

        let audioBuffer = audioBufferCacheRef.current.get(audioFilename);
        if (!audioBuffer) {
          console.log(`[playDonation] Fetching donation audio from: ${donationUrl}`);
          const response = await fetch(donationUrl);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          console.log("[playDonation] Audio fetched, decoding...");
          const arrayBuffer = await response.arrayBuffer();
          audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
          audioBufferCacheRef.current.set(audioFilename, audioBuffer);
        } else {
          console.log('[playDonation] Using preloaded audio buffer');
        }
        console.log("[playDonation] Audio decoded.");

        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(gainNodeRef.current);

        source.onended = () => {
          console.log("✅ [playDonation] Finished donation (Web Audio):", nextDonation.id);
          playingRef.current = false;
          setCurrentPlaying(null);
          markAsPlayed(nextDonation.id);
          setQueue((prev) => prev.slice(1));
          // Cleanup cache entry for the just-played file to free memory
          audioBufferCacheRef.current.delete(audioFilename);
          if (currentTimeoutRef.current) {
            clearTimeout(currentTimeoutRef.current);
            currentTimeoutRef.current = null;
          }
          clearPlaybackFailure(nextDonation.id);
        };

        console.log("🔊 [playDonation] Playing donation (Web Audio):", donationUrl);
        source.start(0);
        audioRef.current = source; // Store the source node for potential stopping

        // Fallback: mark as played after audio duration + 1 second in case onended doesn't fire
        currentTimeoutRef.current = setTimeout(() => {
          console.log("[playDonation] Fallback: Marking as played after timeout.");
          playingRef.current = false;
          setCurrentPlaying(null);
          markAsPlayed(nextDonation.id);
          setQueue((prev) => prev.slice(1));
          audioBufferCacheRef.current.delete(audioFilename);
          clearPlaybackFailure(nextDonation.id);
        }, (audioBuffer.duration * 1000) + 1000);
      } catch (err) {
        console.error("❌ [playDonation] Donation audio error (Web Audio):", err.name, err.message, err);
        if (err.name === 'NotAllowedError') {
          console.log("🔇 [playDonation] Autoplay blocked. User needs to interact with page first.");
          failAndRetry('autoplay_blocked');
          return;
        }
        failAndRetry(err.name || 'audio_error');
      }
    };

    const playNotificationThenDonation = async () => {
      console.log(`[playNotificationThenDonation] Attempting to play notification. AudioContext state: ${audioContextRef.current?.state}`);
      if (!audioContextRef.current) {
        console.error("❌ [playNotificationThenDonation] AudioContext not initialized for notification.");
        playDonation(); // Skip notification, try to play donation directly
        return;
      }

      try {
        // Ensure context is running
        if (audioContextRef.current.state === 'suspended') {
          console.log("[playNotificationThenDonation] AudioContext is suspended, attempting to resume...");
          try {
            await audioContextRef.current.resume();
            console.log("[playNotificationThenDonation] AudioContext resumed successfully. State:", audioContextRef.current.state);
          } catch (e) {
            console.error("❌ [playNotificationThenDonation] Failed to resume AudioContext for notification:", e.name, e.message, e);
            playDonation(); // Skip notification, try to play donation directly
            return;
          }
        }

        let notificationAudioBuffer;
        try {
          console.log(`[playNotificationThenDonation] Fetching primary notification from: ${notificationUrlPrimary}`);
          const response = await fetch(notificationUrlPrimary);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          notificationAudioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
          console.log("🔔 [playNotificationThenDonation] Playing primary notification (Web Audio):", notificationUrlPrimary);
        } catch (e) {
          console.warn("⚠️ [playNotificationThenDonation] Primary notification not found or failed, trying fallback:", e.name, e.message, notificationUrlFallback);
          const response = await fetch(notificationUrlFallback);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          notificationAudioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
          console.log("🔔 [playNotificationThenDonation] Playing fallback notification (Web Audio):", notificationUrlFallback);
        }

        const source = audioContextRef.current.createBufferSource();
        source.buffer = notificationAudioBuffer;
        source.connect(gainNodeRef.current);

        source.onended = () => {
          console.log("[playNotificationThenDonation] Notification ended, starting donation.");
          playDonation();
        };

        source.start(0);
        audioRef.current = source; // allow skip during notification too
      } catch (e) {
        console.error("⚠️ [playNotificationThenDonation] Notification play failed (Web Audio), skipping to donation:", e.name, e.message, e);
        playDonation();
      }
    };

    // Start sequence
    playNotificationThenDonation();
  }, [enabled, queue, setCurrentPlaying, markAsPlayed, getDonationUrl, resolveNotificationSoundUrl, notificationSoundPreference, handlePlaybackFailure, clearPlaybackFailure]);

  const notificationSoundSelectValue = notificationSoundPreference?.slug
    || (!notificationSoundApiReady ? localNotificationSoundSlug : '__default__');
  const notificationSoundLabel = notificationSoundPreference?.label
    || (notificationSoundSelectValue === 'sound_soft_bell' ? 'Soft Bell' : 'Default Bell');



  // ✅ Real-time listener with connection monitoring
  useEffect(() => {
    const handleConnect = () => {
      console.log("🔗 Socket connected");
      setConnectionStatus('connected');
      resetReconnectState();
      socket.emit("join_streamer_room", uuid);
      startHeartbeat();
      setLastHeartbeatAt(Date.now());

      // Ensure we didn't miss anything while offline
      if (apiClient) {
        fetchInitialData(1, { silent: true });
      }
    };

    const handleDisconnect = (reason) => {
      console.log("🔌 Socket disconnected:", reason);
      stopHeartbeat();
      if (reason === 'io client disconnect' && !isPageVisibleRef.current) {
        setConnectionStatus('sleeping');
        return;
      }
      setConnectionStatus('disconnected');
      scheduleReconnect(reason);
    };

    const handleConnectError = (error) => {
      console.error("Socket connection error:", error?.message || error);
      setConnectionStatus('error');
      scheduleReconnect('connect_error');
    };

    const handleHeartbeatAck = (payload) => {
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
        heartbeatTimeoutRef.current = null;
      }
      setLastHeartbeatAt(payload?.ts || Date.now());
      setConnectionStatus('connected');
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("streamer_heartbeat_ack", handleHeartbeatAck);

    if (socket.connected) {
      handleConnect();
    } else {
      setConnectionStatus('connecting');
    }

    socket.off("new_donation");
    socket.on("new_donation", (data) => {
      donationBufferRef.current.push(data);
    });

    // Flush buffer periodically to batch state updates
    if (!bufferFlushIntervalRef.current) {
      bufferFlushIntervalRef.current = setInterval(() => {
        if (donationBufferRef.current.length === 0) return;
        const batch = donationBufferRef.current.splice(0, donationBufferRef.current.length);
        const uniqueBatch = [];

        batch.forEach((item) => {
          const cacheKey = getDonationCacheKey(item.id);
          if (processedDonationIdsRef.current.has(cacheKey)) {
            return;
          }
          processedDonationIdsRef.current.add(cacheKey);
          uniqueBatch.push(item);
        });

        if (uniqueBatch.length === 0) {
          return;
        }

        const balanceIncrement = uniqueBatch.reduce((sum, donation) => {
          const amount = donation?.status === 'paid' ? Number(donation.amount || 0) : 0;
          return sum + (Number.isFinite(amount) ? amount : 0);
        }, 0);

        // Merge into donations (prepend on first page only)
        if (currentPage === 1) {
          setDonations((prev) => {
            const existing = new Set(prev.map(d => getDonationCacheKey(d.id)));
            const fresh = uniqueBatch.filter(b => !existing.has(getDonationCacheKey(b.id))).map(b => ({ ...b }));
            if (fresh.length === 0) return prev;
            return [...fresh, ...prev];
          });
        }
        // Queue playable
        setQueue((prev) => {
          const qIds = new Set(prev.map(d => getDonationCacheKey(d.id)));
          const playable = uniqueBatch.filter(b => {
            const cacheKey = getDonationCacheKey(b.id);
            return b.status === 'paid' && b.audio_url && !b.played && !playedDonationsRef.current.has(cacheKey) && !qIds.has(cacheKey);
          });
          if (playable.length === 0) {
            return prev;
          }
          const sortedPlayable = sortDonationsOldestFirst(playable);
          return [...prev, ...sortedPlayable];
        });
        // Update pagination total count
        setPagination((prev) => prev ? { ...prev, totalCount: (prev.totalCount || 0) + uniqueBatch.length } : prev);

        if (balanceIncrement !== 0) {
          setStreamerInfo((prev) => {
            if (!prev) return prev;
            const currentBalance = typeof prev.balance === 'number' ? prev.balance : Number(prev.balance || 0);
            const nextBalance = currentBalance + balanceIncrement;
            const normalizedBalance = Math.round(nextBalance * 100) / 100;
            return {
              ...prev,
              balance: Number.isFinite(normalizedBalance) ? normalizedBalance : currentBalance,
            };
          });
        }
      }, 750);
    }

    socket.off("donation_history_reset");
    socket.off("withdrawal_approved"); // Ensure previous listener is removed
    socket.on("withdrawal_approved", (data) => {
      console.log("💸 Withdrawal approved received:", data);
      setStreamerInfo(prev => {
        if (!prev) return prev;
        const parsed = Number(data?.newBalance);
        const rawNextBalance = Number.isFinite(parsed)
          ? parsed
          : (typeof data?.newBalance === 'number' ? data.newBalance : Number(prev.balance || 0));
        const normalizedBalance = Math.round(rawNextBalance * 100) / 100;
        return {
          ...prev,
          balance: Number.isFinite(normalizedBalance) ? normalizedBalance : prev.balance,
        };
      });
      // Optionally, clear donations or show a message
    });
    socket.on("donation_history_reset", (data) => {
      console.log("🔄 Donation history reset received:", data);
      // Clear all donations and reset totals
      setDonations([]);
      setQueue([]);
      playedDonationsRef.current = new Set();
      processedDonationIdsRef.current = new Set();
      playbackFailuresRef.current = new Map();
      setPlaybackWarning(null);
      // Stop any current playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      playingRef.current = false;
      setCurrentPlaying(null);
      console.log("✅ Donation history reset complete");
    });

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("streamer_heartbeat_ack", handleHeartbeatAck);
      socket.off("new_donation");
      socket.off("donation_paid");
      socket.off("donation_history_reset");
      socket.off("withdrawal_approved");
      if (bufferFlushIntervalRef.current) {
        clearInterval(bufferFlushIntervalRef.current);
        bufferFlushIntervalRef.current = null;
      }
      stopHeartbeat();
      clearReconnectTimeout();
    };
  }, [uuid, enabled, currentPage, fetchInitialData, getDonationCacheKey, apiClient, scheduleReconnect, startHeartbeat, stopHeartbeat, resetReconnectState, clearReconnectTimeout, sortDonationsOldestFirst]);

  // ✅ Watch for queue changes
  useEffect(() => {
    if (enabled && !playingRef.current && queue.length > 0) {
      console.log("🎵 Starting next queued donation...");
      playNext();
    }
  }, [queue, enabled, playNext]);

  useEffect(() => {
    playNextRef.current = playNext;
  }, [playNext]);

  // ✅ Stop playback when disabled
  useEffect(() => {
    if (!enabled && audioRef.current) {
      console.log("🔇 Audio disabled, stopping playback");
      // For Web Audio API, stop the source node
      if (audioRef.current.stop) {
        audioRef.current.stop();
      } else if (audioRef.current.pause) {
        // Fallback for HTMLAudioElement if it's still used somewhere
        audioRef.current.pause();
      }
      audioRef.current = null;
      playingRef.current = false;
      setCurrentPlaying(null);
    }
  }, [enabled]);

  // ✅ Periodic AudioContext health check - resume if suspended while audio is enabled
  useEffect(() => {
    if (!enabled) return;

    const checkAudioContext = async () => {
      if (!audioContextRef.current) return;

      if (audioContextRef.current.state === 'suspended' && document.visibilityState === 'visible') {
        console.log("🔄 AudioContext suspended, attempting to resume...");
        try {
          await audioContextRef.current.resume();
          console.log("✅ AudioContext resumed by health check");

          // If there are queued donations and nothing is playing, start playback
          if (!playingRef.current && queue.length > 0) {
            setTimeout(() => {
              if (!playingRef.current && queue.length > 0) {
                playNext();
              }
            }, 100);
          }
        } catch (e) {
          console.warn("Failed to resume AudioContext:", e?.message);
        }
      }
    };

    // Check every 5 seconds
    const intervalId = setInterval(checkAudioContext, 5000);

    // Also check immediately
    checkAudioContext();

    return () => clearInterval(intervalId);
  }, [enabled, queue, playNext]);

  useEffect(() => {
    const wakeLockSupported = typeof navigator !== 'undefined' && !!navigator.wakeLock?.request;
    if (!wakeLockSupported) return undefined;
    if (!enabled) {
      releaseWakeLock();
      return undefined;
    }

    let cancelled = false;

    const acquire = () => {
      if (cancelled) return;
      requestWakeLock();
    };

    acquire();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && enabled) {
        acquire();
      } else if (document.visibilityState === 'hidden') {
        releaseWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      releaseWakeLock();
    };
  }, [enabled, requestWakeLock, releaseWakeLock]);

  // ✅ Load audio enabled state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("tts_enabled");
    if (saved === "true") setEnabled(true);
  }, []);



  // ✅ Apply theme on load and when darkMode changes
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // ✅ Save enabled state persistently
  useEffect(() => {
    localStorage.setItem("tts_enabled", enabled);
  }, [enabled]);

  // ✅ Keyboard shortcuts for volume control and skip
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only handle shortcuts when not typing in input fields
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const step = 0.05; // 5% increments
      let newVolume = volume;

      switch (e.key) {
        case 'ArrowUp':
        case 'ArrowRight':
          e.preventDefault();
          newVolume = Math.min(1, volume + step);
          break;
        case 'ArrowDown':
        case 'ArrowLeft':
          e.preventDefault();
          newVolume = Math.max(0, volume - step);
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          newVolume = volume === 0 ? 0.5 : 0; // Toggle mute
          break;
        case 's':
        case 'S':
          e.preventDefault();
          // Skip current donation if playing
          if (currentPlaying) {
            if (audioRef.current) {
              if (audioRef.current.stop) {
                audioRef.current.stop();
              } else if (audioRef.current.pause) {
                audioRef.current.pause();
              }
            }
            playingRef.current = false;
            setCurrentPlaying(null);
            markAsPlayed(currentPlaying);
            setQueue((prev) => prev.slice(1));
          }
          break;
        default:
          return;
      }

      if (newVolume !== volume) {
        setVolume(newVolume);
        localStorage.setItem('tts_volume', newVolume);
        // Smooth transition handled by useEffect above
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [volume, currentPlaying, markAsPlayed]);

  // ✅ Initial fetch when API client becomes available
  useEffect(() => {
    if (!apiClient) {
      setLoading(false);
      return;
    }

    fetchInitialData(1);
  }, [apiClient, fetchInitialData]);

  // ✅ Refetch on visibility change
  useEffect(() => {
    const handleVisibilityChange = async () => {
      const isVisible = document.visibilityState === 'visible';
      isPageVisibleRef.current = isVisible;

      if (isVisible) {
        console.log("Page is visible again, restoring connections...");
        setConnectionStatus(socket.connected ? 'connected' : 'connecting');

        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          try {
            await audioContextRef.current.resume();
            console.log("✅ AudioContext resumed after visibility change");
          } catch (e) {
            console.warn("Failed to resume AudioContext:", e?.message);
          }
        }

        if (!socket.connected) {
          console.log("Socket disconnected, reconnecting...");
          scheduleReconnect('page_visible');
        } else {
          socket.emit("join_streamer_room", uuid);
        }

        startHeartbeat();

        if (apiClient) {
          fetchInitialData(1, { silent: true });
        }

        if (enabled && !playingRef.current && queue.length > 0) {
          console.log("🎵 Resuming playback after tab visibility restored");
          setTimeout(() => {
            if (!playingRef.current && queue.length > 0) {
              playNext();
            }
          }, 100);
        }
      } else {
        console.log("Page hidden, keeping heartbeat alive");
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [uuid, fetchInitialData, apiClient, scheduleReconnect, startHeartbeat, stopHeartbeat, enabled, queue, playNext]);

  useEffect(() => {
    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = null;
    }
    if (!apiClient || currentPage !== 1) return;
    if (!Number.isFinite(KEEP_ALIVE_INTERVAL_MS) || KEEP_ALIVE_INTERVAL_MS <= 0) return;

    keepAliveIntervalRef.current = setInterval(() => {
      fetchInitialData(1, { silent: true });
    }, KEEP_ALIVE_INTERVAL_MS);

    return () => {
      if (keepAliveIntervalRef.current) {
        clearInterval(keepAliveIntervalRef.current);
        keepAliveIntervalRef.current = null;
      }
    };
  }, [apiClient, currentPage, fetchInitialData, KEEP_ALIVE_INTERVAL_MS]);






  const handlePageChange = (page) => {
    if (page !== currentPage) {
      setCurrentPage(page);
      fetchInitialData(page);
    }
  };

  // Get volume icon based on level
  const getVolumeIcon = (vol) => {
    if (vol === 0) return '🔇';
    if (vol <= 0.33) return '🔈';
    if (vol <= 0.66) return '🔉';
    return '🔊';
  };

  // Get volume color based on level
  const getVolumeColor = (vol) => {
    if (vol === 0) return 'text-gray-400';
    if (vol <= 0.33) return 'text-blue-500';
    if (vol <= 0.80) return 'text-green-500';
    return 'text-red-700'; // #AC3939 equivalent
  };

  const themeClasses = darkMode
    ? "min-h-screen streamer-bg-dark text-gray-100"
    : "min-h-screen streamer-bg-light text-gray-900";
  const cardBg = darkMode ? "card-dark" : "card-light";
  const connectionStatusLabelMap = {
    connected: 'Live Connection',
    connecting: 'Connecting…',
    reconnecting: 'Reconnecting…',
    disconnected: 'Offline',
    degraded: 'Checking Signal…',
    error: 'Connection Error',
    sleeping: 'Paused',
  };
  const connectionBadgeStyles = {
    connected: 'bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800',
    connecting: 'bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-800',
    reconnecting: 'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-100 dark:border-amber-800',
    disconnected: 'bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-900/30 dark:text-rose-100 dark:border-rose-800',
    degraded: 'bg-orange-100 text-orange-800 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-100 dark:border-orange-800',
    error: 'bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-900/30 dark:text-rose-100 dark:border-rose-800',
    sleeping: 'bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-800/60 dark:text-gray-300 dark:border-gray-700',
  };
  const connectionBadgeClass = connectionBadgeStyles[connectionStatus] || connectionBadgeStyles.connecting;
  const offlineDurationLabel = offlineDurationMinutes === null
    ? null
    : offlineDurationMinutes === 0
      ? '<1m'
      : `${offlineDurationMinutes}m`;
  const connectionStatusLabel = connectionStatus === 'disconnected' && offlineDurationLabel
    ? `${connectionStatusLabelMap.disconnected} · ${offlineDurationLabel}`
    : connectionStatusLabelMap[connectionStatus] || 'Checking…';
  const lastHeartbeatLabel = lastHeartbeatAt ? new Date(lastHeartbeatAt).toLocaleTimeString() : '—';
  const isLive = Boolean(streamerInfo?.live_status);
  const liveSinceLabel = streamerInfo?.live_since ? new Date(streamerInfo.live_since).toLocaleTimeString() : null;
  const liveBadgeClass = isLive
    ? 'bg-emerald-100 text-emerald-900 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-100 dark:border-emerald-800'
    : 'bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-800/50 dark:text-gray-300 dark:border-gray-700';

  if (loading && donations.length === 0) { // Only show full-screen loader on initial load
    return (
      <div className={`${themeClasses} flex items-center justify-center min-h-screen`}>
        <LoadingSpinner
          size="lg"
          text="Loading dashboard..."
          className="text-center"
        />
      </div>
    );
  }

  return (
    <div className={`${themeClasses} p-3 sm:p-4 md:p-6 lg:p-8 transition-colors duration-300 relative`}>

      <ApiKeyModal
        isOpen={isModalOpen && !usingSession}
        onClose={handleModalClose}
        onSubmit={handleApiKeySubmit}
        title="Streamer API Key Required"
        message="Please enter your secret API Key to connect to your dashboard. You can find this key in the registration message from the Telegram bot."
      />
      <header className="mb-6">
        <div className={`streamer-card streamer-glow-blue overflow-hidden`}>
          
          {/* Zone 1: Brand & System Header */}
          <div className={`px-4 py-3 flex items-center justify-between border-b ${darkMode ? 'border-white/[0.06] bg-black/20' : 'border-gray-100 bg-gray-50/60'}`}>
            {/* Left: Brand */}
            <div className="flex items-center gap-3">
              <div className="relative w-9 h-9">
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-xl opacity-20 blur-sm"></div>
                <img src="/image/habesha-logo.png" alt="Habesha TTS" className="relative w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="text-base font-bold text-gray-900 dark:text-white leading-none tracking-tight">
                  Habesha TTS
                </h1>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium tracking-wide uppercase mt-0.5">
                  Streamer Dashboard
                </p>
              </div>
            </div>

            {/* Right: System Controls */}
            <div className="flex items-center gap-3">
              <ThemeToggle isDarkMode={darkMode} toggleDarkMode={setDarkMode} />
              {usingSession && (
                <>
                  <div className="w-px h-4 bg-gray-200 dark:bg-white/10"></div>
                  <button
                    onClick={async () => {
                      try { await logout(); } catch { }
                      navigate(`/streamer/${uuid}/login`);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-red-200/60 dark:border-red-900/40 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-xs font-semibold"
                  >
                    Logout
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Zone 1.5: Connection Status Strip */}
          <div className={`px-4 py-2 flex items-center gap-3 text-xs border-b ${darkMode ? 'border-white/[0.06] bg-black/10' : 'border-gray-100 bg-white/40'}`}>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold text-[11px] ${connectionBadgeClass}`}>
              <span className="text-[10px]">🛰️</span>
              {connectionStatusLabel}
              {connectionAttempts > 0 && connectionStatus !== 'connected' ? (
                <span className="text-[11px] font-normal opacity-80">(attempt {connectionAttempts})</span>
              ) : null}
            </span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <span>Last heartbeat:</span>
              <span className="font-mono font-medium text-gray-700 dark:text-gray-300">{lastHeartbeatLabel}</span>
            </span>
          </div>

          {/* Zone 2: Main Control Deck (Middle) */}
          <div className="p-5 sm:p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              
              {/* Left: Identity & Balance */}
              {streamerInfo && (
                <div className="flex items-center gap-4 w-full md:w-auto">
                  {/* Avatar */}
                  <div className="relative">
                    {streamerInfo.profile_picture_url ? (
                      <img src={streamerInfo.profile_picture_url} alt="Profile" className="w-14 h-14 rounded-2xl object-cover ring-2 ring-offset-2 ring-blue-500/50 dark:ring-blue-400/30 dark:ring-offset-gray-900" />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl ring-2 ring-offset-2 ring-purple-500/40 dark:ring-offset-gray-900 shadow-lg shadow-purple-500/20">
                        {(streamerInfo.username || 'S').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 bg-gray-900 text-white text-[9px] px-1.5 py-0.5 rounded-md border border-white/20 font-semibold tracking-wide uppercase">
                      Streamer
                    </div>
                  </div>

                  <div className="flex-1">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight tracking-tight">
                      {streamerInfo.full_name || `@${streamerInfo.username}`}
                    </h1>
                    
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-baseline gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-xl border border-emerald-200/60 dark:border-emerald-800/40">
                        <span className="text-sm">💰</span>
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold text-lg"><Balance value={streamerInfo.balance} showLabel={false} /></span>
                      </div>
                      <button
                        onClick={() => navigate(`/withdraw/${uuid}`)}
                        className="text-xs bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white px-3.5 py-2 rounded-xl shadow-md shadow-emerald-500/20 transition-all hover:shadow-lg hover:shadow-emerald-500/25 flex items-center gap-1.5 font-semibold"
                      >
                        <span>💸</span> Withdraw
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Right: Live Control */}
              {streamerInfo && (
                <div className="flex flex-col items-end gap-2.5 w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0 border-gray-100/60 dark:border-white/[0.06]">
                  <button
                    type="button"
                    disabled={!apiClient || liveToggleLoading}
                    onClick={handleLiveToggle}
                    className={`w-full md:w-auto flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-2xl font-bold shadow-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] ${
                      isLive
                        ? 'bg-white text-rose-600 border-2 border-rose-100 hover:border-rose-200 hover:bg-rose-50 dark:bg-gray-800/80 dark:text-rose-400 dark:border-rose-900/50 dark:hover:bg-rose-900/20 streamer-glow-live'
                        : 'bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-600 text-white hover:shadow-xl hover:shadow-purple-500/25'
                    } ${(!apiClient || liveToggleLoading) ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    {liveToggleLoading ? (
                      <>
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a12 12 0 00-9 11h4z" />
                        </svg>
                        <span>Updating...</span>
                      </>
                    ) : (
                      <>
                        <span className="text-xl">{isLive ? '⏹️' : '📡'}</span>
                        <span>{isLive ? 'End Live Session' : 'Go Live Now'}</span>
                      </>
                    )}
                  </button>
                  
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`inline-block w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`}></span>
                    <span className="text-gray-500 dark:text-gray-400 font-medium">
                      {isLive ? (liveSinceLabel ? `Live since ${liveSinceLabel}` : 'Live') : 'Offline'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Zone 3: Audio Toolbar (Bottom) */}
          <div className={`px-4 py-3 border-t flex flex-wrap items-center justify-between gap-4 ${darkMode ? 'bg-black/15 border-white/[0.06]' : 'bg-gray-50/60 border-gray-100'}`}>
            
            {/* Audio Toggle */}
            <button
              onClick={async () => {
                if (!enabled) {
                  try {
                    const ctx = ensureAudioContext();
                    if (ctx && ctx.state === 'suspended') {
                      await ctx.resume();
                    }

                    if (ctx) {
                      const buffer = ctx.createBuffer(1, 1, 22050);
                      const source = ctx.createBufferSource();
                      source.buffer = buffer;
                      source.connect(gainNodeRef.current || ctx.destination);
                      source.start(0);
                      source.stop(ctx.currentTime + 0.001);
                    } else {
                      const silent = new Audio('data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA');
                      silent.volume = 0;
                      silent.muted = true;
                      silent.playsInline = true;
                      await silent.play();
                      silent.pause();
                    }

                    console.log("Audio permission granted; enabling autoplay.");
                    setEnabled(true);
                    playbackFailuresRef.current.clear();
                    setPlaybackWarning(null);

                    setTimeout(() => {
                      if (!playingRef.current && queue.length > 0) {
                        playNext();
                      }
                    }, 50);
                  } catch (e) {
                    console.error("Audio autoplay unlock failed:", e);
                    alert("Could not enable audio automatically. Please check your browser's autoplay settings for this site.");
                  }
                } else {
                  setEnabled(false);
                }
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                enabled 
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' 
                  : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
              }`}
            >
              <span>{enabled ? "🔊" : "🔇"}</span>
              <span>{enabled ? "Audio On" : "Audio Off"}</span>
            </button>

            {/* Volume Slider */}
            <div className="flex-1 max-w-xs flex items-center gap-3 mx-auto">
              <span className="text-xs text-gray-400">{getVolumeIcon(volume)}</span>
              <div className="relative flex-1 h-8 flex items-center group">
                  <input
                    id="volume-slider"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(e) => {
                      const newVolume = Number(e.target.value);
                      setVolume(newVolume);
                      localStorage.setItem('tts_volume', newVolume);
                    }}
                    className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer dark:bg-gray-700/60 focus:outline-none focus:ring-2 focus:ring-blue-500/30 accent-blue-500"
                    style={{
                      background: `linear-gradient(to right, ${volume === 0 ? '#6B7280' : volume <= 0.33 ? '#6366f1' : volume <= 0.80 ? '#10B981' : '#EF4444'} 0%, ${volume === 0 ? '#6B7280' : volume <= 0.33 ? '#6366f1' : volume <= 0.80 ? '#10B981' : '#EF4444'} ${volume * 100}%, ${darkMode ? '#374151' : '#E5E7EB'} ${volume * 100}%, ${darkMode ? '#374151' : '#E5E7EB'} 100%)`
                    }}
                  />
                  {/* Tooltip */}
                  <div className="absolute -top-7 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none translate-y-1 group-hover:translate-y-0">
                    {Math.round(volume * 100)}%
                  </div>
              </div>
            </div>

            {/* Skip Button */}
            <button
              onClick={() => {
                if (currentPlaying) {
                  if (audioRef.current) {
                    if (audioRef.current.stop) {
                      audioRef.current.stop();
                    } else if (audioRef.current.pause) {
                      audioRef.current.pause();
                    }
                  }
                  playingRef.current = false;
                  setCurrentPlaying(null);
                  markAsPlayed(currentPlaying);
                  setQueue((prev) => prev.slice(1));
                  clearPlaybackFailure(currentPlaying);
                  setPlaybackWarning(null);
                }
              }}
              disabled={!currentPlaying}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                currentPlaying
                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600'
              }`}
            >
              <span>⏭️</span>
              <span>Skip</span>
            </button>

          </div>
        </div>
      </header>
      {liveStatusMessage && (
        <div
          className={`mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg border text-sm sm:text-base shadow-sm flex items-start justify-between gap-3 ${liveStatusMessage.type === 'error'
            ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-900/20 dark:border-rose-900 dark:text-rose-100'
            : liveStatusMessage.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-900 dark:text-amber-100'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-900 dark:text-emerald-100'}`}
        >
          <span>{liveStatusMessage.message}</span>
          <button
            type="button"
            onClick={() => setLiveStatusMessage(null)}
            className="text-xs uppercase tracking-wide font-semibold opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className={`streamer-card p-4 sm:p-5 mb-4 sm:mb-6 ${currentPlaying ? 'ring-1 ring-emerald-500/30 dark:ring-emerald-400/20' : ''} transition-all duration-300`}>
        <div className="flex flex-col gap-3 sm:gap-4">
          {/* Queue Info and Playing Indicator - Horizontal Layout */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-md shadow-blue-500/20">
                <span className="text-white text-lg sm:text-xl">🎵</span>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-1 tracking-tight">
                  Audio Queue
                </h3>
                <div className="flex items-center gap-2 text-xs sm:text-sm">
                  <span className="badge badge-primary">{queue.length}</span>
                  <span className="text-gray-500 dark:text-gray-400">
                    pending
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Mini stats */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200/60 dark:border-blue-500/10">
                <span className="text-sm">🎁</span>
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">{pagination?.totalCount || 0}</span>
                <span className="text-[10px] text-blue-500 dark:text-blue-400 hidden sm:inline">donations</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200/60 dark:border-purple-500/10">
                <span className="text-sm">🎵</span>
                <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">{queue.length}</span>
                <span className="text-[10px] text-purple-500 dark:text-purple-400 hidden sm:inline">queued</span>
              </div>
            </div>
          </div>

          {/* Now Playing Indicator */}
          {currentPlaying && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-500/25">
              <div className="flex items-end gap-[3px] h-5">
                <span className="waveform-bar" style={{height: '4px'}}></span>
                <span className="waveform-bar" style={{height: '12px'}}></span>
                <span className="waveform-bar" style={{height: '8px'}}></span>
                <span className="waveform-bar" style={{height: '16px'}}></span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-xs sm:text-sm">Now Playing</p>
                <p className="text-[11px] opacity-80 truncate">Donation #{currentPlaying}</p>
              </div>
            </div>
          )}
          {playbackWarning && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-lg border border-amber-300 bg-amber-50/90 dark:bg-amber-900/30 p-3 text-sm text-amber-900 dark:text-amber-100">
              <div className="flex items-center gap-2">
                <span className="text-base">⚠️</span>
                <span>{playbackWarning}</span>
              </div>
              <div className="flex items-center gap-2 sm:ml-auto">
                <button
                  type="button"
                  className="btn btn-ghost btn-xs text-amber-700 dark:text-amber-200"
                  onClick={() => setPlaybackWarning(null)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section Label */}
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-600">Recent Donations</p>
        {donations.length > 0 && (
          <p className="text-[10px] sm:text-[11px] text-gray-400 dark:text-gray-600 font-medium">{donations.length} shown</p>
        )}
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {loading && donations.length === 0 && (
          <div className="col-span-full flex justify-center p-8 sm:p-12">
            <LoadingSpinner
              size="md"
              text="Loading donations..."
              className="text-center"
            />
          </div>
        )}
        {!loading && donations.length === 0 ? (
          <div className="streamer-card p-6 sm:p-8 lg:p-12 text-center col-span-full">
            <div className="mb-4 sm:mb-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20">
                <span className="text-2xl sm:text-4xl">💰</span>
              </div>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3 tracking-tight">እስካሁን ምንም ልገሳ የለም።</h3>
            <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mb-4 sm:mb-6 max-w-md mx-auto">
              ተመልካቾችዎ የቴሌግራም bot Link በማጋራት ልገሳ እንዲያደርጉ ያበረታቷቸው።
            </p>
            <div className="flex justify-center">
              <button className="btn btn-primary shadow-lg hover:shadow-xl text-sm sm:text-base">
                <span>🔗</span>
                <span className="ml-1 sm:ml-2">@Habeshatts_bot</span>
              </button>
            </div>
          </div>
        ) : loading ? (
          <SkeletonLoader type="donation" count={6} />
        ) : (
          donations.map((donation) => (
            <DonationCard
              key={donation.id}
              donation={donation}
              isPlaying={currentPlaying === donation.id}
              onFlagAction={apiClient ? (action) => handleFlagDonation(donation.id, action) : null}
              isFlagging={flaggingDonationId === donation.id}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      <Pagination pagination={pagination} onPageChange={handlePageChange} />

      {pagination && (
        <div className="text-center mt-3 sm:mt-4 text-xs sm:text-sm opacity-60">
          Page {pagination.currentPage} of {pagination.totalPages} • {pagination.totalCount} total donations
        </div>
      )}

      <footer className="mt-8 sm:mt-12 lg:mt-16 text-center">
        <div className="streamer-card p-4 sm:p-5 max-w-md mx-auto">
          <div className="flex items-center justify-center gap-2.5 mb-2">
            <div className="relative w-8 h-8 sm:w-9 sm:h-9">
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-lg opacity-15 blur-sm"></div>
              <img src="/image/habesha-logo.png" alt="Habesha TTS" className="relative w-full h-full object-contain" />
            </div>
            <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600 text-sm sm:text-base">Powered by Habesha TTS</span>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            "ፈጣን ልገሳ በሀገረኛ መንገድ"
          </p>
        </div>
      </footer>

      {flagToasts.length > 0 && (
        <div
          className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 w-72 sm:w-80"
          aria-live="assertive"
        >
          {flagToasts.map((toast) => (
            <div
              key={toast.id}
              className={`rounded-2xl border shadow-2xl px-4 py-3.5 flex items-start gap-3 text-sm font-medium animate-slide-in-right overflow-hidden relative bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl ${
                toast.type === "success"
                  ? "border-emerald-200/60 dark:border-emerald-800/40"
                  : "border-red-200/60 dark:border-red-800/40"
              }`}
            >
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                toast.type === "success" ? "bg-emerald-500" : "bg-red-500"
              }`}></div>
              <div className="text-lg leading-none pl-1">
                {toast.type === "success" ? "✅" : "⚠️"}
              </div>
              <div className="flex-1">
                <p className="leading-tight text-gray-900 dark:text-white">{toast.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
