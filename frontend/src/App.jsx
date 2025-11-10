import { BrowserRouter, Routes, Route } from "react-router-dom";
import StreamerPage from "./pages/StreamerPage";
import AdminDashboard from "./pages/AdminDashboard";
import WithdrawPage from "./pages/WithdrawPage";
import { StreamerBalanceProvider } from "./contexts/StreamerBalanceContext";
import { AdminBalanceProvider } from "./contexts/AdminBalanceContext";
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import StreamerLogin from './pages/StreamerLogin';

import { useEffect } from 'react';

function App() {
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial = saved || (prefersDark ? 'dark' : 'light');
    if (initial === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, []);

return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/admin" element={
            <AdminBalanceProvider>
              <AdminDashboard />
            </AdminBalanceProvider>
          } />
          <Route path="/streamer/:uuid/login" element={<StreamerLogin />} />
          <Route path="/streamer/:uuid" element={
            <ProtectedRoute>
              <StreamerBalanceProvider>
                <StreamerPage />
              </StreamerBalanceProvider>
            </ProtectedRoute>
          } />
          <Route path="/withdraw/:uuid" element={
            <ProtectedRoute>
              <StreamerBalanceProvider>
                <WithdrawPage />
              </StreamerBalanceProvider>
            </ProtectedRoute>
          } />
          <Route path="*" element={
            <div className="min-h-screen bg-gray-100 dark:bg-gradient-to-br dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">🎙️ Habesha TTS Dashboard</h2>
                <p className="text-gray-600 dark:text-gray-400">Please use a valid streamer link to access the dashboard.</p>
              </div>
            </div>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;