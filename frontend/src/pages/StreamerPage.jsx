import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import io from "socket.io-client";
import DonationCard from "../components/DonationCard";
import Pagination from "../components/Pagination";
import Balance from "../components/Balance";

import ApiKeyModal from '../components/ApiKeyModal';

const SOCKET_URL = import.meta.env.VITE_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000';
const socket = io(SOCKET_URL, { transports: ["websocket"], reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000 });

export default function StreamerPage() {
  const { uuid } = useParams();
  const navigate = useNavigate();
  const [donations, setDonations] = useState([]);
  const [enabled, setEnabled] = useState(false);
  const [queue, setQueue] = useState([]);
  const [currentPlaying, setCurrentPlaying] = useState(null);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('streamer_theme');
    return saved === 'dark';
  });
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
  const [volume, setVolume] = useState(() => {
    const savedVolume = localStorage.getItem('tts_volume');
    return savedVolume !== null ? Number(savedVolume) : 1;
  });

  // Create a memoized axios instance that includes the API key
  const apiClient = useMemo(() => {
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
  }, [apiKey]);

  // On initial load, check for API Key
  useEffect(() => {
    const key = localStorage.getItem(`apiKey_${uuid}`);
    if (key) {
      console.log("[API Key Load] Found API Key in local storage (first 5 chars):", key.substring(0, 5));
      setApiKey(key);
    } else {
      console.log("[API Key Load] No API Key found in local storage, opening modal.");
      setIsModalOpen(true);
    }
  }, [uuid]);

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
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) {
      audioContextRef.current = new Ctx();
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.connect(audioContextRef.current.destination);
    }
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Update volume when it changes without recreating AudioContext
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume;
    }
  }, [volume]);

  // ✅ Fetch streamer info + donation history
  const fetchInitialData = useCallback(async (page = 1) => {
    if (!apiClient) return; // Don't fetch if the client isn't ready
    console.log(`Fetching data for streamer ${uuid} page ${page}`);
    try {
      setLoading(true);

      let newDonations;
      let newPagination;

      if (page === 1) {
        // Initial load: Use the public endpoint that gets everything.
        // We still wait for apiClient to be ready to ensure the user has authenticated.
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/streamer/${uuid}?page=${page}`);
        setStreamerInfo(res.data.streamer);
        newDonations = res.data.donations || [];
        newPagination = res.data.pagination;
        console.log(`[fetchInitialData] Fetched donations (page ${page}):`, newDonations.map(d => ({ id: d.id, played: d.played })));
        
        const audioReady = newDonations.filter(
          (d) => d.status === "paid" && d.audio_url && !d.played
        );
        setQueue(audioReady);
        console.log(`[StreamerPage] 📥 Loaded ${audioReady.length} unplayed donations to queue`);

      } else {
        // Pagination: Use the protected endpoint to get just the next page of donations
        const res = await apiClient.get(`/streamer/${uuid}/donations?page=${page}`);
        newDonations = res.data.donations || [];
        newPagination = res.data.pagination;
        console.log(`[fetchInitialData] Fetched paginated donations (page ${page}):`, newDonations.map(d => ({ id: d.id, played: d.played })));
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
      setLoading(false);
    }
  }, [uuid, apiClient]);

  // ✅ Mark a donation as played and persist it
  const markAsPlayed = useCallback(async (id) => {
    if (!apiClient) return;
    if (playedDonationsRef.current.has(id)) return;

    // Update the UI immediately
    setDonations(prev => prev.map(d => d.id === id ? { ...d, played: true } : d));
    playedDonationsRef.current.add(id);

    try {
      await apiClient.post(`/streamer/${uuid}/donations/${id}/played`);
      console.log("✅ Donation marked as played in DB:", id);
    } catch (error) {
      console.error("❌ Error marking donation as played:", error.response?.status, error.response?.data, error);
      // If API fails, revert the UI update
      setDonations(prev => prev.map(d => d.id === id ? { ...d, played: false } : d));
      playedDonationsRef.current.delete(id);
    }
  }, [uuid, apiClient]);

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

    const baseUrl = SOCKET_URL;
    const donationUrl = `${baseUrl}/public/audios/${encodeURIComponent(audioFilename)}`;
    const notificationUrlPrimary = `${baseUrl}/public/sounds/notification.mp3`;
    const notificationUrlFallback = `${baseUrl}/public/audios/notification.mp3`;

    const playDonation = async () => {
      console.log(`[playDonation] Attempting to play donation ${nextDonation.id}. AudioContext state: ${audioContextRef.current?.state}`);
      if (!audioContextRef.current) {
        console.error("❌ [playDonation] AudioContext not initialized.");
        playingRef.current = false;
        setCurrentPlaying(null);
        markAsPlayed(nextDonation.id);
        setQueue((prev) => prev.slice(1));
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
            playingRef.current = false;
            setCurrentPlaying(null);
            markAsPlayed(nextDonation.id);
            setQueue((prev) => prev.slice(1));
            return;
          }
        }

        console.log(`[playDonation] Fetching donation audio from: ${donationUrl}`);
        const response = await fetch(donationUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        console.log("[playDonation] Audio fetched, decoding...");
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
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
        };

        console.log("🔊 [playDonation] Playing donation (Web Audio):", donationUrl);
        source.start(0);
        audioRef.current = source; // Store the source node for potential stopping

        // Fallback: mark as played after audio duration + 1 second in case onended doesn't fire
        setTimeout(() => {
          console.log("[playDonation] Fallback: Marking as played after timeout.");
          markAsPlayed(nextDonation.id);
        }, (audioBuffer.duration * 1000) + 1000);
      } catch (err) {
        console.error("❌ [playDonation] Donation audio error (Web Audio):", err.name, err.message, err);
        if (err.name === 'NotAllowedError') {
          console.log("🔇 [playDonation] Autoplay blocked. User needs to interact with page first.");
          playingRef.current = false;
          setCurrentPlaying(null);
          return;
        }
        playingRef.current = false;
        setCurrentPlaying(null);
        markAsPlayed(nextDonation.id);
        setQueue((prev) => prev.slice(1));
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
      } catch (e) {
        console.error("⚠️ [playNotificationThenDonation] Notification play failed (Web Audio), skipping to donation:", e.name, e.message, e);
        playDonation();
      }
    };

    // Start sequence
    playNotificationThenDonation();
  }, [enabled, queue, setCurrentPlaying, playedDonationsRef, uuid, markAsPlayed]);



  // ✅ Real-time listener
  useEffect(() => {
    socket.emit("join_streamer_room", uuid);

    socket.on("connect", () => console.log("🔗 Socket connected"));
    socket.on("disconnect", () => console.log("🔌 Socket disconnected"));
    socket.on("reconnect", () => {
      console.log("🔄 Socket reconnected, rejoining room");
      socket.emit("join_streamer_room", uuid);
    });

    socket.off("new_donation");
    socket.on("new_donation", (data) => {
      console.log("💸 [StreamerPage] New donation received via socket:", data);
      console.log(`[StreamerPage] New donation ID: ${data.id}, Played status from socket: ${data.played}`);
      const normalized = { ...data }; // Use the 'played' status directly from data
      // Add to UI donations if we are on the first page
      if (currentPage === 1) {
        setDonations((prev) => {
          // Avoid duplicates
          if (prev.some((d) => Number(d.id) === Number(normalized.id))) return prev;
          console.log("[StreamerPage] Adding new donation to UI:", normalized);
          return [normalized, ...prev];
        });
      }
      // Add to audio queue if playable and not already queued/played in this session
      if (normalized && normalized.status === 'paid' && normalized.audio_url && !normalized.played && !playedDonationsRef.current.has(normalized.id)) {
        setQueue((prev) => {
          if (prev.some((d) => Number(d.id) === Number(normalized.id))) return prev;
          console.log("[StreamerPage] Adding new donation to audio queue:", normalized);
          return [...prev, normalized];
        });
      }
      // Increment total count in pagination
      setPagination((prev) => {
        const newPagination = prev ? { ...prev, totalCount: (prev.totalCount || 0) + 1 } : prev;
        console.log("[StreamerPage] Updated pagination after new donation:", newPagination);
        return newPagination;
      });
    });

    socket.off("donation_history_reset");
    socket.off("withdrawal_approved"); // Ensure previous listener is removed
    socket.on("withdrawal_approved", (data) => {
      console.log("💸 Withdrawal approved received:", data);
      setStreamerInfo(prev => ({
        ...prev,
        balance: typeof data?.newBalance === 'number' ? data.newBalance : (prev?.balance ?? 0)
      }));
      // Optionally, clear donations or show a message
    });
    socket.on("donation_history_reset", (data) => {
      console.log("🔄 Donation history reset received:", data);
      // Clear all donations and reset totals
      setDonations([]);
      setQueue([]);
      playedDonationsRef.current = new Set();
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
      socket.off("connect");
      socket.off("disconnect");
      socket.off("reconnect");
      socket.off("new_donation");
      socket.off("donation_paid");
      socket.off("donation_history_reset");
      socket.off("withdrawal_approved");
    };
  }, [uuid, enabled, currentPage, fetchInitialData]);

  // ✅ Watch for queue changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (enabled && !playingRef.current && queue.length > 0) {
      console.log("🎵 Starting next queued donation...");
      playNext();
    }
  }, [queue, enabled, playNext]);

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

  // ✅ Load audio enabled state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("tts_enabled");
    if (saved === "true") setEnabled(true);
  }, []);

  // ✅ Apply theme on load
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

  // ✅ Initial load and refetch on visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && apiClient) {
        console.log("Page is visible again, refetching data...");
        fetchInitialData(1);
      }
    };

    if (apiClient) {
      fetchInitialData(1);
    } else {
      setLoading(false);
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [uuid, fetchInitialData, apiClient]);

  const toggleTheme = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('streamer_theme', newDarkMode ? 'dark' : 'light');
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };


  const toggleEnabled = () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    if (newEnabled && !audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
  };

  const handlePageChange = (page) => {
    if (page !== currentPage) {
      setCurrentPage(page);
      fetchInitialData(page);
    }
  };

const themeClasses = darkMode
    ? "min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-100"
    : "min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 text-gray-900";
  const cardBg = darkMode ? "bg-gray-800/80 backdrop-blur-lg border-gray-700" : "bg-white/90 backdrop-blur-lg border-gray-200";

if (loading && donations.length === 0) { // Only show full-screen loader on initial load
    return (
      <div className={`${themeClasses} flex items-center justify-center min-h-screen`}>
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-primary/20 rounded-full animate-spin"></div>
            <div className="absolute top-0 left-0 w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-lg mt-4 font-medium text-gray-600 dark:text-gray-300">Loading dashboard...</p>
        </div>
      </div>
    );
  }

return (
    <div className={`${themeClasses} p-3 sm:p-4 md:p-6 lg:p-8 transition-colors duration-300 relative`}>
      {/* Theme Toggle - Top Right Corner */}
      <div className="fixed top-3 right-3 sm:top-4 sm:right-4 z-40">
        <button
          onClick={toggleTheme}
          className="btn btn-ghost hover:bg-gray-100 dark:hover:bg-gray-700 shadow-lg hover:shadow-xl transition-all duration-300 text-xs sm:text-sm px-2 sm:px-3 py-2"
          title="Toggle theme"
          aria-label="Toggle theme"
        >
          <span className="text-sm sm:text-base">{darkMode ? "🌞" : "🌙"}</span>
          <span className="hidden sm:inline ml-1">{darkMode ? "Light" : "Dark"}</span>
        </button>
      </div>

      <ApiKeyModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSubmit={handleApiKeySubmit}
        title="Streamer API Key Required"
        message="Please enter your secret API Key to connect to your dashboard. You can find this key in the registration message from the Telegram bot."
      />
<header className="mb-4 sm:mb-6">
        <div className="card p-3 sm:p-4 md:p-6 shadow-xl">
          <div className="flex flex-col gap-4">
            {/* Dashboard Title and Streamer Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 sm:gap-3 mb-3">
                <div className="p-1.5 sm:p-2 bg-gradient-to-r from-primary to-secondary rounded-xl shadow-lg">
                  <span className="text-white text-lg sm:text-xl">🎙️</span>
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white truncate">
                    Habesha TTS Dashboard
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">Real-time donation management</p>
                </div>
              </div>
              
              {streamerInfo && (
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-xl p-3">
                  <div className="flex flex-col gap-4">
                    {/* Streamer Info Row */}
                    <div className="flex items-center gap-3">
                      {streamerInfo.profile_picture_url ? (
                        <img 
                          src={streamerInfo.profile_picture_url} 
                          alt="Profile" 
                          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg sm:text-xl flex-shrink-0">
                          {(streamerInfo.username || 'S').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Streamer</p>
                        <p className="text-base sm:text-xl font-bold text-gray-900 dark:text-white truncate">{streamerInfo.full_name || `@${streamerInfo.username}`}</p>
                      </div>
                    </div>
                    
                    {/* Balance and Actions Row - Horizontal Alignment */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="bg-white dark:bg-gray-800 rounded-lg px-4 py-3 shadow-sm flex-1">
                        <Balance 
                          value={streamerInfo.balance} 
                          className="text-base sm:text-xl text-green-600 dark:text-green-400"
                          label="Current Balance"
                        />
                      </div>
                      
                      <div className="flex gap-3 flex-1 sm:flex-none">
                        <button
                          onClick={() => navigate(`/withdraw/${uuid}`)}
                          className="btn btn-primary shadow-lg hover:shadow-xl transition-all duration-300 text-sm sm:text-base px-4 py-3 flex-1 sm:flex-none min-w-[100px]"
                          title="Request withdrawal"
                        >
                          <span className="text-base sm:text-lg">💸</span>
                          <span className="ml-2 hidden sm:inline">Withdraw</span>
                          <span className="sm:hidden">Wd</span>
                        </button>

                        <div className="flex flex-col items-center gap-2 p-2 rounded-lg bg-gray-100 dark:bg-gray-700 shadow-inner flex-1 sm:flex-none min-w-[100px]">
                          <label htmlFor="volume-slider" className="text-xs font-medium text-gray-600 dark:text-gray-300">Volume</label>
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
                              if (gainNodeRef.current) {
                                gainNodeRef.current.gain.value = newVolume;
                              }
                            }}
                            className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer dark:bg-gray-600 accent-primary"
                          />
                        </div>

                        <button
                          onClick={async () => {
                            if (!enabled) {
                              try {
                                // Create or resume a Web Audio context to unlock autoplay policies
                                if (!audioContextRef.current) {
                                  const Ctx = window.AudioContext || window.webkitAudioContext;
                                  if (Ctx) {
                                    audioContextRef.current = new Ctx();
                                    gainNodeRef.current = audioContextRef.current.createGain();
                                    gainNodeRef.current.connect(audioContextRef.current.destination);
                                    gainNodeRef.current.gain.value = volume; // Set initial volume
                                  }
                                }
                                if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
                                  await audioContextRef.current.resume();
                                }

                                // Play a brief silent sound via WebAudio (more reliable than HTMLAudio in some browsers)
                                if (audioContextRef.current) {
                                  const ctx = audioContextRef.current;
                                  const buffer = ctx.createBuffer(1, 1, 22050);
                                  const source = ctx.createBufferSource();
                                  source.buffer = buffer;
                                  source.connect(ctx.destination);
                                  source.start(0);
                                } else {
                                  // Fallback: play a tiny silent data URI using HTMLAudioElement
                                  const silent = new Audio('data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA');
                                  silent.volume = 0;
                                  await silent.play();
                                  silent.pause();
                                }

                                console.log("Audio permission granted; enabling autoplay.");
                                setEnabled(true);

                                // If we already have queued items, kick off playback immediately
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
                          } }
                          className={`btn shadow-lg hover:shadow-xl transition-all duration-300 text-sm sm:text-base px-4 py-3 flex-1 sm:flex-none min-w-[100px] ${
                            enabled 
                              ? "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white" 
                              : "bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white"
                          }`}
                          title={enabled ? "Disable Audio" : "Enable Audio"}
                        >
                          <span className="text-base sm:text-lg">{enabled ? "🔊" : "🔇"}</span>
                          <span className="ml-2 hidden sm:inline">{enabled ? "Audio On" : "Audio Off"}</span>
                          <span className="sm:hidden">{enabled ? "On" : "Off"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

<div className={`${cardBg} p-3 sm:p-4 rounded-xl mb-4 sm:mb-6 shadow-xl border`}>
        <div className="flex flex-col gap-3 sm:gap-4">
          {/* Queue Info and Playing Indicator - Horizontal Layout */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-3 bg-gradient-to-r from-primary to-secondary rounded-xl shadow-lg">
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
              <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl shadow-lg animate-pulse">
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
        </div>
      </div>
<div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {loading && donations.length === 0 && (
          <div className="col-span-full flex justify-center p-8 sm:p-12">
            <div className="text-center">
              <div className="relative">
                <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-primary/20 rounded-full animate-spin"></div>
                <div className="absolute top-0 left-0 w-10 h-10 sm:w-12 sm:h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
              <p className="mt-4 text-sm sm:text-base text-gray-600 dark:text-gray-300">Loading donations...</p>
            </div>
          </div>
        )}
        
        {!loading && donations.length === 0 ? (
          <div className={`${cardBg} p-6 sm:p-8 lg:p-12 rounded-xl text-center shadow-xl border col-span-full`}>
            <div className="mb-4 sm:mb-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto bg-gradient-to-r from-primary to-secondary rounded-full flex items-center justify-center shadow-lg">
                <span className="text-2xl sm:text-4xl">💰</span>
              </div>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3">No Donations Yet</h3>
            <p className="text-sm sm:text-lg text-gray-600 dark:text-gray-300 mb-4 sm:mb-6 max-w-md mx-auto">
              Share your donation link to start receiving amazing messages from your supporters!
            </p>
            <div className="flex justify-center">
              <button className="btn btn-primary shadow-lg hover:shadow-xl text-sm sm:text-base">
                <span>🔗</span>
                <span className="ml-1 sm:ml-2">Copy Donation Link</span>
              </button>
            </div>
          </div>
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
            <div className="p-1.5 sm:p-2 bg-gradient-to-r from-primary to-secondary rounded-lg">
              <span className="text-white text-lg sm:text-xl">🚀</span>
            </div>
            <span className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">Powered by Habesha TTS</span>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
            Real-time donations with Ethiopian flair
          </p>
        </div>
      </footer>
    </div>
  );
}