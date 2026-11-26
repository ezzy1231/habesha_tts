import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import io from "socket.io-client";
import Balance from "../components/Balance";
import ApiKeyModal from '../components/ApiKeyModal';
import { useAuth } from '../contexts/AuthContext';
import { Button, Card, cn, Icon, Input, StreamerLayout } from '../ui';

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
  const { isAuthenticated, authToken } = useAuth();
  const REQUIRE_JWT = (import.meta.env.VITE_REQUIRE_JWT_DASHBOARD || 'false').toLowerCase() === 'true';
  const usingSession = REQUIRE_JWT && isAuthenticated;
  const [apiKey, setApiKey] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
    if (!apiKey) return null;
    return axios.create({
      baseURL: import.meta.env.VITE_API_URL,
      headers: { 'Authorization': `Bearer ${apiKey}` }
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
// console.log("💸 Withdrawal approved received:", data);
      setStreamerBalance(typeof data?.newBalance === 'number' ? data.newBalance : 0);
    });

    return () => {
      socket.disconnect();
    };
  }, [uuid, apiClient]);

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
  const payoutAmount = !isNaN(withdrawalAmount) && withdrawalAmount > 0 ? withdrawalAmount.toFixed(2) : null;
  const isSuccess = message.includes("success");

  const navItems = [
    { to: `/streamer/${uuid}`, icon: 'live', label: 'Dashboard', end: true },
    { to: `/withdraw/${uuid}`, icon: 'wallet', label: 'Withdraw' },
  ];

  return (
    <StreamerLayout items={navItems} title="Withdraw">
      {!usingSession && (
        <ApiKeyModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onSubmit={handleApiKeySubmit}
          title="Streamer API Key Required"
          message="Please enter your secret API Key to submit a withdrawal request."
        />
      )}

      <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-[1fr_1.15fr]">
        <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-6">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brand-500/20 blur-3xl" />
          <div className="relative">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
              <Icon name="wallet" size={20} />
            </span>
            <p className="mt-6 text-xs font-medium uppercase tracking-[0.12em] text-subtle">Available balance</p>
            <div className="mt-1 text-4xl font-semibold tracking-tight text-fg">
              <Balance value={streamerBalance} showLabel={false} />
            </div>
            <dl className="mt-8 flex flex-col gap-3 border-t border-line pt-5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Requested</dt>
                <dd className="font-semibold tabular-nums text-fg">{!isNaN(withdrawalAmount) && withdrawalAmount > 0 ? `Br ${withdrawalAmount.toFixed(2)}` : '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">You will receive</dt>
                <dd className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{payoutAmount ? `Br ${payoutAmount}` : '—'}</dd>
              </div>
            </dl>
            <p className="mt-5 text-xs leading-relaxed text-subtle">The platform fee was already taken from each donation. Payouts are sent to your Telebirr account after an admin approves the request.</p>
          </div>
        </div>

        <Card padding="lg">
          <h2 className="text-lg font-semibold tracking-tight text-fg">Request a withdrawal</h2>
          <p className="mt-1 text-sm text-muted">Fill in your Telebirr details. We&apos;ll notify you when it&apos;s approved.</p>
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <Input
              label="Amount (Br)"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              required
              leftIcon={<Icon name="coins" size={16} />}
            />
            <Input
              label="Telebirr username"
              value={telebirrUsername}
              onChange={(e) => setTelebirrUsername(e.target.value)}
              placeholder="Your Telebirr name"
              required
            />
            <Input
              label="Phone number"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="09…"
              required
            />
            <Button type="submit" size="lg" fullWidth loading={loading} disabled={loading} className="mt-2">
              {loading ? "Submitting…" : "Submit request"}
            </Button>
          </form>

          {message ? (
            <div
              role="status"
              className={cn(
                'mt-5 flex items-start gap-2.5 rounded-xl border p-3 text-sm',
                isSuccess
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                  : 'border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200',
              )}
            >
              <Icon name={isSuccess ? 'checkCircle' : 'alert'} size={17} className="mt-0.5 shrink-0" />
              {message}
            </div>
          ) : null}
        </Card>
      </div>
    </StreamerLayout>
  );
}
