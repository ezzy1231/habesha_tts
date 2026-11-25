import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { StreamerLayout, STREAMER_NAV, Spinner } from '../../ui';
import { useAuth } from '../../contexts/AuthContext';
import { useStreamerApi } from '../../lib/streamerApi';
import StreamerPage from '../StreamerPage';

const EarningsPage = lazy(() => import('./EarningsPage'));
const SoundboardPage = lazy(() => import('./SoundboardPage'));
const MediaQueuePage = lazy(() => import('./MediaQueuePage'));
const OverlaySettingsPage = lazy(() => import('./OverlaySettingsPage'));
const AnalyticsPage = lazy(() => import('./AnalyticsPage'));
const PayoutsPage = lazy(() => import('./PayoutsPage'));
const SettingsPage = lazy(() => import('./SettingsPage'));

const SECTIONS = new Set(STREAMER_NAV.map((i) => i.path));

/**
 * Streamer dashboard: sidebar shell around the pages under /streamer/:uuid/*.
 * The live player (StreamerPage) stays mounted on every page so queued alerts keep playing
 * while the streamer works on the soundboard, media queue or settings.
 */
export default function StreamerDashboard() {
  const { uuid } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();
  const call = useStreamerApi(uuid);
  const base = `/streamer/${uuid}`;
  const section = location.pathname.slice(base.length).split('/').filter(Boolean)[0] || 'live';

  const [info, setInfo] = useState(null);
  const [pendingMedia, setPendingMedia] = useState(0);

  useEffect(() => {
    let stop = false;
    const load = () => call(`/streamer/${uuid}?page=1`).then((r) => { if (!stop) setInfo(r.streamer); }).catch(() => {});
    load();
    const id = setInterval(load, 30_000);
    return () => { stop = true; clearInterval(id); };
  }, [call, uuid]);

  useEffect(() => {
    let stop = false;
    const load = () => call(`/v1/streamer/${uuid}/media?status=pending`)
      .then((r) => { if (!stop) setPendingMedia(r.media.length); })
      .catch(() => {});
    load();
    const id = setInterval(load, 20_000);
    return () => { stop = true; clearInterval(id); };
  }, [call, uuid, section]);

  if (!SECTIONS.has(section)) return <Navigate to={`${base}/live`} replace />;

  const user = info
    ? { name: info.full_name || (info.username ? `@${info.username}` : 'Streamer'), subtitle: info.username ? `@${info.username}` : undefined, avatarUrl: info.profile_picture_url || undefined }
    : undefined;

  return (
    <StreamerLayout
      basePath={base}
      user={user}
      live={Boolean(info?.live_status)}
      badges={{ media: pendingMedia }}
      onLogout={isAuthenticated ? async () => {
        try { await logout(); } catch { /* already logged out */ }
        navigate(`${base}/login`);
      } : undefined}
    >
      <div hidden={section !== 'live'}>
        <StreamerPage embedded />
      </div>
      <Suspense fallback={<div className="flex justify-center py-16 text-muted"><Spinner size={24} label="Loading" /></div>}>
        <Routes>
          <Route path="live" element={null} />
          <Route path="donations" element={<EarningsPage />} />
          <Route path="soundboard" element={<SoundboardPage />} />
          <Route path="media" element={<MediaQueuePage onChange={setPendingMedia} />} />
          <Route path="overlay" element={<OverlaySettingsPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="payouts" element={<PayoutsPage balance={info?.balance} onWithdrawn={(amt) => setInfo((i) => (i ? { ...i, balance: Number(i.balance) - amt } : i))} />} />
          <Route path="settings" element={<SettingsPage />} />
        </Routes>
      </Suspense>
    </StreamerLayout>
  );
}
