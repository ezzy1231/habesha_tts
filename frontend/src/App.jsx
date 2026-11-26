import { BrowserRouter, Routes, Route } from "react-router-dom";
import StreamerPage from "./pages/StreamerPage";
import AdminDashboard from "./pages/AdminDashboard";
import WithdrawPage from "./pages/WithdrawPage";
import LandingPage from "./pages/LandingPage";
import { StreamerBalanceProvider } from "./contexts/StreamerBalanceContext";
import { AdminBalanceProvider } from "./contexts/AdminBalanceContext";
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import StreamerLogin from './pages/StreamerLogin';
import NotFound from './pages/NotFound';

import { lazy, Suspense, useEffect } from 'react';
import { initTheme } from './ui/theme';

// Dev-only design-system gallery (src/ui). Set VITE_ENABLE_UI_KIT=true to include it in a build.
const SHOW_UI_KIT = import.meta.env.DEV || import.meta.env.VITE_ENABLE_UI_KIT === 'true';
const UiKitPage = SHOW_UI_KIT ? lazy(() => import('./ui/UiKitPage')) : null;

function App() {
  // Dark-first: apply the saved theme, or dark when none is saved (see src/ui/theme.js).
  useEffect(() => {
    initTheme();
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <StreamerBalanceProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            {UiKitPage ? (
              <Route path="/ui-kit/*" element={<Suspense fallback={null}><UiKitPage /></Suspense>} />
            ) : null}
            <Route path="/admin/:tab?" element={
              <AdminBalanceProvider>
                <AdminDashboard />
              </AdminBalanceProvider>
            } />
            <Route path="/streamer/:uuid/login" element={<StreamerLogin />} />
            <Route path="/streamer/:uuid" element={
              <ProtectedRoute>
                <StreamerPage />
              </ProtectedRoute>
            } />
            <Route path="/withdraw/:uuid" element={
              <ProtectedRoute>
                <WithdrawPage />
              </ProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </StreamerBalanceProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;