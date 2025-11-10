import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Feature flag (frontend) to toggle JWT requirement for dashboard access.
// If false, we allow legacy API-key access without forcing login.
const REQUIRE_JWT = (import.meta.env.VITE_REQUIRE_JWT_DASHBOARD || 'false').toLowerCase() === 'true';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const { uuid } = useParams();

  // Always render children while loading to avoid layout jump if JWT not required.
  if (loading && !REQUIRE_JWT) {
    return children;
  }
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Checking session…</div>
      </div>
    );
  }
  if (REQUIRE_JWT && !isAuthenticated) {
    return <Navigate to={`/streamer/${uuid}/login`} replace />;
  }
  return children;
}
