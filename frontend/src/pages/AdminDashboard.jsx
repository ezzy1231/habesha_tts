import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import PropTypes from 'prop-types';
import io from 'socket.io-client';
import { Link, useParams } from 'react-router-dom';
import Settings from '../components/Settings';
import ApiKeyModal from '../components/ApiKeyModal';
import ConfirmationModal from '../components/ConfirmationModal';
import Balance from '../components/Balance';
import AdminComplaints from './AdminComplaints';
import LoadingSpinner from '../components/LoadingSpinner';
import SkeletonLoader from '../components/SkeletonLoader';
import DonorFlagsPanel from '../components/DonorFlagsPanel';
import ImageViewer from '../components/ImageViewer';
import { BAN_DURATION_OPTIONS, resolveBanDurationMinutes } from '../constants/banOptions';
import { AdminLayout, Avatar, Button, Card, CardHeader, cn, EmptyState, focusRing, Icon, Input, Logo, StatCard } from '../ui';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const API = import.meta.env.VITE_BASE_URL || 'http://localhost:5000';
const socket = io(API, { transports: ['websocket'] });

function Currency({ value }) {
  return <span className="tabular-nums text-fg">Br {Number(value || 0).toFixed(2)}</span>;
}
Currency.propTypes = { value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]) };

const CHART_STROKE = '#8b5cf6';

function RankedList({ title, rows, idKey, fallback }) {
  return (
    <Card>
      <CardHeader title={title} description="By total amount" />
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No data yet.</p>
      ) : (
        <ol className="flex flex-col divide-y divide-line">
          {rows.map((r, idx) => (
            <li key={r[idKey]} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span className="w-5 text-center text-xs font-semibold tabular-nums text-subtle">{idx + 1}</span>
              <Avatar name={r.username || '#'} src={r.profile_picture_url || undefined} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{r.username || `${fallback} #${r[idKey]}`}</p>
                <p className="text-xs text-subtle">ID {r[idKey]}</p>
              </div>
              <span className="text-sm font-semibold">
                <Currency value={r.amount} />
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
RankedList.propTypes = {
  title: PropTypes.string.isRequired,
  rows: PropTypes.array.isRequired,
  idKey: PropTypes.string.isRequired,
  fallback: PropTypes.string.isRequired,
};

function Overview({ apiClient, refreshKey }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!apiClient) return;
    setLoading(true);
    apiClient.get(`/overview`).then(r => {
      setData(r.data);
    }).catch(e => setError(e?.message || 'Failed to load')).finally(() => setLoading(false));
  }, [apiClient, refreshKey]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <StatCard key={i} label="Loading" loading />
        ))}
      </div>
    );
  }
  if (error) return <EmptyState icon="alert" title="Couldn't load the overview" description={error} />;

  const t = data.totals || {};
  const chartData = data.chartData || [];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total revenue" value={<Currency value={t.total_amount} />} hint={`${t.total_count || 0} donations`} icon="coins" />
        <StatCard label="Active streamers" value={t.unique_streamers || 0} hint="Unique creators" icon="live" />
        <StatCard label="Active donors" value={t.unique_donors || 0} hint="Unique supporters" icon="heart" />
        <StatCard
          label="Average donation"
          value={<Currency value={(t.total_amount || 0) / Math.max(1, t.total_count || 1)} />}
          hint="Per transaction"
          icon="chart"
        />
      </div>

      <Card>
        <CardHeader title="Revenue" description="Platform earnings, last 30 days" />
        <div className="h-72 w-full sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ left: 0, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_STROKE} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={CHART_STROKE} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#3f3f46" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} dy={8} />
              <YAxis axisLine={false} tickLine={false} width={64} tick={{ fill: '#71717a', fontSize: 12 }} tickFormatter={(value) => `Br ${value}`} />
              <Tooltip
                cursor={{ stroke: 'rgb(var(--ui-line-strong))' }}
                contentStyle={{ background: 'rgb(var(--ui-surface))', borderRadius: '0.75rem', border: '1px solid rgb(var(--ui-line))', boxShadow: '0 10px 30px -12px rgb(0 0 0 / 0.35)' }}
                labelStyle={{ color: 'rgb(var(--ui-muted))' }}
                itemStyle={{ color: 'rgb(var(--ui-fg))', fontWeight: 600 }}
                formatter={(value) => [`Br ${Number(value).toFixed(2)}`, 'Revenue']}
              />
              <Area type="monotone" dataKey="amount" stroke={CHART_STROKE} strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <RankedList title="Top streamers" rows={data.topStreamers || []} idKey="streamer_id" fallback="Streamer" />
        <RankedList title="Top donors" rows={data.topDonors || []} idKey="donor_id" fallback="Donor" />
      </div>
    </div>
  );
}
Overview.propTypes = {
  apiClient: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),
  refreshKey: PropTypes.number.isRequired,
};

