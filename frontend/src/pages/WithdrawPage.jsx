import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import io from "socket.io-client";
import Balance from "../components/Balance";
import ApiKeyModal from '../components/ApiKeyModal';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import LoadingSpinner from '../components/LoadingSpinner';

const API = import.meta.env.VITE_BASE_URL || 'http://localhost:5000';
const SOCKET_URL = import.meta.env.VITE_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function WithdrawPage() {
  const { uuid } = useParams();
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [telebirrUsername, setTelebirrUsername] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [streamerBalance, setStreamerBalance] = useState(0);
  const { isAuthenticated } = useAuth();
  const REQUIRE_JWT = (import.meta.env.VITE_REQUIRE_JWT_DASHBOARD || 'false').toLowerCase() === 'true';
  const usingSession = REQUIRE_JWT && isAuthenticated;
  const [apiKey, setApiKey] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    // Check for theme in multiple possible keys for backward compatibility
    const saved = localStorage.getItem('theme') || localStorage.getItem('streamer_theme');
    return saved === 'dark';
  });

  // Create a memoized axios instance that includes the API key
  const apiClient = useMemo(() => {
    if (usingSession) {
      return axios.create({
        baseURL: '/api',
        withCredentials: true,
      });
    }
    if (!apiKey) return null;
    return axios.create({
      baseURL: import.meta.env.VITE_API_URL,
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
  }, [apiKey, usingSession]);

  // On initial load, check for API Key
  useEffect(() => {
    if (usingSession) {
      setIsModalOpen(false);
      return;
    }
    const key = localStorage.getItem(`apiKey_${uuid}`);
    if (key) {
      setApiKey(key);
    } else {
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

  useEffect(() => {
    const fetchStreamerBalance = async () => {
      if (!apiClient) return;
      try {
        // Public streamer info endpoint remains /streamer/:uuid
        const res = await apiClient.get(`/streamer/${uuid}`);
        setStreamerBalance(res.data.streamer.balance);
      } catch (err) {
        console.error("Error fetching streamer balance:", err);
        setMessage("Failed to load streamer balance.");
        if (!usingSession && (err.response?.status === 403 || err.response?.status === 401)) {
          alert("Forbidden: Invalid API Key. Please refresh the page and enter the correct key.");
          localStorage.removeItem(`apiKey_${uuid}`);
          setApiKey(null);
        }
      }
    };
    fetchStreamerBalance();

    const socket = io(SOCKET_URL, { transports: ["websocket"], reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000 });
    socket.emit("join_streamer_room", uuid);
    socket.on("withdrawal_approved", (data) => {
      console.log("💸 Withdrawal approved received:", data);
      setStreamerBalance(typeof data?.newBalance === 'number' ? data.newBalance : 0);
    });

    return () => {
      socket.disconnect();
    };
  }, [uuid, apiClient]);

  // Apply theme on load and when darkMode changes
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const withdrawalAmount = parseFloat(amount);

    if (!withdrawalAmount || isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
      setMessage("Please enter a valid amount.");
      return;
    }
    if (withdrawalAmount > streamerBalance) {
      setMessage(`Insufficient balance. Available: Br ${streamerBalance.toFixed(2)}`);
      return;
    }
    if (!telebirrUsername.trim()) {
      setMessage("Please enter your Telebirr username.");
      return;
    }
    if (!phoneNumber.trim()) {
      setMessage("Please enter your phone number.");
      return;
    }

    setLoading(true);
    try {
      const path = usingSession ? `/v1/streamer/${uuid}/withdraw` : `/streamer/${uuid}/withdraw`;
      await apiClient.post(path, {
        amount: withdrawalAmount,
        telebirrUsername: telebirrUsername.trim(),
        phoneNumber: phoneNumber.trim()
      });
      setMessage("Withdrawal request submitted successfully!");
      setAmount("");
      setTelebirrUsername("");
      setPhoneNumber("");
      // Optionally, refetch balance or update locally
      setStreamerBalance(prev => prev - withdrawalAmount);
    } catch (err) {
      console.error("Withdrawal error:", err);
      setMessage(err.response?.data?.error || "Failed to submit withdrawal request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const withdrawalAmount = parseFloat(amount);
  const payoutAmount = !isNaN(withdrawalAmount) && withdrawalAmount > 0 ? (withdrawalAmount * 0.6).toFixed(2) : null;

  const themeClasses = darkMode
    ? "min-h-screen gradient-dark text-gray-100"
    : "min-h-screen gradient-light text-gray-900";

  return (
    <div className={`${themeClasses} p-6 md:p-10`}>
      {!usingSession && (
        <ApiKeyModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onSubmit={handleApiKeySubmit}
          title="Streamer API Key Required"
          message="Please enter your secret API Key to submit a withdrawal request."
        />
      )}
      <div className="max-w-md mx-auto">
        <button
          onClick={() => navigate(`/streamer/${uuid}`)}
          className="mb-6 btn btn-secondary"
        >
          ← Back to Dashboard
        </button>

        <div className="card p-6 relative">
          {/* Theme Toggle - Inside Card at Right Top Corner */}
          <div className="absolute top-3 right-3 z-10">
            <ThemeToggle isDarkMode={darkMode} toggleDarkMode={setDarkMode} />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 text-center">Request Withdrawal</h1>
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2 text-center">
            Your current balance: <Balance value={streamerBalance} showLabel={false} className="font-semibold text-gray-900 dark:text-white" />
          </div>
          {payoutAmount && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 text-center">
              You will receive: <span className="font-semibold text-green-600 dark:text-green-400">Br {payoutAmount}</span> (60%)
            </p>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Amount (Br)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="Enter amount"
                min="0"
                step="0.01"
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Telebirr Username</label>
              <input
                type="text"
                value={telebirrUsername}
                onChange={(e) => setTelebirrUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="Enter your Telebirr username"
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Phone Number</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="Enter your phone number"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn btn-primary"
            >
              {loading ? "Submitting..." : "Submit Request"}
            </button>
          </form>

          {message && (
            <p className={`mt-4 text-center text-sm font-medium ${
              message.includes("success") 
                ? "text-green-600 dark:text-green-400" 
                : "text-red-600 dark:text-red-400"
            }`}>
              {message}
            </p>
          )}
        </div>
      </div>
      
      {/* Overlay loading for form submission */}
      {loading && (
        <LoadingSpinner 
          overlay={true}
          size="md"
          text="Submitting request..."
          showText={true}
        />
      )}
    </div>
  );
}