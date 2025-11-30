import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function StreamerLogin() {
  const { uuid } = useParams();
  const navigate = useNavigate();
  const { refresh, isAuthenticated, setAuthToken, user, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(null);
  const [otp, setOtp] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [streamer, setStreamer] = useState(null);

  // Fetch streamer info (public) to display username and get telegram_id
  useEffect(() => {
    let timer;
    (async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/streamer/${uuid}`);
        if (!res.ok) throw new Error('Streamer not found');
        const data = await res.json();
        setStreamer(data.streamer);
      } catch (e) {
        setError(e.message || 'Failed to load streamer');
      } finally {
        setLoading(false);
      }
    })();
    if (cooldown > 0) {
      timer = setInterval(() => setCooldown(c => (c > 0 ? c - 1 : 0)), 1000);
    }
    return () => timer && clearInterval(timer);
  }, [uuid, cooldown]);

  // Redirect to dashboard only if authenticated user matches the UUID
  useEffect(() => {
    if (isAuthenticated && user && streamer) {
      // Check if the authenticated user's telegram_id matches the streamer for this UUID
      if (String(user.telegram_id) === String(streamer.telegram_id)) {
        // Correct user is logged in, redirect to dashboard
        navigate(`/streamer/${uuid}`, { replace: true });
      } else {
        // Wrong user is logged in, clear the session to allow login as the correct streamer
        console.log('[StreamerLogin] Authenticated user does not match UUID, logging out...');
        logout();
      }
    }
  }, [isAuthenticated, user, streamer, navigate, uuid, logout]);

  const requestOtp = useCallback(async () => {
    if (!streamer?.telegram_id) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/v1/streamer/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ telegram_id: streamer.telegram_id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Failed to send code');
      }
      setCooldown(60);
    } catch (e) {
      setError(e.message || 'Failed to send code');
    } finally {
      setSending(false);
    }
  }, [streamer]);

  const verifyOtp = useCallback(async () => {
    if (!streamer?.telegram_id || !/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit code');
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/v1/streamer/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ telegram_id: streamer.telegram_id, otp }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Verification failed');
      }
      const payload = await res.json().catch(() => ({}));
      if (payload.token) {
        setAuthToken(payload.token);
      }
      await refresh();
      navigate(`/streamer/${uuid}`, { replace: true });
    } catch (e) {
      setError(e.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  }, [streamer, otp, refresh, navigate, uuid, setAuthToken]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading…</div>
      </div>
    );
  }

  if (!streamer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-semibold mb-2">Streamer not found</div>
          <Link to="/" className="text-blue-600 underline">Go home</Link>
        </div>
      </div>
    );
  }

  const displayName = streamer.full_name || (streamer.username ? `@${streamer.username}` : 'Streamer');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="floating-element absolute -top-40 -right-40 w-80 h-80 bg-blue-200 dark:bg-blue-900 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl opacity-30"></div>
        <div className="floating-element-delayed absolute -bottom-40 -left-40 w-80 h-80 bg-purple-200 dark:bg-purple-900 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl opacity-30"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo/Brand area */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Welcome Back</h1>
          <p className="text-gray-600 dark:text-gray-300 font-medium">{displayName}</p>
        </div>

        {/* Main card */}
        <div className="glass-card rounded-2xl shadow-2xl p-8 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-200 flex items-center gap-3">
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          {/* Send OTP Section */}
          <div className="space-y-4">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-3">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Send Verification Code</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">We'll send a 6-digit code to your Telegram DM</p>
            </div>

            <button
              onClick={requestOtp}
              disabled={sending || cooldown > 0}
              className="w-full btn btn-primary btn-lg font-medium btn-enhanced"
            >
              {sending ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Sending Code...
                </span>
              ) : cooldown > 0 ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Resend in {cooldown}s
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Send Code to Telegram
                </span>
              )}
            </button>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">Then enter your code</span>
            </div>
          </div>

          {/* OTP Input Section */}
          <div className="space-y-4">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full mb-3">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Enter Verification Code</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Check your Telegram for the 6-digit code</p>
            </div>

            {/* Professional OTP Input */}
            <div className="flex justify-center gap-2 sm:gap-3">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <input
                  key={index}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={otp[index] || ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    const newOtp = otp.split('');
                    newOtp[index] = value;
                    const updatedOtp = newOtp.join('').slice(0, 6);
                    setOtp(updatedOtp);

                    // Auto-focus next input
                    if (value && index < 5) {
                      const nextInput = e.target.parentElement.children[index + 1];
                      if (nextInput) nextInput.focus();
                    }
                  }}
                  onKeyDown={(e) => {
                    // Handle backspace
                    if (e.key === 'Backspace' && !otp[index] && index > 0) {
                      const prevInput = e.target.parentElement.children[index - 1];
                      if (prevInput) prevInput.focus();
                    }
                    // Handle paste
                    if (e.key === 'v' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      navigator.clipboard.readText().then(text => {
                        const pastedValue = text.replace(/[^0-9]/g, '').slice(0, 6);
                        setOtp(pastedValue);
                      });
                    }
                  }}
                  className={`otp-input focus-enhanced ${otp[index] ? 'filled' : ''}`}
                  ref={(input) => {
                    if (input && index === otp.length && otp.length < 6) {
                      input.focus();
                    }
                  }}
                />
              ))}
            </div>

            <button
              onClick={verifyOtp}
              disabled={verifying || !/^\d{6}$/.test(otp)}
              className="w-full btn btn-success btn-lg font-medium btn-enhanced"
            >
              {verifying ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Verifying...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Verify & Continue
                </span>
              )}
            </button>
          </div>

          {/* Footer removed: Back to Dashboard link */}
        </div>

        {/* Security notice */}
        <div className="text-center mt-6">
          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            Secure authentication powered by Telegram
          </p>
        </div>
      </div>
    </div>
  );
}
