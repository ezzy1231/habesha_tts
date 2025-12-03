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
const MAX_PLAYBACK_RETRIES = Number(import.meta.env.VITE_STREAMER_PLAYBACK_RETRIES || 3);
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
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY_MS);
  const reconnectTimeoutRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const heartbeatTimeoutRef = useRef(null);
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
    if (!socket.connected || !isPageVisibleRef.current) return;

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

  const clearPlaybackFailure = useCallback((donationId) => {
    if (!donationId) return;
    const cacheKey = getDonationCacheKey(donationId);
    playbackFailuresRef.current.delete(cacheKey);
    if (playbackFailuresRef.current.size === 0) {
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
      setPlaybackWarning(`${baseMessage} Reached ${MAX_PLAYBACK_RETRIES} attempts. Tap Skip or reload to continue.`);
      return;
    }

    setPlaybackWarning(`${baseMessage} Retrying (${attempts}/${MAX_PLAYBACK_RETRIES})...`);

    if (pendingRetryRef.current) {
      clearTimeout(pendingRetryRef.current);
    }

    pendingRetryRef.current = setTimeout(() => {
      pendingRetryRef.current = null;
      if (!playingRef.current && queueRef.current.length > 0) {
        playNextRef.current?.();
      }
    }, PLAYBACK_RETRY_DELAY_MS);
  }, [getDonationCacheKey]);

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
        console.log("Page hidden, pausing heartbeat checks");
        stopHeartbeat();
        if (socket.connected) {
          setConnectionStatus('sleeping');
        }
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
    ? "min-h-screen gradient-dark text-gray-100"
    : "min-h-screen gradient-light text-gray-900";
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
  const connectionStatusLabel = connectionStatusLabelMap[connectionStatus] || 'Checking…';
  const lastHeartbeatLabel = lastHeartbeatAt ? new Date(lastHeartbeatAt).toLocaleTimeString() : '—';

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
      <header className="mb-4 sm:mb-6">
        <div className="card p-3 sm:p-4 md:p-6 shadow-xl relative">
                <div className="flex flex-wrap gap-3 mb-4">
                  <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${connectionBadgeClass}`}>
                    <span>🛰️</span>
                    {connectionStatusLabel}
                    {connectionAttempts > 0 && connectionStatus !== 'connected' ? (
                      <span className="text-[11px] font-normal opacity-80">(attempt {connectionAttempts})</span>
                    ) : null}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <span>Last heartbeat:</span>
                    <span className="font-medium">{lastHeartbeatLabel}</span>
                  </span>
                </div>
          {/* Header Controls - Theme Toggle and Logout */}
          <div className="absolute top-3 right-3 z-10 flex items-center gap-3">
            {usingSession && (
              <button
                onClick={async () => {
                  try { await logout(); } catch { }
                  navigate(`/streamer/${uuid}/login`);
                }}
                className="group relative inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 border border-gray-200 dark:border-gray-600 hover:border-red-200 dark:hover:border-red-800 transition-all duration-200 text-sm font-medium shadow-sm hover:shadow-md"
                title="Logout from dashboard"
              >
                <svg className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden sm:inline">Logout</span>
                {/* Tooltip for mobile */}
                <span className="sm:hidden absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                  Logout
                </span>
              </button>
            )}
            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600"></div>
            <ThemeToggle isDarkMode={darkMode} toggleDarkMode={setDarkMode} />
          </div>

          <div className="flex flex-col gap-4">
            {/* Dashboard Title */}
            <div className="flex items-center gap-2 sm:gap-3 mb-3">
              <div className="p-1.5 sm:p-2 gradient-primary rounded-xl shadow-lg">
                <span className="text-white text-lg sm:text-xl">🎙️</span>
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white truncate">
                  Habesha TTS Dashboard
                </h1>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">Real-time donation management</p>
              </div>
            </div>

            {/* Streamer Info and Balance Row */}
            {streamerInfo && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Streamer Info with Balance */}
                <div className="flex items-center gap-3 flex-1">
                  {streamerInfo.profile_picture_url ? (
                    <img
                      src={streamerInfo.profile_picture_url}
                      alt="Profile"
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full gradient-avatar-purple flex items-center justify-center text-white font-bold text-lg sm:text-xl flex-shrink-0">
                      {(streamerInfo.username || 'S').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Streamer</p>
                    <div className="flex items-center gap-2 sm:gap-3">
                      <p className="text-base sm:text-xl font-bold text-gray-900 dark:text-white truncate">{streamerInfo.full_name || `@${streamerInfo.username}`}</p>

                      {/* Balance Badge */}
                      <div className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-full text-xs sm:text-sm font-medium shadow-lg">
                        <span className="text-xs sm:text-sm">💰</span>
                        <Balance
                          value={streamerInfo.balance}
                          className="font-semibold"
                          showLabel={false}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Controls - Compact Row */}
            {streamerInfo && (
              <div className="flex flex-wrap justify-around gap-2 sm:gap-3 mt-2">
                {/* Withdraw Button */}
                <button
                  onClick={() => navigate(`/withdraw/${uuid}`)}
                  className="btn btn-primary shadow-md hover:shadow-lg transition-all duration-300 text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-center gap-2 sm:gap-2.5 min-h-[40px] sm:min-h-[44px]"
                  title="Request withdrawal"
                >
                  <span className="text-sm sm:text-base">💸</span>
                  <span className="hidden sm:inline font-medium">Withdraw</span>
                  <span className="sm:hidden font-medium">Wd</span>
                </button>

                {/* Audio Toggle Button */}
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
                  className={`btn shadow-md hover:shadow-lg transition-all duration-300 text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-center gap-2 sm:gap-2.5 min-h-[40px] sm:min-h-[44px] ${enabled
                      ? "gradient-success hover:gradient-success-dark text-white"
                      : "gradient-gray hover:gradient-gray-dark text-white"
                    }`}
                  title={enabled ? "Disable Audio" : "Enable Audio"}
                >
                  <span className="text-sm sm:text-base">{enabled ? "🔊" : "🔇"}</span>
                  <span className="hidden sm:inline font-medium">{enabled ? "Audio On" : "Audio Off"}</span>
                  <span className="sm:hidden font-medium">{enabled ? "On" : "Off"}</span>
                </button>

                {/* Volume Control */}
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 shadow-inner min-h-[40px] sm:min-h-[44px] relative group">
                  <span className={`text-sm sm:text-base transition-colors duration-200 ${getVolumeColor(volume)}`}>
                    {getVolumeIcon(volume)}
                  </span>
                  <div className="relative">
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
                        // Smooth transition handled by useEffect above
                      }}
                      className="range-input w-20 sm:w-24 h-1.5 sm:h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer dark:bg-gray-600 transition-all duration-200 hover:scale-105"
                      style={{
                        background: `linear-gradient(to right, ${volume === 0 ? '#9CA3AF' : volume <= 0.33 ? '#3B82F6' : volume <= 0.80 ? '#10B981' : '#AC3939'} 0%, ${volume === 0 ? '#9CA3AF' : volume <= 0.33 ? '#3B82F6' : volume <= 0.80 ? '#10B981' : '#AC3939'} ${volume * 100}%, #D1D5DB ${volume * 100}%, #D1D5DB 100%)`
                      }}
                    />
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                      {Math.round(volume * 100)}%
                    </div>
                  </div>
                </div>

                {/* Skip Button */}
                <button
                  onClick={() => {
                    if (currentPlaying) {
                      // Stop current playback and mark as played
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
                  className={`btn shadow-md hover:shadow-lg transition-all duration-300 text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-center gap-2 sm:gap-2.5 min-h-[40px] sm:min-h-[44px] ${currentPlaying
                      ? "gradient-warning hover:gradient-warning-dark text-white"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                    }`}
                  title={currentPlaying ? "Skip current donation (S key)" : "No donation playing"}
                >
                  <span className="text-sm sm:text-base">⏭️</span>
                  <span className="hidden sm:inline font-medium">Skip</span>
                  <span className="sm:hidden font-medium">Skip</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className={`${cardBg} p-3 sm:p-4 rounded-xl mb-4 sm:mb-6 shadow-xl border`}>
        <div className="flex flex-col gap-3 sm:gap-4">
          {/* Queue Info and Playing Indicator - Horizontal Layout */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-3 gradient-primary rounded-xl shadow-lg">
                <span className="text-white text-lg sm:text-2xl">🎵</span>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-1">
                  Audio Queue
                </h3>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <span className="badge badge-primary">{queue.length}</span>
                    <span className="text-gray-600 dark:text-gray-300">
                      pending donation{queue.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="badge badge-gray">{pagination?.totalCount || 0}</span>
                    <span className="text-gray-600 dark:text-gray-300">total</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Now Playing Indicator - Aligned to the right on desktop, below on mobile */}
            {currentPlaying && (
              <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 gradient-success text-white rounded-xl shadow-lg animate-pulse">
                <div className="relative">
                  <span className="text-sm sm:text-lg animate-pulse">🔊</span>
                  <div className="absolute -top-1 -right-1 w-2 h-2 sm:w-3 sm:h-3 bg-white rounded-full animate-ping"></div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-xs sm:text-sm">Now Playing</p>
                  <p className="text-xs opacity-90 truncate">Donation #{currentPlaying}</p>
                </div>
              </div>
            )}
          </div>
          {playbackWarning && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-lg border border-amber-300 bg-amber-50/90 dark:bg-amber-900/30 p-3 text-sm text-amber-900 dark:text-amber-100">
              <div className="flex items-center gap-2">
                <span className="text-base">⚠️</span>
                <span>{playbackWarning}</span>
              </div>
              <div className="flex items-center gap-2 sm:ml-auto">
                <button
                  type="button"
                  className="btn btn-xs gradient-warning text-white"
                  onClick={() => {
                    playbackFailuresRef.current.clear();
                    setPlaybackWarning(null);
                    if (!playingRef.current && queue.length > 0) {
                      playNext();
                    }
                  }}
                >
                  Retry Now
                </button>
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
          <div className={`${cardBg} p-6 sm:p-8 lg:p-12 rounded-xl text-center shadow-xl border col-span-full`}>
            <div className="mb-4 sm:mb-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto gradient-primary rounded-full flex items-center justify-center shadow-lg">
                <span className="text-2xl sm:text-4xl">💰</span>
              </div>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3">እስካሁን ምንም ልገሳ የለም።</h3>
            <p className="text-sm sm:text-lg text-gray-600 dark:text-gray-300 mb-4 sm:mb-6 max-w-md mx-auto">
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
            <DonationCard key={donation.id} donation={donation} isPlaying={currentPlaying === donation.id} />
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
        <div className="card p-4 sm:p-6 max-w-md mx-auto">
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-2 sm:mb-3">
            <div className="p-1.5 sm:p-2 gradient-primary rounded-lg">
              <span className="text-white text-lg sm:text-xl">🚀</span>
            </div>
            <span className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">Powered by Habesha TTS</span>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
            "ፈጣን ልገሳ በሀገረኛ መንገድ"
          </p>
        </div>
      </footer>
    </div>
  );
}
