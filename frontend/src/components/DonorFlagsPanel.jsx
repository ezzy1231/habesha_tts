import { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import LoadingSpinner from './LoadingSpinner';
import Balance from './Balance';
import { BAN_DURATION_OPTIONS, resolveBanDurationMinutes } from '../constants/banOptions';

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
  const [banForms, setBanForms] = useState({});
  const [banActionId, setBanActionId] = useState(null);
  const [unbanActionId, setUnbanActionId] = useState(null);

  const getBanForm = useCallback((flagId, fallbackReason = '') => {
    return banForms[flagId] || { reason: fallbackReason, duration: '24h', customMinutes: '' };
  }, [banForms]);

  const updateBanForm = useCallback((flagId, patch, fallbackReason = '') => {
    setBanForms((prev) => {
      const current = prev[flagId] || { reason: fallbackReason, duration: '24h', customMinutes: '' };
      return { ...prev, [flagId]: { ...current, ...patch } };
    });
  }, []);

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

  const handleBanDonor = useCallback(async (flag) => {
    if (!apiClient || !flag?.donor_id) {
      setError('Donor account is missing for this flag.');
      return;
    }
    const form = getBanForm(flag.id, flag.reason || '');
    const banReason = (form.reason || flag.reason || '').trim();
    if (!banReason.length) {
      setError('A ban reason is required.');
      return;
    }
    const durationMinutes = resolveBanDurationMinutes(form.duration, form.customMinutes);
    if (form.duration === 'custom' && (!durationMinutes || durationMinutes <= 0)) {
      setError('Enter a valid custom duration in minutes.');
      return;
    }
    try {
      setBanActionId(flag.id);
      await apiClient.post(`/donors/${flag.donor_id}/ban`, {
        reason: banReason,
        durationMinutes,
      });
      setBanForms((prev) => ({ ...prev, [flag.id]: { reason: '', duration: '24h', customMinutes: '' } }));
      await fetchFlags();
      onFlagResolved?.();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to ban donor');
    } finally {
      setBanActionId(null);
    }
  }, [apiClient, fetchFlags, getBanForm, onFlagResolved]);

  const handleUnbanDonor = useCallback(async (flag) => {
    if (!apiClient || !flag?.donor_id) {
      return;
    }
    const confirmed = window.confirm('Unban this donor? They will immediately regain access.');
    if (!confirmed) return;
    try {
      setUnbanActionId(flag.id);
      await apiClient.post(`/donors/${flag.donor_id}/unban`);
      await fetchFlags();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to unban donor');
    } finally {
      setUnbanActionId(null);
    }
  }, [apiClient, fetchFlags]);

  const renderFlagCard = (flag) => {
    const badgeClass = STATUS_BADGES[flag.status] || 'badge-gray';
    const isPending = flag.status === 'pending';
    const banForm = getBanForm(flag.id, flag.reason || '');

    return (
      <div key={flag.id} className="p-4 sm:p-5 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🚩</span>
              <h4 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                {flag.action_label || flag.action}
              </h4>
            </div>
            <div className="flex flex-wrap gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <span>Streamer:</span>
                <span className="font-medium text-gray-900 dark:text-white">{flag.streamer_name || `#${flag.streamer_id}`}</span>
              </span>
              <span className="hidden sm:inline text-gray-300 dark:text-gray-600">•</span>
              <span className="flex items-center gap-1">
                <span>Donor:</span>
                <span className="font-medium text-gray-900 dark:text-white">{flag.donor_name || `#${flag.donor_id || 'Unknown'}`}</span>
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${
              flag.status === 'resolved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
              flag.status === 'dismissed' ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' :
              'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
            }`}>
              {flag.status}
            </span>
            <div className="text-xs text-gray-500 dark:text-gray-400">{formatDate(flag.created_at)}</div>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {flag.reason && (
            <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-300 italic">“{flag.reason}”</p>
            </div>
          )}
          
          <div className="flex flex-wrap gap-4 text-xs">
            {typeof flag.donation_amount !== 'undefined' && (
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">
                <span>Donation Amount:</span>
                <Balance value={flag.donation_amount} showLabel={false} showToggle={false} context="admin" />
              </div>
            )}
          </div>

          {flag.donation_message && (
            <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Donor Message</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{flag.donation_message}</p>
            </div>
          )}
        </div>

        {isPending ? (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Resolution Notes</label>
              <textarea
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow"
                placeholder="Optional notes for admins..."
                value={notes[flag.id] || ''}
                onChange={(e) => setNotes((prev) => ({ ...prev, [flag.id]: e.target.value }))}
                rows={2}
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                disabled={resolvingId === flag.id}
                onClick={() => handleResolve(flag.id, 'resolved')}
              >
                {resolvingId === flag.id ? 'Saving...' : 'Mark Resolved'}
              </button>
              <button
                type="button"
                className="flex-1 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
                disabled={resolvingId === flag.id}
                onClick={() => handleResolve(flag.id, 'dismissed')}
              >
                {resolvingId === flag.id ? 'Saving...' : 'Dismiss'}
              </button>
            </div>

            <div className="bg-rose-50 dark:bg-rose-900/10 rounded-xl border border-rose-100 dark:border-rose-900/30 p-4 space-y-4">
              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <p className="text-xs font-bold uppercase tracking-wide">Moderation Actions</p>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Ban Reason</label>
                  <textarea
                    className="w-full rounded-lg border border-rose-200 dark:border-rose-800 bg-white dark:bg-gray-900 text-sm px-3 py-2 focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                    rows={2}
                    value={banForm.reason}
                    onChange={(e) => updateBanForm(flag.id, { reason: e.target.value }, flag.reason || '')}
                    placeholder="Reason for banning donor..."
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Duration</label>
                    <select
                      className="w-full rounded-lg border border-rose-200 dark:border-rose-800 bg-white dark:bg-gray-900 text-sm px-3 py-2 focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                      value={banForm.duration}
                      onChange={(e) => updateBanForm(flag.id, { duration: e.target.value }, flag.reason || '')}
                    >
                      {BAN_DURATION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  {banForm.duration === 'custom' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Minutes</label>
                      <input
                        type="number"
                        min="1"
                        className="w-full rounded-lg border border-rose-200 dark:border-rose-800 bg-white dark:bg-gray-900 text-sm px-3 py-2 focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                        placeholder="e.g. 120"
                        value={banForm.customMinutes}
                        onChange={(e) => updateBanForm(flag.id, { customMinutes: e.target.value }, flag.reason || '')}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!flag.donor_id || banActionId === flag.id}
                  onClick={() => handleBanDonor(flag)}
                >
                  {banActionId === flag.id ? 'Applying ban...' : 'Ban Donor'}
                </button>
                <button
                  type="button"
                  className="flex-1 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!flag.donor_id || unbanActionId === flag.id}
                  onClick={() => handleUnbanDonor(flag)}
                >
                  {unbanActionId === flag.id ? 'Unbanning...' : 'Unban Donor'}
                </button>
              </div>
              {!flag.donor_id && (
                <p className="text-[10px] text-rose-600 dark:text-rose-400 italic text-center">
                  Cannot ban: Donor ID missing (likely anonymous checkout).
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            <span>Resolved by {flag.resolved_by || 'admin'} on {formatDate(flag.resolved_at)}</span>
            {flag.resolution_notes && <span className="text-gray-400 dark:text-gray-500">• Notes: {flag.resolution_notes}</span>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden animate-fade-in-stagger">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Streamer Reports</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Review and action streamer-submitted donor flags</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === option.value
                    ? 'bg-primary-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
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
