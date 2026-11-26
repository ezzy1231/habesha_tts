import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import PropTypes from 'prop-types';
import { OTPInput, OTPInputGroup, OTPInputSlot } from '@ui-sdk/react/otp-input';
import { Avatar, Button, EmptyState, Icon, LanguageToggle, Logo, Spinner, ThemeToggle } from '../ui';

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
// console.log('[StreamerLogin] Check:', { isAuthenticated, user: user?.telegram_id, streamer: streamer?.telegram_id });
    if (isAuthenticated && user && streamer) {
      // Check if the authenticated user's telegram_id matches the streamer for this UUID
      if (String(user.telegram_id) === String(streamer.telegram_id)) {
// console.log('[StreamerLogin] Match confirmed. Redirecting to dashboard.');
        navigate(`/streamer/${uuid}`, { replace: true });
      } else {
        // Wrong user is logged in, clear the session to allow login as the correct streamer
// console.log('[StreamerLogin] Mismatch detected:', user.telegram_id, '!==', streamer.telegram_id);
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
      <AuthShell>
        <div className="flex flex-col items-center gap-3 py-10">
          <Spinner />
          <p className="text-sm text-muted">Loading…</p>
        </div>
      </AuthShell>
    );
  }

  if (!streamer) {
    return (
      <AuthShell>
        <EmptyState
          icon="users"
          title="Streamer not found"
          description="Check the link from your Telegram bot and try again."
          action={
            <Button as={Link} to="/" variant="secondary">
              Go home
            </Button>
          }
        />
      </AuthShell>
    );
  }

  const displayName = streamer.full_name || (streamer.username ? `@${streamer.username}` : 'Streamer');
  const otpComplete = /^\d{6}$/.test(otp);

  return (
    <AuthShell>
      <div className="flex flex-col items-center text-center">
        <Avatar name={displayName} src={streamer.profile_picture_url || undefined} size="lg" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-fg">Welcome back</h1>
        <p className="mt-1 text-sm text-muted">Sign in as {displayName}</p>
      </div>

      {error ? (
        <div role="alert" className="mt-6 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-800 dark:text-red-200">
          <Icon name="xCircle" size={17} className="mt-0.5 shrink-0" />
          {error}
        </div>
      ) : null}

      <ol className="mt-8 flex flex-col gap-6">
        <li>
          <StepLabel n={1} title="Get a code" hint="We'll send a 6-digit code to your Telegram DM." />
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onClick={requestOtp}
            loading={sending}
            disabled={sending || cooldown > 0}
            leftIcon={<Icon name={cooldown > 0 ? 'clock' : 'message'} size={16} />}
            className="mt-3"
          >
            {sending ? 'Sending code…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Send code to Telegram'}
          </Button>
        </li>
        <li>
          <StepLabel n={2} title="Enter the code" hint="Check Telegram, then type or paste the code." />
          <form
            className="mt-3 flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              verifyOtp();
            }}
          >
            <OTPInput value={otp} onValueChange={(v) => setOtp(v)} maxLength={6} aria-label="Verification code">
              <OTPInputGroup className="flex justify-between gap-2">
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <OTPInputSlot
                    key={index}
                    index={index}
                    className="relative flex h-14 w-full max-w-[3.25rem] items-center justify-center rounded-xl border border-line bg-surface-2 text-xl font-semibold tabular-nums text-fg transition-colors data-[active]:border-brand-500 data-[active]:ring-4 data-[active]:ring-brand-500/20 data-[filled]:border-line-strong"
                  />
                ))}
              </OTPInputGroup>
            </OTPInput>
            <Button type="submit" size="lg" fullWidth loading={verifying} disabled={verifying || !otpComplete}>
              {verifying ? 'Verifying…' : 'Verify & continue'}
            </Button>
          </form>
        </li>
      </ol>
    </AuthShell>
  );
}

function StepLabel({ n, title, hint }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-xs font-semibold text-brand-600 dark:text-brand-300">{n}</span>
      <div>
        <p className="text-sm font-semibold text-fg">{title}</p>
        <p className="text-xs text-muted">{hint}</p>
      </div>
    </div>
  );
}

StepLabel.propTypes = { n: PropTypes.number.isRequired, title: PropTypes.node.isRequired, hint: PropTypes.node };

/** Centered card on a soft violet glow, used for sign-in states. */
function AuthShell({ children }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-canvas px-4 py-12 font-sans text-fg">
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 h-[28rem] w-[48rem] -translate-x-1/2 rounded-full bg-brand-500/15 blur-[120px]" />
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle size="sm" />
      </div>
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-[0_30px_80px_-40px_rgb(0_0_0/0.6)] sm:p-8">{children}</div>
        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-subtle">
          <Icon name="shield" size={13} />
          Secure sign-in with Telegram
        </p>
      </div>
    </div>
  );
}

AuthShell.propTypes = { children: PropTypes.node };
