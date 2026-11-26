import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";
import { lazy, Suspense, useEffect } from 'react';
import { StreamerBalanceProvider } from "./contexts/StreamerBalanceContext";
import { AdminBalanceProvider } from "./contexts/AdminBalanceContext";
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from "./pages/LandingPage";
import { initTheme } from './ui/theme';
import { Spinner } from './ui/Spinner';
import { ToastProvider } from './ui/Toast';

// Each page is its own chunk; the landing page stays in the main bundle.
const StreamerDashboard = lazy(() => import('./pages/streamer/StreamerDashboard'));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const WithdrawPage = lazy(() => import("./pages/WithdrawPage"));
const StreamerLogin = lazy(() => import('./pages/StreamerLogin'));
const OverlayPage = lazy(() => import('./pages/OverlayPage'));
const StreamersPage = lazy(() => import('./pages/StreamersPage'));
const DonatePage = lazy(() => import('./pages/DonatePage'));
const DonateReturnPage = lazy(() => import('./pages/DonateReturnPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));

// Dev-only design-system gallery (src/ui). Set VITE_ENABLE_UI_KIT=true to include it in a build.
const SHOW_UI_KIT = import.meta.env.DEV || import.meta.env.VITE_ENABLE_UI_KIT === 'true';
const UiKitPage = SHOW_UI_KIT ? lazy(() => import('./ui/UiKitPage')) : null;

function PageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas text-muted">
      <Spinner size={28} label="Loading" />
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 text-center">
      <div>
        <h2 className="mb-2 text-2xl font-bold text-fg">Page not found</h2>
        <p className="text-muted">Check the link, or go to the <a className="text-brand-600 underline dark:text-brand-400" href="/streamers">streamer list</a>.</p>
      </div>
    </div>
  );
}

/** react-router can't match "/@:slug" directly, so single-segment paths starting with @ go to the donate page. */
function HandleRoute() {
  const { handle = '' } = useParams();
  return handle.startsWith('@') && handle.length > 1 ? <DonatePage /> : <NotFound />;
}

function App() {
  // Dark-first: apply the saved theme, or dark when none is saved (see src/ui/theme.js).
  useEffect(() => {
    initTheme();
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <StreamerBalanceProvider>
          <ToastProvider>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/streamers" element={<StreamersPage />} />
              <Route path="/s/:slug" element={<DonatePage />} />
              <Route path="/donate/return" element={<DonateReturnPage />} />
              <Route path="/account" element={<AccountPage />} />
              <Route path="/:handle" element={<HandleRoute />} />
              {UiKitPage ? <Route path="/ui-kit/*" element={<UiKitPage />} /> : null}
              <Route path="/admin" element={
                <AdminBalanceProvider>
                  <AdminDashboard />
                </AdminBalanceProvider>
              } />
              <Route path="/overlay/:token" element={<OverlayPage />} />
              <Route path="/streamer/:uuid/login" element={<StreamerLogin />} />
              <Route path="/streamer/:uuid/*" element={
                <ProtectedRoute>
                  <StreamerDashboard />
                </ProtectedRoute>
              } />
              <Route path="/withdraw/:uuid" element={
                <ProtectedRoute>
                  <WithdrawPage />
                </ProtectedRoute>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          </ToastProvider>
        </StreamerBalanceProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
