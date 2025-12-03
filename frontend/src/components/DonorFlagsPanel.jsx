import { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import LoadingSpinner from './LoadingSpinner';
import Balance from './Balance';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'all', label: 'All' },
];

const STATUS_BADGES = {
  pending: 'badge-warning',
  resolved: 'badge-success',
  dismissed: 'badge-gray',
};

const formatDate = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch (error) {
    return value;
  }
};

export default function DonorFlagsPanel({ apiClient, refreshKey, onFlagResolved }) {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('pending');
  const [resolvingId, setResolvingId] = useState(null);
  const [notes, setNotes] = useState({});

  const fetchFlags = useCallback(async () => {
    if (!apiClient) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get('/donor-flags', {
        params: { status: filter, limit: 200 },
      });
      setFlags(data?.flags || []);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to load streamer flags');
    } finally {
      setLoading(false);
    }
  }, [apiClient, filter]);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags, refreshKey]);

  const handleResolve = useCallback(async (flagId, nextStatus) => {
    if (!apiClient || !flagId) return;
    setResolvingId(flagId);
    try {
      await apiClient.post(`/donor-flags/${flagId}/resolve`, {
        status: nextStatus,
        resolutionNotes: notes[flagId]?.trim() || undefined,
      });
      setNotes((prev) => {
        const clone = { ...prev };
        delete clone[flagId];
        return clone;
      });
      await fetchFlags();
      onFlagResolved?.();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to update flag');
    } finally {
      setResolvingId(null);
    }
  }, [apiClient, fetchFlags, notes, onFlagResolved]);

  const emptyState = useMemo(() => {
    if (loading) return null;
    if (error) return null;
    return (
      <div className="text-center py-12 text-sm text-gray-500 dark:text-gray-400">
        <p className="text-xl mb-2">🎉</p>
        <p>No streamer flags in this bucket.</p>
      </div>
    );
  }, [loading, error]);

  const renderFlagCard = (flag) => {
    const badgeClass = STATUS_BADGES[flag.status] || 'badge-gray';
    const isPending = flag.status === 'pending';

    return (
      <div key={flag.id} className="p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🚩</span>
              <h4 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                {flag.action_label || flag.action}
              </h4>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
              Streamer: <strong>{flag.streamer_name || `#${flag.streamer_id}`}</strong> · Donor: <strong>{flag.donor_name || `#${flag.donor_id || 'Unknown'}`}</strong>
            </p>
          </div>
          <div className="text-right">
            <span className={`badge ${badgeClass} uppercase tracking-wide text-[11px]`}>{flag.status}</span>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{formatDate(flag.created_at)}</div>
          </div>
        </div>

        <div className="mt-3 text-sm text-gray-700 dark:text-gray-200 space-y-2">
          {flag.reason && (
            <p className="italic text-gray-800 dark:text-gray-100">“{flag.reason}”</p>
          )}
          {typeof flag.donation_amount !== 'undefined' && (
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <span>Donation</span>
              <Balance value={flag.donation_amount} showLabel={false} />
            </div>
          )}
          {flag.donation_message && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-xs text-gray-600 dark:text-gray-300">
              <p className="font-semibold mb-1">Donor Message</p>
              <p className="leading-relaxed">{flag.donation_message}</p>
            </div>
          )}
        </div>

        {isPending ? (
          <div className="mt-4 space-y-3">
            <textarea
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Optional resolution notes for admins"
              value={notes[flag.id] || ''}
              onChange={(e) => setNotes((prev) => ({ ...prev, [flag.id]: e.target.value }))}
              rows={2}
            />
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                className="btn btn-success flex-1"
                disabled={resolvingId === flag.id}
                onClick={() => handleResolve(flag.id, 'resolved')}
              >
                {resolvingId === flag.id ? 'Saving...' : 'Mark Actioned'}
              </button>
              <button
                type="button"
                className="btn btn-outline flex-1 border-rose-200 text-rose-600 hover:bg-rose-50"
                disabled={resolvingId === flag.id}
                onClick={() => handleResolve(flag.id, 'dismissed')}
              >
                {resolvingId === flag.id ? 'Saving...' : 'Dismiss'}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <p>Resolved by {flag.resolved_by || 'admin'} on {formatDate(flag.resolved_at)}.</p>
            {flag.resolution_notes && <p className="text-gray-600 dark:text-gray-300">Notes: {flag.resolution_notes}</p>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="card p-4 sm:p-6 animate-fade-in-stagger">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Streamer Reports</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Review and action streamer-submitted donor flags.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                filter === option.value
                  ? 'bg-primary-500 text-white border-primary-500 shadow'
                  : 'border-gray-300 text-gray-600 dark:text-gray-300 hover:border-primary-400'
              }`}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {loading && (
          <div className="py-12 text-center">
            <LoadingSpinner size="md" text="Loading streamer flags..." />
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3 text-sm">
            {error}
          </div>
        )}
        {!loading && !error && flags.length === 0 && emptyState}
        {flags.map(renderFlagCard)}
      </div>
    </div>
  );
}

DonorFlagsPanel.propTypes = {
  apiClient: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),
  refreshKey: PropTypes.number,
  onFlagResolved: PropTypes.func,
};

DonorFlagsPanel.defaultProps = {
  refreshKey: 0,
  onFlagResolved: undefined,
};