function Streamers({ apiClient, refreshKey }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, streamer: null });
  const [isDeleting, setIsDeleting] = useState(false);

  // Refs for native drag-and-drop
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  const fetchStreamers = useCallback(() => {
    if (!apiClient) return;
    setLoading(true);
    apiClient.get(`/streamers`)
      .then(r => setRows(r.data.streamers || []))
      .catch(e => setError(e?.message || 'Failed'))
      .finally(() => setLoading(false));
  }, [apiClient]);

  useEffect(() => {
    fetchStreamers();

    socket.on('admin_update', (data) => {
// console.log('[Streamers] Admin update received via socket:', data);
      fetchStreamers(); // Re-fetch streamers on any admin-related update
    });

    return () => {
      socket.off('admin_update');
    };
  }, [fetchStreamers, refreshKey]);

  const handleSaveOrder = async () => {
    if (!apiClient) return;
    setIsSaving(true);
    const ordered_ids = rows.map(r => r.telegram_id);
    try {
      await apiClient.post('/streamers/order', { ordered_ids });
      alert('Order saved successfully!');
    } catch (err) {
      console.error('Failed to save order:', err);
      alert('Failed to save order. Please try again.');
      fetchStreamers();
    } finally {
      setIsSaving(false);
    }
  };

  // Native Drag-and-Drop Handlers
  const handleDragStart = (e, index) => {
    dragItem.current = index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.parentNode);
  };

  const handleDragEnter = (e, index) => {
    dragOverItem.current = index;
    const list = [...rows];
    const draggedItemContent = list[dragItem.current];
    list.splice(dragItem.current, 1);
    list.splice(dragOverItem.current, 0, draggedItemContent);
    dragItem.current = dragOverItem.current;
    dragOverItem.current = null;
    setRows(list);
  };

  const handleDragEnd = () => {
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const openDeleteModal = (streamer) => setDeleteModal({ isOpen: true, streamer });
  const closeDeleteModal = () => {
    if (isDeleting) return;
    setDeleteModal({ isOpen: false, streamer: null });
  };

  const handleDeleteStreamer = async () => {
    if (!apiClient || !deleteModal.streamer || isDeleting) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/streamers/${deleteModal.streamer.telegram_id}`);
      setDeleteModal({ isOpen: false, streamer: null });
      fetchStreamers();
      alert('Streamer removed successfully.');
    } catch (err) {
      console.error('Failed to remove streamer:', err);
      alert(err?.response?.data?.error || err?.message || 'Failed to remove streamer');
    } finally {
      setIsDeleting(false);
    }
  };


  if (loading) return (
    <div className="flex justify-center p-8">
      <LoadingSpinner size="md" text="Loading streamers..." />
    </div>
  );
  if (error) return <div className="text-red-600">{error}</div>;

  const pendingStreamerName = deleteModal.streamer
    ? (deleteModal.streamer.username || `ID ${deleteModal.streamer.telegram_id}`)
    : '';

  return (
    <>
      <div className="bg-surface/80 backdrop-blur-xl rounded-2xl shadow-sm border border-line/60 overflow-hidden">
        <div className="px-6 py-5 border-b border-line/80 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-fg tracking-tight">Streamers Management</h3>
            <p className="text-sm text-subtle mt-1">Drag and drop to reorder streamers on the public page.</p>
          </div>
          <button 
            onClick={handleSaveOrder} 
            disabled={isSaving} 
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Saving...
              </>
            ) : (
              'Save Order'
            )}
          </button>
        </div>

        {/* Mobile List */}
        <div className="block sm:hidden divide-y divide-line">
          {rows.map((s, index) => (
            <div
              key={s.telegram_id}
              className="p-4 flex flex-col gap-3"
            >
              <div className="flex items-center gap-3">
                {s.profile_picture_url ? (
                  <img src={s.profile_picture_url} alt="Profile" className="w-10 h-10 rounded-full object-cover ring-2 ring-surface" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold ring-2 ring-surface">
                    {(s.username || 'S').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-fg truncate">
                    {s.username || 'Unknown Streamer'}
                  </div>
                  <div className="text-xs text-muted">ID: {s.telegram_id}</div>
                </div>
                <button
                  type="button"
                  onClick={() => openDeleteModal(s)}
                  className="text-red-500 hover:text-red-700 text-sm font-medium px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm bg-surface-2 p-3 rounded-lg">
                <div>
                  <span className="text-xs text-muted block uppercase tracking-wider">Link UUID</span>
                  <code className="text-xs font-mono text-muted mt-1 block truncate">
                    {s.link_uuid}
                  </code>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted block uppercase tracking-wider">Total Earned</span>
                  <div className="font-bold text-fg mt-1">
                    <Currency value={s.total_earned} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-2/50 border-b border-line">
                <th className="py-3 px-6 w-12"></th>
                <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider">Streamer</th>
                <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider">Link UUID</th>
                <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider text-center">Donations</th>
                <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider text-right">Total Earned</th>
                <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((s, index) => (
                <tr
                  key={s.telegram_id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragEnter={(e) => handleDragEnter(e, index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  className="group hover:bg-surface-2 transition-colors"
                >
                  <td className="py-4 px-6 text-center text-subtle cursor-grab active:cursor-grabbing group-hover:text-subtle">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mx-auto" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      {s.profile_picture_url ? (
                        <img
                          src={s.profile_picture_url}
                          alt="Profile"
                          className="w-9 h-9 rounded-full object-cover ring-2 ring-surface"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold text-sm ring-2 ring-surface">
                          {(s.username || 'S').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-fg text-sm">
                          {s.username || 'Unknown Streamer'}
                        </div>
                        <div className="text-xs text-muted">ID: {s.telegram_id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <code className="px-2 py-1 bg-surface-2 text-muted rounded text-xs font-mono border border-line">
                      {s.link_uuid}
                    </code>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                      {s.donations_count}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="font-bold text-fg text-sm">
                      <Currency value={s.total_earned} />
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDeleteModal(s);
                      }}
                      className="text-subtle hover:text-red-600 dark:hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                      title="Remove Streamer"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={closeDeleteModal}
        onConfirm={handleDeleteStreamer}
        title="Remove streamer?"
        message={deleteModal.streamer ? `Removing ${pendingStreamerName} deletes their streamer link, balance records, and donation history. This action cannot be undone.` : ''}
        confirmText={isDeleting ? 'Removing...' : 'Remove'}
        confirmButtonClass="bg-rose-600 hover:bg-rose-700"
      />
    </>
  );
}
Streamers.propTypes = {
  apiClient: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),
  refreshKey: PropTypes.number.isRequired,
};

function Donors({ apiClient, refreshKey, search }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [saving, setSaving] = useState(false);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  const [banModal, setBanModal] = useState({ open: false, donor: null });
  const [banReason, setBanReason] = useState('');
  const [banDuration, setBanDuration] = useState('24h');
  const [customDurationMinutes, setCustomDurationMinutes] = useState('');
  const [banSubmitting, setBanSubmitting] = useState(false);

  useEffect(() => {
    if (!apiClient) return;
    setLoading(true);
    
    const queryParams = new URLSearchParams({
      page,
      limit,
      ...(search && { search })
    });

    apiClient.get(`/donors?${queryParams}`).then((r) => {
      if (r.data.pagination) {
        setRows(r.data.donors || []);
        setTotalPages(r.data.pagination.totalPages);
      } else {
        setRows(r.data.donors || []);
      }
    }).catch((e) => setError(e?.message || 'Failed')).finally(() => setLoading(false));

    socket.on('admin_update', (data) => {
// console.log('[Donors] Admin update received via socket:', data);
      setRefresh((x) => x + 1); // Trigger a refresh of donors
    });

    return () => {
      socket.off('admin_update');
    };
  }, [apiClient, refresh, refreshKey, page, search]);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [search]);

  const formatBanExpiry = (iso) => {
    if (!iso) return 'Permanent';
    try {
      return new Date(iso).toLocaleString('en-GB', { timeZone: 'Africa/Addis_Ababa' });
    } catch (error) {
      return new Date(iso).toISOString();
    }
  };

  const openBanModal = (donor) => {
    setBanModal({ open: true, donor });
    setBanReason('');
    setBanDuration('24h');
    setCustomDurationMinutes('');
  };

  const closeBanModal = () => {
    setBanModal({ open: false, donor: null });
    setBanSubmitting(false);
    setBanReason('');
    setBanDuration('24h');
    setCustomDurationMinutes('');
  };

  const submitBan = async () => {
    if (!apiClient || !banModal.donor) return;
    if (!banReason.trim()) {
      alert('Please provide a reason for the ban.');
      return;
    }

    const durationMinutes = resolveBanDurationMinutes(banDuration, customDurationMinutes);
    if (banDuration === 'custom' && (!durationMinutes || durationMinutes <= 0)) {
      alert('Enter a valid custom duration (minutes).');
      return;
    }

    try {
      setBanSubmitting(true);
      await apiClient.post(`/donors/${banModal.donor.telegram_id}/ban`, {
        reason: banReason.trim(),
        durationMinutes,
      });
      closeBanModal();
      setRefresh((x) => x + 1);
    } catch (error) {
      alert(error?.response?.data?.error || error?.message || 'Failed to ban donor');
    } finally {
      setBanSubmitting(false);
    }
  };

  const handleUnban = async (donor) => {
    if (!apiClient) return;
    const confirmed = window.confirm('Unban this donor? They will immediately regain access.');
    if (!confirmed) return;
    try {
      await apiClient.post(`/donors/${donor.telegram_id}/unban`);
      setRefresh((x) => x + 1);
    } catch (error) {
      alert(error?.response?.data?.error || error?.message || 'Failed to unban donor');
    }
  };

  const startEdit = (row) => {
    setEditingId(row.telegram_id);
    setDisplayName(row.display_name || row.username || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDisplayName('');
  };

  const save = async (id) => {
    if (!apiClient) return;
    try {
      setSaving(true);
      await apiClient.post(`/donors/${id}/display-name`, { display_name: displayName });
      setEditingId(null);
      setDisplayName('');
      setRefresh((x) => x + 1);
    } catch (e) {
      alert(e?.response?.data?.error || e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center p-8">
      <LoadingSpinner size="md" text="Loading donors..." />
    </div>
  );
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div className="bg-surface/80 backdrop-blur-xl rounded-2xl shadow-sm border border-line/60 overflow-hidden animate-fade-in-stagger">
      <div className="px-6 py-5 border-b border-line/80">
        <h3 className="text-lg font-bold text-fg tracking-tight">Donors Management</h3>
        <p className="text-sm text-subtle mt-1">Manage donor information and display names</p>
      </div>

      {/* Mobile Card View */}
      <div className="block sm:hidden divide-y divide-line">
        {rows.map((d, index) => {
          const isBanned = Boolean(d.is_banned);
          return (
            <div key={d.telegram_id} className={`p-4 ${isBanned ? 'bg-rose-50/50 dark:bg-rose-900/10' : ''}`}>
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${isBanned ? 'bg-rose-400' : 'bg-cyan-500'}`}>
                  {(d.username || 'D').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-semibold text-fg truncate">
                      {d.username || 'Unknown Donor'}
                    </div>
                    {isBanned ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">BANNED</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">ACTIVE</span>
                    )}
                  </div>
                  <div className="text-xs text-muted mb-3">ID: {d.telegram_id}</div>

                  <div className="space-y-3">
                    <div className="bg-surface-2 p-3 rounded-lg">
                      <label className="text-xs font-medium text-muted block mb-1 uppercase tracking-wider">Display Name</label>
                      {editingId === d.telegram_id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-line-strong bg-surface text-fg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            placeholder="e.g. አበበ መኮንን"
                          />
                          <div className="flex gap-2">
                            <button
                              disabled={saving}
                              onClick={() => save(d.telegram_id)}
                              className="flex-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded transition-colors"
                            >
                              Save
                            </button>
                            <button
                              disabled={saving}
                              onClick={cancelEdit}
                              className="flex-1 px-3 py-1.5 bg-surface-3 hover:bg-gray-300 text-muted text-xs font-medium rounded transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-fg truncate">
                            {d.display_name || d.username || <span className="text-subtle italic">Not set</span>}
                          </div>
                          <button
                            onClick={() => startEdit(d)}
                            className="text-primary-500 hover:text-primary-600 text-xs font-medium"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-surface-2 p-2 rounded-lg">
                        <span className="text-xs text-muted block">Donations</span>
                        <div className="font-semibold text-fg text-sm mt-0.5">{d.donations_count}</div>
                      </div>
                      <div className="bg-surface-2 p-2 rounded-lg text-right">
                        <span className="text-xs text-muted block">Total Donated</span>
                        <div className="font-semibold text-fg text-sm mt-0.5">
                          <Currency value={d.total_donated} />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <Balance
                        value={d.balance}
                        className="text-green-600 dark:text-green-400 font-bold"
                        label="Balance"
                        showToggle={false}
                      />
                      {isBanned ? (
                        <button
                          type="button"
                          className="text-emerald-600 hover:text-emerald-700 text-xs font-medium px-2 py-1 rounded hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                          onClick={() => handleUnban(d)}
                        >
                          Unban Donor
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="text-rose-600 hover:text-rose-700 text-xs font-medium px-2 py-1 rounded hover:bg-rose-50 dark:hover:bg-rose-900/20"
                          onClick={() => openBanModal(d)}
                        >
                          Ban Donor
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Table View */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-2/50 border-b border-line">
              <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider">Donor</th>
              <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider">Display Name</th>
              <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider text-center">Donations</th>
              <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider text-right">Total Donated</th>
              <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider text-right">Balance</th>
              <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider text-center">Status</th>
              <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((d, index) => {
              const isBanned = Boolean(d.is_banned);
              return (
                <tr
                  key={d.telegram_id}
                  className={`transition-colors ${isBanned ? 'bg-rose-50/30 dark:bg-rose-900/10' : 'hover:bg-surface-2'}`}
                >
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm ${isBanned ? 'bg-rose-400' : 'bg-cyan-500'}`}>
                        {(d.username || 'D').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-fg text-sm">
                          {d.username || 'Unknown Donor'}
                        </div>
                        <div className="text-xs text-muted">ID: {d.telegram_id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    {editingId === d.telegram_id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="w-64 px-3 py-2 rounded-lg border border-line-strong bg-surface text-fg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm"
                          placeholder="Name"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <div className="font-medium text-fg text-sm">
                        {d.display_name || d.username || <span className="text-subtle italic">Not set</span>}
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-2 text-fg">
                      {d.donations_count}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="font-bold text-fg text-sm">
                      <Currency value={d.total_donated} />
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <Balance
                      value={d.balance}
                      className="text-sm font-bold text-green-600 dark:text-green-400"
                      showLabel={false}
                      showToggle={false}
                    />
                  </td>
                  <td className="py-4 px-6 text-center">
                    {isBanned ? (
                      <div className="group relative inline-block">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 cursor-help">
                          BANNED
                        </span>
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          <p className="font-bold">Reason:</p>
                          <p>{d.ban_reason || 'No reason provided'}</p>
                          <p className="mt-1 text-subtle">Expires: {formatBanExpiry(d.ban_expires_at)}</p>
                        </div>
                      </div>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        ACTIVE
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {editingId === d.telegram_id ? (
                        <>
                          <button
                            disabled={saving}
                            onClick={() => save(d.telegram_id)}
                            className="text-green-600 hover:text-green-700 p-1"
                            title="Save"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          </button>
                          <button
                            disabled={saving}
                            onClick={cancelEdit}
                            className="text-subtle hover:text-muted p-1"
                            title="Cancel"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startEdit(d)}
                          className="text-subtle hover:text-primary-600 transition-colors p-1"
                          title="Edit Name"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                      )}
                      
                      <div className="w-px h-4 bg-surface-3 mx-1"></div>

                      {isBanned ? (
                        <button
                          onClick={() => handleUnban(d)}
                          className="text-emerald-500 hover:text-emerald-700 transition-colors p-1"
                          title="Unban Donor"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                      ) : (
                        <button
                          onClick={() => openBanModal(d)}
                          className="text-subtle hover:text-rose-600 transition-colors p-1"
                          title="Ban Donor"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-line bg-surface-2/50">
          <div className="text-sm text-muted">
            Page <span className="font-medium text-fg">{page}</span> of <span className="font-medium text-fg">{totalPages}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-sm font-medium rounded-lg border border-line bg-surface text-muted hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 text-sm font-medium rounded-lg border border-line bg-surface text-muted hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {banModal.open && banModal.donor && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 transition-all">
          <div className="w-full max-w-lg rounded-2xl bg-surface border border-line shadow-2xl p-6 space-y-4 animate-scale-in transform transition-all scale-100">
            <div>
              <h4 className="text-lg font-semibold text-fg">Ban Donor</h4>
              <p className="text-sm text-muted">
                {banModal.donor.display_name || banModal.donor.username || `ID ${banModal.donor.telegram_id}`}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted">Reason</label>
              <textarea
                className="w-full rounded-xl border border-line-strong bg-surface text-fg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-400"
                rows={3}
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="e.g. Offensive language in repeated donations"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted">Duration</label>
              <select
                className="w-full rounded-xl border border-line-strong bg-surface text-fg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-400"
                value={banDuration}
                onChange={(e) => setBanDuration(e.target.value)}
              >
                {BAN_DURATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {banDuration === 'custom' && (
                <input
                  type="number"
                  min="1"
                  className="w-full rounded-xl border border-line-strong bg-surface text-fg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-400"
                  placeholder="Enter minutes (e.g. 60)"
                  value={customDurationMinutes}
                  onChange={(e) => setCustomDurationMinutes(e.target.value)}
                />
              )}
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closeBanModal}
                className="btn btn-secondary"
                disabled={banSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitBan}
                disabled={banSubmitting}
                className="btn bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white"
              >
                {banSubmitting ? 'Banning...' : 'Ban Donor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
Donors.propTypes = {
  apiClient: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),
  refreshKey: PropTypes.number.isRequired,
};

function Donations({ apiClient, refreshKey }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  useEffect(() => {
    if (!apiClient) return;
    setLoading(true);
    
    const queryParams = new URLSearchParams({
      page,
      limit
    });

    apiClient.get(`/donations?${queryParams}`).then(r => {
      if (r.data.pagination) {
        setRows(r.data.donations || []);
        setTotalPages(r.data.pagination.totalPages);
      } else {
        setRows(r.data.donations || []);
      }
    }).catch(e => setError(e?.message || 'Failed')).finally(() => setLoading(false));
  }, [apiClient, refreshKey, page]);

  if (loading) return (
    <div className="flex justify-center p-8">
      <LoadingSpinner size="md" text="Loading donations..." />
    </div>
  );
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div className="bg-surface/80 backdrop-blur-xl rounded-2xl shadow-sm border border-line/60 overflow-hidden animate-fade-in-stagger">
      <div className="px-6 py-5 border-b border-line/80">
        <h3 className="text-lg font-bold text-fg tracking-tight">Recent Donations</h3>
        <p className="text-sm text-subtle mt-1">View all donation transactions</p>
      </div>

      {/* Mobile Card View */}
      <div className="block sm:hidden divide-y divide-line">
        {rows.map((d, index) => (
          <div key={d.id} className="p-4 hover:bg-surface-2 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-fg truncate">
                  {d.donor?.username || 'Unknown Donor'}
                </div>
                <div className="text-xs text-muted flex items-center gap-1">
                  <span>to</span>
                  <span className="font-medium text-muted">{d.streamer?.username || 'Unknown Streamer'}</span>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${d.status === 'paid'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : d.status === 'pending'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  : 'bg-surface-2 text-muted'
                }`}>
                {d.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-surface-2 p-3 rounded-lg">
              <div>
                <span className="text-xs text-muted block uppercase tracking-wider">Amount</span>
                <div className="font-bold text-fg mt-0.5">
                  <Currency value={d.amount} />
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-muted block uppercase tracking-wider">Date</span>
                <div className="text-xs font-medium text-muted mt-0.5">
                  {new Date(d.created_at).toLocaleDateString()}
                </div>
                <div className="text-[10px] text-subtle">
                  {new Date(d.created_at).toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-2/50 border-b border-line">
              <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider">When</th>
              <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider">Streamer</th>
              <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider">Donor</th>
              <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider text-right">Amount</th>
              <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((d, index) => (
              <tr key={d.id} className="hover:bg-surface-2 transition-colors">
                <td className="py-4 px-6">
                  <div className="text-sm text-fg font-medium">
                    {new Date(d.created_at).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-muted">
                    {new Date(d.created_at).toLocaleTimeString()}
                  </div>
                </td>
                <td className="py-4 px-6">
                  <div className="font-medium text-fg text-sm">
                    {d.streamer?.username || '—'}
                  </div>
                </td>
                <td className="py-4 px-6">
                  <div className="font-medium text-fg text-sm">
                    {d.donor?.username || '—'}
                  </div>
                </td>
                <td className="py-4 px-6 text-right">
                  <div className="font-bold text-fg text-sm">
                    <Currency value={d.amount} />
                  </div>
                </td>
                <td className="py-4 px-6 text-center">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${d.status === 'paid'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : d.status === 'pending'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'bg-surface-2 text-muted'
                    }`}>
                    {d.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-line bg-surface-2/50">
          <div className="text-sm text-muted">
            Page <span className="font-medium text-fg">{page}</span> of <span className="font-medium text-fg">{totalPages}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-sm font-medium rounded-lg border border-line bg-surface text-muted hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 text-sm font-medium rounded-lg border border-line bg-surface text-muted hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
Donations.propTypes = {
  apiClient: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),
  refreshKey: PropTypes.number.isRequired,
};

function Recharges({ apiClient }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [modal, setModal] = useState({ open: false, id: null, amount: '', recharge: null });
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [imageModal, setImageModal] = useState({ open: false, src: '' });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, action: null, id: null, title: '', message: '' });

  useEffect(() => {
    if (!apiClient) return;
    setLoading(true);
    apiClient.get(`/recharges`).then(r => setRows(r.data.recharges || [])).catch(e => setError(e?.message || 'Failed')).finally(() => setLoading(false));

    socket.on('admin_update', (data) => {
// console.log('[Recharges] Admin update received via socket:', data);
      setRefresh(x => x + 1); // Trigger a refresh of recharges
    });

    return () => {
      socket.off('admin_update');
    };
  }, [apiClient, refresh]);

  const openReviewModal = (recharge) => {
    setModal({ 
      open: true, 
      id: recharge.id, 
      amount: recharge.requested_amount ? String(recharge.requested_amount) : '',
      recharge: recharge
    });
  };

  const handleApprove = async () => {
    if (!apiClient || !modal.id) return;
    const value = Number(modal.amount);
    if (!Number.isFinite(value) || value <= 0) {
      alert('Please enter a valid positive amount.');
      return;
    }
    try {
      setSaving(true);
      await apiClient.post(`/recharges/${modal.id}/approve?amount=${encodeURIComponent(value)}`);
      setModal({ open: false, id: null, amount: '', recharge: null });
      setRefresh(x => x + 1);
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!apiClient || !modal.id) return;
    if (!confirm('Are you sure you want to reject this recharge?')) return;
    
    try {
      setSaving(true);
      await apiClient.post(`/recharges/${modal.id}/reject`);
      setModal({ open: false, id: null, amount: '', recharge: null });
      setRefresh(x => x + 1);
    } catch (e) {
      alert(`Failed to reject: ${e?.response?.data?.error || e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const closeModal = () => setModal({ open: false, id: null, amount: '', recharge: null });

  const openImageModal = (src) => setImageModal({ open: true, src });
  const closeImageModal = () => setImageModal({ open: false, src: '' });

  const openConfirmModal = (action, id, title, message) => {
    setConfirmModal({ isOpen: true, action, id, title, message });
  };

  const handleConfirmAction = async () => {
    if (!apiClient || !confirmModal.action || !confirmModal.id) return;
    const { action, id } = confirmModal;
    try {
      setSaving(true);
      await apiClient.post(`/recharges/${id}/${action}`);
      setRefresh(x => x + 1);
    } catch (e) {
      alert(`Failed to ${action}: ${e?.response?.data?.error || e.message}`);
    } finally {
      setSaving(false);
      setConfirmModal({ isOpen: false, action: null, id: null, title: '', message: '' });
    }
  };

  const closeConfirmModal = () => {
    setConfirmModal({ isOpen: false, action: null, id: null, title: '', message: '' });
  };

  if (loading) return (
    <div className="flex justify-center p-8">
      <LoadingSpinner size="md" text="Loading recharges..." />
    </div>
  );
  if (error) return <div className="text-red-600">{error}</div>;

  const filteredRows = rows.filter(r => r.status === statusFilter);

  return (
    <>
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={closeConfirmModal}
        onConfirm={handleConfirmAction}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmButtonClass={confirmModal.action === 'reject' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}
        confirmText={confirmModal.action === 'reject' ? 'Reject' : 'Confirm'}
      />
      {modal.open && modal.recharge && (
        <div className="fixed inset-0 z-[9998] flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 pt-16 sm:pt-20">
          <div 
            className="relative w-full max-w-xl md:max-w-2xl bg-surface rounded-2xl shadow-2xl border border-line overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={closeModal}
              className="absolute top-3 right-3 z-10 p-2 rounded-full bg-surface-2 hover:bg-surface-3 text-muted transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="p-5 pb-4 border-b bg-surface-2">
              <h3 className="text-lg font-bold text-fg pr-8">Review Recharge</h3>
              <p className="text-sm text-muted mt-1">
                Request from <span className="font-medium text-fg">{modal.recharge.donor_username || 'Unknown'}</span>
              </p>
            </div>
            
            {/* Content - Scrollable */}
            <div className="p-5 space-y-5 max-h-[calc(100vh-16rem)] overflow-y-auto">
              {/* Name on Payment */}
              <div className="flex justify-between items-center p-3 bg-surface-2 rounded-xl">
                <span className="text-sm text-muted">Name on Payment</span>
                <span className="font-semibold text-fg">{modal.recharge.name_on_payment}</span>
              </div>
              
              {/* Screenshot */}
              {modal.recharge.screenshot_url && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-muted uppercase tracking-wider">Payment Screenshot</span>
                  <div 
                    className="relative group rounded-xl overflow-hidden border border-line cursor-pointer"
                    onClick={() => openImageModal(modal.recharge.screenshot_url)}
                  >
                    <img 
                      src={modal.recharge.screenshot_url} 
                      alt="Payment Screenshot" 
                      className="w-full h-40 object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-white text-sm font-semibold bg-black/60 px-3 py-1.5 rounded-full flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                        </svg>
                        View Full
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Amount Input */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-muted">
                  Approved Amount (Br)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={modal.amount}
                  onChange={(e) => setModal(m => ({ ...m, amount: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-line-strong bg-surface text-fg text-xl font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow"
                  placeholder="0.00"
                />
                {modal.recharge.requested_amount && (
                  <p className="text-xs text-muted text-right">
                    Requested: <span className="font-semibold text-primary-600 dark:text-primary-400">{modal.recharge.requested_amount} Br</span>
                  </p>
                )}
              </div>
            </div>

            {/* Actions - Fixed at bottom */}
            <div className="p-5 pt-4 border-t bg-surface-2 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={handleReject} 
                  disabled={saving}
                  className="py-3 px-4 bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/30 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-400 rounded-xl font-bold transition-colors disabled:opacity-50"
                >
                  Reject
                </button>
                <button 
                  onClick={handleApprove} 
                  disabled={saving}
                  className="py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50"
                >
                  {saving ? "Processing..." : "Approve"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="bg-surface/80 backdrop-blur-xl rounded-2xl shadow-sm border border-line/60 overflow-hidden animate-fade-in-stagger">
        <div className="px-6 py-5 border-b border-line/80">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-fg tracking-tight">Recharge Requests</h3>
              <p className="text-sm text-subtle mt-1">Manage donor wallet top-ups</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setStatusFilter('pending')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'pending'
                ? 'bg-primary-500 text-white shadow-sm'
                : 'bg-surface-2 text-muted hover:bg-surface-3'
                }`}>Pending</button>
              <button onClick={() => setStatusFilter('approved')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'approved'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'bg-surface-2 text-muted hover:bg-surface-3'
                }`}>Approved</button>
              <button onClick={() => setStatusFilter('rejected')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'rejected'
                ? 'bg-rose-500 text-white shadow-sm'
                : 'bg-surface-2 text-muted hover:bg-surface-3'
                }`}>Rejected</button>
            </div>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="block sm:hidden divide-y divide-line">
          {filteredRows.map((r, index) => (
            <div key={r.id} className="p-4 hover:bg-surface-2 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-fg truncate">
                    {r.donor_username || 'Unknown Donor'}
                  </div>
                  <div className="text-xs text-muted">
                    {new Date(r.created_at).toLocaleDateString()}
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${r.status === 'approved'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : r.status === 'rejected'
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  }`}>
                  {r.status}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 bg-surface-2 p-3 rounded-lg">
                  {r.screenshot_url ? (
                    <img
                      src={r.screenshot_url}
                      alt="screenshot"
                      className="w-12 h-12 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0 border border-line"
                      onClick={() => openImageModal(r.screenshot_url)}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-surface-3 flex items-center justify-center flex-shrink-0">
                      <span className="text-subtle text-[10px]">No img</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted uppercase tracking-wider">Name on Payment</div>
                    <div className="font-medium text-fg truncate text-sm">
                      {r.name_on_payment}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs text-muted block uppercase tracking-wider">Requested</span>
                    <div className="font-bold text-fg mt-0.5">
                      {r.requested_amount ? <Currency value={r.requested_amount} /> : <span className="text-subtle">—</span>}
                    </div>
                  </div>
                  {r.amount > 0 && (
                    <div className="text-right">
                      <span className="text-xs text-muted block uppercase tracking-wider">Approved</span>
                      <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        <Currency value={r.amount} />
                      </div>
                    </div>
                  )}
                </div>

                {r.status === 'pending' && (
                  <div className="pt-2 border-t border-line mt-2">
                    <button 
                      onClick={() => openReviewModal(r)} 
                      className="w-full py-2.5 bg-surface border border-line hover:bg-surface-2 text-muted rounded-xl text-sm font-bold transition-all shadow-sm hover:shadow flex items-center justify-center gap-2"
                    >
                      <span>Review Request</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-2/50 border-b border-line">
                <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider">When</th>
                <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider">Donor</th>
                <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider">Payment Name</th>
                <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider">Screenshot</th>
                <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider text-right">Requested</th>
                <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider text-right">Approved</th>
                <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider text-center">Status</th>
                <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredRows.map((r, index) => (
                <tr key={r.id} className="hover:bg-surface-2 transition-colors">
                  <td className="py-4 px-6">
                    <div className="text-sm text-fg font-medium">
                      {new Date(r.created_at).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-muted">
                      {new Date(r.created_at).toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="font-medium text-fg text-sm">
                      {r.donor_username || '—'}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="text-sm text-fg">
                      {r.name_on_payment}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    {r.screenshot_url ? (
                      <img
                        src={r.screenshot_url}
                        alt="screenshot"
                        className="w-12 h-12 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity border border-line"
                        onClick={() => openImageModal(r.screenshot_url)}
                      />
                    ) : (
                      <span className="text-subtle text-xs">—</span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="font-bold text-fg text-sm">
                      {r.requested_amount ? <Currency value={r.requested_amount} /> : <span className="text-subtle">—</span>}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      {r.amount > 0 ? <Currency value={r.amount} /> : <span className="text-subtle">—</span>}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${r.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : r.status === 'rejected'
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <div className="flex justify-center">
                      {r.status === 'pending' && (
                        <button 
                          onClick={() => openReviewModal(r)} 
                          className="px-4 py-2 bg-surface border border-line hover:bg-surface-2 text-muted rounded-lg text-sm font-bold transition-all shadow-sm hover:shadow flex items-center gap-2"
                        >
                          Review
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ImageViewer
        isOpen={imageModal.open}
        src={imageModal.src}
        alt="Payment Screenshot"
        onClose={closeImageModal}
      />
    </>
  );
}
Recharges.propTypes = {
  apiClient: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),
};

function Withdrawals({ apiClient }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, action: null, id: null, title: '', message: '' });

  useEffect(() => {
    if (!apiClient) return;
    setLoading(true);
    apiClient.get(`/withdrawals`).then(r => setRows(r.data.withdrawals || [])).catch(e => setError(e?.message || 'Failed')).finally(() => setLoading(false));

    socket.on('admin_update', (data) => {
// console.log('[Withdrawals] Admin update received via socket:', data);
      setRefresh(x => x + 1); // Trigger a refresh of withdrawals
    });

    return () => {
      socket.off('admin_update');
    };
  }, [apiClient, refresh]);

  const openConfirmModal = (action, id, title, message) => {
    setConfirmModal({ isOpen: true, action, id, title, message });
  };

  const handleConfirmAction = async () => {
    if (!apiClient || !confirmModal.action || !confirmModal.id) return;
    const { action, id } = confirmModal;
    try {
      await apiClient.post(`/withdrawals/${id}/${action}`);
      setRefresh(x => x + 1);
    } catch (e) {
      alert(`Failed to ${action}: ${e?.response?.data?.error || e.message}`);
    } finally {
      setConfirmModal({ isOpen: false, action: null, id: null, title: '', message: '' });
    }
  };

  const closeConfirmModal = () => {
    setConfirmModal({ isOpen: false, action: null, id: null, title: '', message: '' });
  };

  if (loading) return (
    <div className="flex justify-center p-8">
      <LoadingSpinner size="md" text="Loading withdrawals..." />
    </div>
  );
  if (error) return <div className="text-red-600">{error}</div>;

  const filteredRows = rows.filter(r => r.status === statusFilter);

  return (
    <>
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={closeConfirmModal}
        onConfirm={handleConfirmAction}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmButtonClass={confirmModal.action === 'reject' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}
        confirmText={confirmModal.action === 'reject' ? 'Reject' : 'Confirm'}
      />
      <div className="bg-surface/80 backdrop-blur-xl rounded-2xl shadow-sm border border-line/60 overflow-hidden animate-fade-in-stagger">
        <div className="px-6 py-5 border-b border-line/80">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-fg tracking-tight">Withdrawal Requests</h3>
              <p className="text-sm text-subtle mt-1">Manage streamer payout requests</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setStatusFilter('pending')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'pending'
                ? 'bg-primary-500 text-white shadow-sm'
                : 'bg-surface-2 text-muted hover:bg-surface-3'
                }`}>Pending</button>
              <button onClick={() => setStatusFilter('approved')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'approved'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'bg-surface-2 text-muted hover:bg-surface-3'
                }`}>Approved</button>
              <button onClick={() => setStatusFilter('rejected')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'rejected'
                ? 'bg-rose-500 text-white shadow-sm'
                : 'bg-surface-2 text-muted hover:bg-surface-3'
                }`}>Rejected</button>
            </div>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="block sm:hidden divide-y divide-line">
          {filteredRows.map((w, index) => (
            <div key={w.id} className="p-4 hover:bg-surface-2 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-fg truncate">
                    {w.streamer_username || 'Unknown Streamer'}
                  </div>
                  <div className="text-xs text-muted">
                    {new Date(w.created_at).toLocaleDateString()}
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${w.status === 'approved'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : w.status === 'rejected'
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  }`}>
                  {w.status}
                </span>
              </div>

              <div className="space-y-3">
                <div className="bg-surface-2 p-3 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-muted">Telebirr</span>
                    <span className="text-sm font-medium text-fg">{w.telebirr_username}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted">Phone</span>
                    <span className="text-sm font-medium text-fg">{w.phone_number}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs text-muted block uppercase tracking-wider">Amount</span>
                    <div className="font-bold text-fg mt-0.5">
                      <Currency value={w.amount} />
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-muted block uppercase tracking-wider">Payout (60%)</span>
                    <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      <Currency value={w.amount * 0.6} />
                    </div>
                  </div>
                </div>

                {w.status === 'pending' && (
                  <div className="flex gap-2 pt-2 border-t border-line mt-2">
                    <button onClick={() => openConfirmModal('approve', w.id, 'Approve Withdrawal', `Are you sure you want to approve this withdrawal request from ${w.streamer_username}?`)} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors">Approve</button>
                    <button onClick={() => openConfirmModal('reject', w.id, 'Reject Withdrawal', `Are you sure you want to reject this withdrawal request from ${w.streamer_username}?`)} className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium transition-colors">Reject</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-2/50 border-b border-line">
                <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider">When</th>
                <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider">Streamer</th>
                <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider">Telebirr Username</th>
                <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider">Phone Number</th>
                <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider text-right">Amount</th>
                <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider text-right">Payout (60%)</th>
                <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider text-center">Status</th>
                <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredRows.map((w, index) => (
                <tr key={w.id} className="hover:bg-surface-2 transition-colors">
                  <td className="py-4 px-6">
                    <div className="text-sm text-fg font-medium">
                      {new Date(w.created_at).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-muted">
                      {new Date(w.created_at).toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="font-medium text-fg text-sm">
                      {w.streamer_username || '—'}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="text-sm text-fg">
                      {w.telebirr_username}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="text-sm text-fg">
                      {w.phone_number}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="font-bold text-fg text-sm">
                      <Currency value={w.amount} />
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      <Currency value={w.amount * 0.6} />
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${w.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : w.status === 'rejected'
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}>
                      {w.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <div className="flex justify-center">
                      {w.status === 'pending' && (
                        <div className="flex gap-2">
                          <button onClick={() => openConfirmModal('approve', w.id, 'Approve Withdrawal', `Are you sure you want to approve this withdrawal request from ${w.streamer_username}?`)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors" title="Approve">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          </button>
                          <button onClick={() => openConfirmModal('reject', w.id, 'Reject Withdrawal', `Are you sure you want to reject this withdrawal request from ${w.streamer_username}?`)} className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors" title="Reject">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
Withdrawals.propTypes = {
  apiClient: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),
};

function StreamerRequests({ apiClient }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [imageModal, setImageModal] = useState({ open: false, src: '' });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, action: null, id: null, title: '', message: '' });

  useEffect(() => {
    if (!apiClient) return;
    setLoading(true);
    apiClient.get(`/streamer-requests`)
      .then(r => setRows(r.data.requests || []))
      .catch(e => setError(e?.message || 'Failed to load requests'))
      .finally(() => setLoading(false));

    socket.on('admin_update', (data) => {
// console.log('[StreamerRequests] Admin update received via socket:', data);
      setRefresh(x => x + 1); // Trigger a refresh of streamer requests
    });

    return () => {
      socket.off('admin_update');
    };
  }, [apiClient, refresh]);

  const openImageModal = (src) => setImageModal({ open: true, src });
  const closeImageModal = () => setImageModal({ open: false, src: '' });

  const openConfirmModal = (action, id, title, message) => {
    setConfirmModal({ isOpen: true, action, id, title, message });
  };

  const handleConfirmAction = async () => {
    if (!apiClient || !confirmModal.action || !confirmModal.id) return;
    const { action, id } = confirmModal;
    try {
      await apiClient.post(`/streamer-requests/${id}/${action}`);
      setRefresh(x => x + 1);
    } catch (e) {
      alert(`Failed to ${action}: ${e?.response?.data?.error || e.message}`);
    } finally {
      setConfirmModal({ isOpen: false, action: null, id: null, title: '', message: '' });
    }
  };

  const closeConfirmModal = () => {
    setConfirmModal({ isOpen: false, action: null, id: null, title: '', message: '' });
  };

  if (loading) return (
    <div className="flex justify-center p-8">
      <LoadingSpinner size="md" text="Loading streamer requests..." />
    </div>
  );
  if (error) return <div className="text-red-600">{error}</div>;

  const filteredRows = rows.filter(r => r.registration_status === statusFilter);

  return (
    <>
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={closeConfirmModal}
        onConfirm={handleConfirmAction}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmButtonClass={confirmModal.action === 'reject' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}
        confirmText={confirmModal.action === 'reject' ? 'Reject' : 'Confirm'}
      />
      <div className="bg-surface/80 backdrop-blur-xl rounded-2xl shadow-sm border border-line/60 overflow-hidden animate-fade-in-stagger">
        <div className="px-6 py-5 border-b border-line/80">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-fg tracking-tight">Streamer Requests</h3>
              <p className="text-sm text-subtle mt-1">Review new streamer applications</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setStatusFilter('pending')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'pending'
                ? 'bg-primary-500 text-white shadow-sm'
                : 'bg-surface-2 text-muted hover:bg-surface-3'
                }`}>Pending</button>
              <button onClick={() => setStatusFilter('approved')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'approved'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'bg-surface-2 text-muted hover:bg-surface-3'
                }`}>Approved</button>
              <button onClick={() => setStatusFilter('rejected')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'rejected'
                ? 'bg-rose-500 text-white shadow-sm'
                : 'bg-surface-2 text-muted hover:bg-surface-3'
                }`}>Rejected</button>
            </div>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="block sm:hidden divide-y divide-line">
          {filteredRows.map((r, index) => (
            <div key={r.telegram_id} className="p-4 hover:bg-surface-2 transition-colors">
              <div className="flex items-start gap-3 mb-3">
                {r.profile_picture_url ? (
                  <img
                    src={r.profile_picture_url}
                    alt="Profile"
                    className="w-12 h-12 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0 border border-line"
                    onClick={() => openImageModal(r.profile_picture_url)}
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-surface-3 flex items-center justify-center flex-shrink-0">
                    <span className="text-subtle text-[10px]">No img</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-fg truncate">
                      {r.full_name}
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${r.registration_status === 'approved'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : r.registration_status === 'rejected'
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}>
                      {r.registration_status}
                    </span>
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    @{r.username}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-surface-2 p-3 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-muted">Phone</span>
                    <span className="text-sm font-medium text-fg">{r.phone_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted">Submitted</span>
                    <span className="text-sm font-medium text-fg">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {r.registration_status === 'pending' && (
                  <div className="flex gap-2 pt-2 border-t border-line mt-2">
                    <button onClick={() => openConfirmModal('approve', r.telegram_id, 'Approve Streamer', `Are you sure you want to approve ${r.full_name || r.username}?`)} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors">Approve</button>
                    <button onClick={() => openConfirmModal('reject', r.telegram_id, 'Reject Streamer', `Are you sure you want to reject ${r.full_name || r.username}?`)} className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium transition-colors">Reject</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-2/50 border-b border-line">
                <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider">Submitted</th>
                <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider">Picture</th>
                <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider">Full Name</th>
                <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider">Username</th>
                <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider">Phone Number</th>
                <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider text-center">Status</th>
                <th className="py-3 px-6 text-xs font-semibold text-muted uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredRows.map((r, index) => (
                <tr key={r.telegram_id} className="hover:bg-surface-2 transition-colors">
                  <td className="py-4 px-6">
                    <div className="text-sm text-fg font-medium">
                      {new Date(r.created_at).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-muted">
                      {new Date(r.created_at).toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    {r.profile_picture_url ? (
                      <img
                        src={r.profile_picture_url}
                        alt="Profile"
                        className="w-10 h-10 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity border border-line"
                        onClick={() => openImageModal(r.profile_picture_url)}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-surface-3 flex items-center justify-center">
                        <span className="text-subtle text-[10px]">No img</span>
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    <div className="font-medium text-fg text-sm">
                      {r.full_name}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="text-sm text-muted">
                      @{r.username}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="text-sm text-fg">
                      {r.phone_number}
                    </div>
                  </td>
                  <td className="py-4">
                    <a href={r.social_link} target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:text-primary-600 transition-colors">
                      View Profile
                    </a>
                  </td>
                  <td className="py-4">
                    <span className={`badge ${r.registration_status === 'approved'
                      ? 'badge-success'
                      : r.registration_status === 'rejected'
                        ? 'badge-error'
                        : 'badge-warning'
                      }`}>
                      {r.registration_status}
                    </span>
                  </td>
                  <td className="py-4">
                    <div className="flex justify-center">
                      {r.registration_status === 'pending' && (
                        <div className="flex gap-2">
                          <button onClick={() => openConfirmModal('approve', r.telegram_id, 'Approve Streamer', `Are you sure you want to approve ${r.full_name || r.username}?`)} className="btn btn-success btn-sm">Approve</button>
                          <button onClick={() => openConfirmModal('reject', r.telegram_id, 'Reject Streamer', `Are you sure you want to reject ${r.full_name || r.username}?`)} className="btn btn-danger btn-sm">Reject</button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ImageViewer
        isOpen={imageModal.open}
        src={imageModal.src}
        alt="Verification Document"
        onClose={closeImageModal}
      />
    </>
  );
}
StreamerRequests.propTypes = {
  apiClient: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),
};

// --- Main Component ---
export default function AdminDashboard() {
  const { tab: tabParam } = useParams();
  const tab = tabParam || 'overview';
  const [globalSearch, setGlobalSearch] = useState('');
  const [pendingCounts, setPendingCounts] = useState({ recharges: 0, withdrawals: 0, streamerRequests: 0, complaints: 0, flags: 0 });
  const [toasts, setToasts] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [flagRefreshKey, setFlagRefreshKey] = useState(0);
  const [adminToken, setAdminToken] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [notificationsMuted, setNotificationsMuted] = useState(() => localStorage.getItem('adminNotificationsMuted') === 'true');
  const [notificationAudioReady, setNotificationAudioReady] = useState(false);
  const toastTimersRef = useRef([]);
  const notificationAudioRef = useRef(null);

  // On initial load, check for Admin Token
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      setAdminToken(token);
    } else {
      setIsModalOpen(true);
    }
  }, []);

  const handleTokenSubmit = (token) => {
    localStorage.setItem('adminToken', token);
    setAdminToken(token);
    setIsModalOpen(false);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    if (!adminToken) {
      alert("An Admin Token is required to view this page.");
    }
  };


  useEffect(() => {
    const audio = new Audio('/sounds/admin-notification.mp3');
    audio.preload = 'auto';
    audio.volume = 0.5;
    notificationAudioRef.current = audio;
    return () => {
      audio.pause();
      notificationAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (notificationAudioReady) return undefined;
    const events = ['pointerdown', 'touchstart', 'keydown'];
    const primeAudio = () => {
      const audio = notificationAudioRef.current;
      if (!audio) return;
      audio.muted = true;
      const previousVolume = audio.volume;
      audio.volume = 0;
      audio.play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;
          audio.volume = previousVolume || 0.5;
          setNotificationAudioReady(true);
          cleanup();
        })
        .catch(() => {
          // Ignore; we'll try again on the next user interaction
        });
    };

    function cleanup() {
      events.forEach((evt) => window.removeEventListener(evt, primeAudio, true));
    }

    events.forEach((evt) => window.addEventListener(evt, primeAudio, true));
    return cleanup;
  }, [notificationAudioReady]);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setAdminToken(null);
    setIsModalOpen(true);
  };

  const toggleNotificationMute = () => {
    const newMutedState = !notificationsMuted;
    setNotificationsMuted(newMutedState);
    localStorage.setItem('adminNotificationsMuted', newMutedState.toString());
  };

  const removeToast = useCallback((toastId) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== toastId));
    toastTimersRef.current = toastTimersRef.current.filter((entry) => {
      if (entry.id === toastId) {
        clearTimeout(entry.timer);
        return false;
      }
      return true;
    });
  }, []);

  const addToast = useCallback((event) => {
    if (!event || !event.type) return;

    // Play sound if not muted
    if (!notificationsMuted) {
      try {
        const audio = new Audio('/sounds/notification.mp3');
        audio.play().catch(e => console.warn('Audio play failed', e));
      } catch (e) {
        console.warn('Audio creation failed', e);
      }
    }

    const formatAmount = (value) => {
      const num = Number(value);
      return Number.isFinite(num) ? `Br ${num.toFixed(2)}` : 'Br --';
    };

    const capitalize = (value) => {
      if (!value || typeof value !== 'string') return '';
      return value.charAt(0).toUpperCase() + value.slice(1);
    };

    const payload = event.payload || {};
    let title = 'Admin Update';
    let description = 'Check the admin dashboard for details.';
    let icon = 'info';

    switch (event.type) {
      case 'donation_paid': {
        icon = 'coins';
        title = 'Donation Paid';
        const donor = payload.donorName || 'New donor';
        description = `${donor} sent ${formatAmount(payload.amount)}.`;
        break;
      }
      case 'withdrawal_created': {
        icon = 'wallet';
        title = 'New Withdrawal Request';
        description = `${formatAmount(payload.amount)} awaiting approval.`;
        break;
      }
      case 'withdrawal_updated': {
        icon = 'wallet';
        title = `Withdrawal ${capitalize(payload.status)}`;
        description = `${formatAmount(payload.amount)} for streamer #${payload.streamerId || '—'}.`;
        break;
      }
      case 'recharge_created': {
        icon = 'refresh';
        title = 'Recharge Submitted';
        description = `Donor #${payload.donorId || '—'} uploaded proof.`;
        break;
      }
      case 'recharge_updated': {
        icon = 'refresh';
        title = `Recharge ${capitalize(payload.status)}`;
        description = `Donation balance updated for donor #${payload.donorId || '—'}.`;
        break;
      }
      case 'streamer_request_created': {
        icon = 'userPlus';
        title = 'Streamer Request Received';
        description = `${payload.fullName || 'New applicant'} is waiting for review.`;
        break;
      }
      case 'streamer_request_updated': {
        icon = 'userPlus';
        title = `Streamer Request ${capitalize(payload.status)}`;
        description = `Telegram ID ${payload.telegramId || '—'} ${payload.status || 'updated'}.`;
        break;
      }
      case 'complaint_created': {
        icon = 'message';
        title = 'New Complaint';
        description = 'Check the complaints tab for the latest submission.';
        break;
      }
      case 'complaint_updated': {
        icon = 'message';
        title = 'Complaint Responded';
        description = 'Marked as responded successfully.';
        break;
      }
      case 'donor_flag_created': {
        icon = 'flag';
        title = 'Streamer Flag Raised';
        description = `Streamer #${payload.streamerId || '—'} escalated a donor.`;
        break;
      }
      case 'donor_flag_updated': {
        icon = 'flag';
        title = `Flag ${capitalize(payload.status)}`;
        description = `Donor #${payload.donorId || '—'} update posted.`;
        break;
      }
      default: {
        icon = 'info';
        title = 'Admin Update';
        description = 'Dashboard data changed.';
      }
    }

    const toastId = `${event.type}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const newToast = {
      id: toastId,
      icon,
      title,
      description,
      timestamp: event.timestamp,
    };

    setToasts((prev) => [...prev, newToast]);

    const timer = setTimeout(() => removeToast(toastId), 6000);
    toastTimersRef.current.push({ id: toastId, timer });
  }, [removeToast, notificationsMuted]);

  const apiClient = useMemo(() => {
    if (!adminToken) return null;
    return axios.create({
      baseURL: `${API}/api/admin`,
      headers: { 'x-admin-token': adminToken }
    });
  }, [adminToken]);

  useEffect(() => {
    return () => {
      toastTimersRef.current.forEach((entry) => clearTimeout(entry.timer));
      toastTimersRef.current = [];
    };
  }, []);

  const refreshData = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  const triggerFlagRefresh = useCallback(() => {
    setFlagRefreshKey((key) => key + 1);
  }, []);

  const fetchCounts = useCallback(async () => {
    if (!apiClient) return;
    try {
      const [rechargesRes, withdrawalsRes, streamerRequestsRes, complaintsRes, flagStatsRes] = await Promise.all([
        apiClient.get(`/recharges`),
        apiClient.get(`/withdrawals`),
        apiClient.get(`/streamer-requests`),
        apiClient.get(`/complaints/pending-count`),
        apiClient.get(`/donor-flags/stats`),
      ]);
      const pendingRecharges = rechargesRes.data.recharges.filter(r => r.status === 'pending').length;
      const pendingWithdrawals = withdrawalsRes.data.withdrawals.filter(w => w.status === 'pending').length;
      const pendingStreamerRequests = streamerRequestsRes.data.requests.filter(r => r.registration_status === 'pending').length;
      const pendingFlags = Number(flagStatsRes.data?.pending || 0);
      setPendingCounts({
        recharges: pendingRecharges,
        withdrawals: pendingWithdrawals,
        streamerRequests: pendingStreamerRequests,
        complaints: complaintsRes.data.count,
        flags: pendingFlags,
      });
    } catch (error) {
      console.error("Error fetching pending counts:", error);
      if (error.response?.status === 401) {
        alert("Invalid Admin Token. Please refresh and enter the correct token.");
        localStorage.removeItem('adminToken');
        setAdminToken(null);
      }
    }
  }, [apiClient]);

  useEffect(() => {
    socket.emit('join_admin_room');
    socket.on('connect', () => {
// console.log('Admin socket connected');
      socket.emit('join_admin_room');
    });
    socket.on('disconnect', () => console.log('Admin socket disconnected'));
    socket.on('new_donation', (data) => {
// console.log('[AdminDashboard] New donation received via socket:', data);
      refreshData();
    });
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('new_donation');
    };
  }, [refreshData]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  useEffect(() => {
    if (!apiClient) return;

    const handleAdminUpdate = (data) => {
// console.log('[AdminDashboard] Admin update received via socket:', data);
      fetchCounts();
      addToast(data);

      if (data?.type === 'donor_flag_created' || data?.type === 'donor_flag_updated') {
        triggerFlagRefresh();
      }

      // Play admin notification sound if not muted
      if (!notificationsMuted) {
        try {
          const audio = notificationAudioRef.current || new Audio('/sounds/admin-notification.mp3');
          audio.volume = 0.5;
          audio.currentTime = 0;
          notificationAudioRef.current = audio;
          audio.play().catch(err => {
// console.log('Audio play failed:', err);
            if (!notificationAudioReady) {
// console.log('Waiting for user interaction to unlock notification audio.');
            }
          });
        } catch (err) {
// console.log('Audio notification failed:', err);
        }
      }
    };

    socket.on('admin_update', handleAdminUpdate);
    return () => {
      socket.off('admin_update', handleAdminUpdate);
    };
  }, [apiClient, fetchCounts, addToast, notificationsMuted, notificationAudioReady, triggerFlagRefresh]);

  const NAV_ITEMS = [
    { id: 'overview', label: 'Overview', icon: 'chart' },
    { id: 'streamer-requests', label: 'Streamer requests', icon: 'userPlus', count: pendingCounts.streamerRequests },
    { id: 'streamers', label: 'Streamers', icon: 'live' },
    { id: 'donors', label: 'Donors', icon: 'heart' },
    { id: 'donations', label: 'Donations', icon: 'coins' },
    { id: 'withdrawals', label: 'Withdrawals', icon: 'wallet', count: pendingCounts.withdrawals },
    { id: 'recharges', label: 'Recharges', icon: 'card', count: pendingCounts.recharges },
    { id: 'flags', label: 'Flags', icon: 'flag', count: pendingCounts.flags },
    { id: 'complaints', label: 'Complaints', icon: 'message', count: pendingCounts.complaints },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ];
  const sidebarItems = NAV_ITEMS.map((item) => ({
    to: item.id === 'overview' ? '/admin' : `/admin/${item.id}`,
    icon: item.icon,
    label: item.label,
    end: item.id === 'overview',
    badge: item.count > 0 ? item.count : undefined,
  }));
  const currentItem = NAV_ITEMS.find((i) => i.id === tab);

  const authModal = (
    <ApiKeyModal
      isOpen={isModalOpen}
      onClose={handleModalClose}
      onSubmit={handleTokenSubmit}
      title="Admin sign-in"
      message="Enter the admin token to open the console. It's the ADMIN_TOKEN value in the server's .env file."
    />
  );

  if (!apiClient) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-4 text-center font-sans text-fg">
        {authModal}
        <Logo />
        <p className="text-sm text-muted">Waiting for the admin token…</p>
        {!isModalOpen ? (
          <Button variant="secondary" onClick={() => setIsModalOpen(true)} leftIcon={<Icon name="key" size={16} />}>
            Enter token
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <>
      {authModal}
      <AdminLayout
        items={sidebarItems}
        title={currentItem?.label || 'Overview'}
        user={{ name: 'Admin', subtitle: 'Super administrator', status: 'online' }}
        onLogout={handleLogout}
        headerActions={
          <>
            <div className="hidden w-64 md:block">
              <Input
                aria-label="Search donors"
                size="sm"
                placeholder="Search donors…"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                leftIcon={<Icon name="search" size={15} />}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              onClick={toggleNotificationMute}
              aria-label={notificationsMuted ? 'Unmute notifications' : 'Mute notifications'}
              title={notificationsMuted ? 'Unmute notifications' : 'Mute notifications'}
              className="text-muted"
            >
              <Icon name={notificationsMuted ? 'bellOff' : 'bell'} size={18} />
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-6">
          <p className="-mt-2 text-sm text-muted">Manage and monitor the platform.</p>
          {tab === 'overview' && <Overview apiClient={apiClient} refreshKey={refreshKey} />}
          {tab === 'streamer-requests' && <StreamerRequests apiClient={apiClient} />}
          {tab === 'streamers' && <Streamers apiClient={apiClient} refreshKey={refreshKey} />}
          {tab === 'donors' && <Donors apiClient={apiClient} refreshKey={refreshKey} search={globalSearch} />}
          {tab === 'donations' && <Donations apiClient={apiClient} refreshKey={refreshKey} />}
          {tab === 'withdrawals' && <Withdrawals apiClient={apiClient} />}
          {tab === 'recharges' && <Recharges apiClient={apiClient} />}
          {tab === 'flags' && <DonorFlagsPanel apiClient={apiClient} refreshKey={flagRefreshKey} onFlagResolved={fetchCounts} />}
          {tab === 'complaints' && <AdminComplaints apiClient={apiClient} refreshData={refreshData} />}
          {tab === 'settings' && <Settings apiClient={apiClient} />}
          {!currentItem ? (
            <EmptyState
              icon="search"
              title="Unknown section"
              description="That admin page doesn't exist."
              action={
                <Button as={Link} to="/admin" variant="secondary">
                  Go to overview
                </Button>
              }
            />
          ) : null}
        </div>
      </AdminLayout>

      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex max-w-xs flex-col gap-3 sm:max-w-sm">
          {toasts.map((toast) => (
            <div key={toast.id} className="relative w-72 overflow-hidden rounded-xl border border-line bg-surface p-4 shadow-overlay animate-slide-in-right sm:w-80">
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    toast.type === 'error'
                      ? 'bg-red-500/10 text-red-500'
                      : toast.type === 'warning'
                        ? 'bg-amber-500/10 text-amber-500'
                        : toast.type === 'success'
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : 'bg-brand-500/10 text-brand-500',
                  )}
                >
                  <Icon name={toast.icon} size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-fg">{toast.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">{toast.description}</p>
                  <p className="mt-2 text-[11px] text-subtle">{toast.timestamp ? 'Just now' : 'Live update'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  className={cn('rounded-md p-1 text-subtle transition-colors hover:bg-surface-2 hover:text-fg', focusRing)}
                  aria-label="Dismiss notification"
                >
                  <Icon name="close" size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
