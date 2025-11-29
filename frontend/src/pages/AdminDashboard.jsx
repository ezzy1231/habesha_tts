import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import PropTypes from 'prop-types';
import io from 'socket.io-client';
import ThemeToggle from '../components/ThemeToggle';
import Settings from '../components/Settings';
import ApiKeyModal from '../components/ApiKeyModal';
import ConfirmationModal from '../components/ConfirmationModal';
import Balance from '../components/Balance';
import AdminComplaints from './AdminComplaints';
import LoadingSpinner from '../components/LoadingSpinner';
import SkeletonLoader from '../components/SkeletonLoader';

const API = import.meta.env.VITE_BASE_URL || 'http://localhost:5000';
const socket = io(API, { transports: ['websocket'] });

function Currency({ value }) {
  return <span className="text-gray-900 dark:text-white">Br {Number(value || 0).toFixed(2)}</span>;
}
Currency.propTypes = { value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]) };

function StatCard({ title, value, subtitle }) {
  return (
    <div className="card p-4 sm:p-6 hover:shadow-lg transition-all duration-300 group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 sm:mb-2">{title}</div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white group-hover:text-primary-500 dark:group-hover:text-primary-400 transition-colors truncate">
            {value}
          </div>
          {subtitle && <div className="text-xs sm:text-sm text-gray-400 dark:text-gray-500 mt-1 sm:mt-2">{subtitle}</div>}
        </div>
        <div className="p-2 sm:p-3 bg-gradient-to-br from-primary-100 to-primary-50 rounded-xl group-hover:from-primary-200 group-hover:to-primary-100 transition-all flex-shrink-0">
          <div className="w-4 h-4 sm:w-6 sm:h-6 bg-primary-500 rounded-lg opacity-60"></div>
        </div>
      </div>
    </div>
  );
}
StatCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.node.isRequired,
  subtitle: PropTypes.string,
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
    }).catch(e => setError(e?.message || 'Failed to load')).finally(()=>setLoading(false));
  }, [apiClient, refreshKey]);

  if (loading) return (
    <div className="flex justify-center p-8">
      <LoadingSpinner size="md" text="Loading overview..." />
    </div>
  );
  if (error) return <div className="text-red-600">{error}</div>;

  const t = data.totals || {};

  return (
    <div className="space-y-4 sm:space-y-6 md:space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 animate-fade-in-stagger">
        {loading ? (
          <>
            <SkeletonLoader type="stat" />
            <SkeletonLoader type="stat" />
            <SkeletonLoader type="stat" />
            <SkeletonLoader type="stat" />
          </>
        ) : (
          <>
            <StatCard title="Total Amount" value={<Currency value={t.total_amount} />} subtitle={`${t.total_count || 0} donations`} className="animate-fade-in-stagger" style={{ animationDelay: '0ms' }} />
            <StatCard title="Streamers" value={t.unique_streamers || 0} className="animate-fade-in-stagger" style={{ animationDelay: '100ms' }} />
            <StatCard title="Donors" value={t.unique_donors || 0} className="animate-fade-in-stagger" style={{ animationDelay: '200ms' }} />
            <StatCard title="Avg. Donation" value={<Currency value={(t.total_amount || 0) / Math.max(1, t.total_count || 1)} />} className="animate-fade-in-stagger" style={{ animationDelay: '300ms' }} />
          </>
        )}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
        <div className="card p-3 sm:p-4 md:p-6 animate-fade-in-stagger" style={{ animationDelay: '400ms' }}>
          <div className="flex items-center justify-between mb-3 sm:mb-4 md:mb-6">
            <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 dark:text-white">Top Streamers</h3>
            <div className="p-2 gradient-avatar-purple rounded-lg">
              <span className="text-white text-sm sm:text-base md:text-lg">🎥</span>
            </div>
          </div>
          <div className="space-y-2 sm:space-y-3 md:space-y-4">
            {(data.topStreamers || []).map((s, idx) => (
              <div key={s.streamer_id} className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors animate-fade-in-stagger" style={{ animationDelay: `${400 + idx * 100}ms` }}>
                                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                    {s.profile_picture_url ? (
                                      <img 
                                        src={s.profile_picture_url} 
                                        alt="Profile" 
                                        className="w-6 h-6 sm:w-8 sm:h-8 rounded-full object-cover flex-shrink-0"
                                      />
                                    ) : (
                                      <div className="flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full gradient-avatar-purple text-white text-xs sm:text-sm font-bold flex-shrink-0">
                                        {idx + 1}
                                      </div>
                                    )}                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900 dark:text-white truncate text-sm sm:text-base">
                      {s.username || `Streamer #${s.streamer_id}`}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">ID: {s.streamer_id}</div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <div className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base"><Currency value={s.amount} /></div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">earned</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-3 sm:p-4 md:p-6 animate-fade-in-stagger" style={{ animationDelay: '500ms' }}>
          <div className="flex items-center justify-between mb-3 sm:mb-4 md:mb-6">
            <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 dark:text-white">Top Donors</h3>
            <div className="p-2 gradient-avatar-cyan rounded-lg">
              <span className="text-white text-sm sm:text-base md:text-lg">💎</span>
            </div>
          </div>
          <div className="space-y-2 sm:space-y-3 md:space-y-4">
            {(data.topDonors || []).map((d, idx) => (
              <div key={d.donor_id} className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors animate-fade-in-stagger" style={{ animationDelay: `${500 + idx * 100}ms` }}>
                                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                    {d.profile_picture_url ? (
                                      <img 
                                        src={d.profile_picture_url} 
                                        alt="Profile" 
                                        className="w-6 h-6 sm:w-8 sm:h-8 rounded-full object-cover flex-shrink-0"
                                      />
                                    ) : (
                                      <div className="flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full gradient-avatar-cyan text-white text-xs sm:text-sm font-bold flex-shrink-0">
                                        {idx + 1}
                                      </div>
                                    )}                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900 dark:text-white truncate text-sm sm:text-base">
                      {d.username || `Donor #${d.donor_id}`}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">ID: {d.donor_id}</div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <div className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base"><Currency value={d.amount} /></div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">donated</div>
                </div>
              </div>
            ))}
          </div>
        </div>
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
      console.log('[Streamers] Admin update received via socket:', data);
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


  if (loading) return (
    <div className="flex justify-center p-8">
      <LoadingSpinner size="md" text="Loading streamers..." />
    </div>
  );
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div className="card overflow-hidden">
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Streamers Overview</h3>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">Drag and drop to reorder, then save.</p>
        </div>
        <button onClick={handleSaveOrder} disabled={isSaving} className="btn btn-primary btn-sm">
          {isSaving ? 'Saving...' : 'Save Order'}
        </button>
      </div>
      
      <div className="hidden sm:block overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th className="w-12"></th>
              <th className="font-semibold text-gray-700 dark:text-gray-300">Streamer</th>
              <th className="font-semibold text-gray-700 dark:text-gray-300">Link UUID</th>
              <th className="font-semibold text-gray-700 dark:text-gray-300">Donations</th>
              <th className="font-semibold text-right text-gray-700 dark:text-gray-300">Total Earned</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, index) => (
              <tr
                key={s.telegram_id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnter={(e) => handleDragEnter(e, index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => e.preventDefault()}
                className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 animate-fade-in-stagger"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <td className="py-4 text-center text-gray-400 cursor-grab">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                </td>
                <td className="py-4">
                  <div className="flex items-center gap-3">
                    {s.profile_picture_url ? (
                      <img 
                        src={s.profile_picture_url} 
                        alt="Profile" 
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full gradient-avatar-purple flex items-center justify-center text-white font-semibold flex-shrink-0">
                        {(s.username || 'S').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {s.username || 'Unknown Streamer'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">ID: {s.telegram_id}</div>
                    </div>
                  </div>
                </td>
                <td className="py-4">
                  <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded text-xs font-mono">
                    {s.link_uuid}
                  </code>
                </td>
                <td className="py-4">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 dark:text-white">{s.donations_count}</span>
                    <span className="badge badge-gray">donations</span>
                  </div>
                </td>
                <td className="py-4 text-right">
                  <div className="font-semibold text-lg text-gray-900 dark:text-white">
                    <Currency value={s.total_earned} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
Streamers.propTypes = {
  apiClient: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),
  refreshKey: PropTypes.number.isRequired,
};

function Donors({ apiClient, refreshKey }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!apiClient) return;
    setLoading(true);
    apiClient.get(`/donors`).then((r) => setRows(r.data.donors || [])).catch((e) => setError(e?.message || 'Failed')).finally(() => setLoading(false));

    socket.on('admin_update', (data) => {
      console.log('[Donors] Admin update received via socket:', data);
      setRefresh((x) => x + 1); // Trigger a refresh of donors
    });

    return () => {
      socket.off('admin_update');
    };
  }, [apiClient, refresh, refreshKey]);

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
    <div className="card overflow-hidden animate-fade-in-stagger">
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Donors Management</h3>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">Manage donor information and display names</p>
      </div>
      
      {/* Mobile Card View */}
      <div className="block sm:hidden">
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {rows.map((d, index) => (
            <div key={d.telegram_id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors animate-fade-in-stagger" style={{ animationDelay: `${index * 50}ms` }}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full gradient-avatar-cyan flex items-center justify-center text-white font-semibold flex-shrink-0">
                  {(d.username || 'D').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white truncate">
                    {d.username || 'Unknown Donor'}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">ID: {d.telegram_id}</div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Display Name</label>
                      {editingId === d.telegram_id ? (
                        <div className="space-y-2">
                          <input 
                            type="text" 
                            value={displayName} 
                            onChange={(e) => setDisplayName(e.target.value)} 
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" 
                            placeholder="e.g. አበበ መኮንን" 
                          />
                          <div className="flex gap-2">
                            <button 
                              disabled={saving} 
                              onClick={() => save(d.telegram_id)} 
                              className="btn btn-success btn-sm flex-1"
                            >
                              {saving ? 'Saving...' : 'Save'}
                            </button>
                            <button 
                              disabled={saving} 
                              onClick={cancelEdit} 
                              className="btn btn-secondary btn-sm flex-1"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-gray-900 dark:text-white truncate">
                            {d.display_name || d.username || <span className="text-gray-400 dark:text-gray-500">Not set</span>}
                          </div>
                          <button 
                            onClick={() => startEdit(d)} 
                            className="btn btn-outline btn-xs ml-2"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 block">Donations</span>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="font-semibold text-gray-900 dark:text-white text-sm">{d.donations_count}</span>
                          <span className="badge badge-gray text-xs">donations</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 block">Total Donated</span>
                        <div className="font-semibold text-gray-900 dark:text-white text-sm mt-1">
                          <Currency value={d.total_donated} />
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <Balance 
                        value={d.balance} 
                        className="text-green-600 dark:text-green-400"
                        label="Balance"
                        showToggle={false}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th className="font-semibold text-gray-700 dark:text-gray-300">Donor</th>
              <th className="font-semibold text-gray-700 dark:text-gray-300">Display Name</th>
              <th className="font-semibold text-gray-700 dark:text-gray-300">Donations</th>
              <th className="font-semibold text-right text-gray-700 dark:text-gray-300">Total Donated</th>
              <th className="font-semibold text-right text-gray-700 dark:text-gray-300">Balance</th>
              <th className="font-semibold text-center text-gray-700 dark:text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d, index) => (
              <tr key={d.telegram_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors animate-fade-in-stagger" style={{ animationDelay: `${index * 50}ms` }}>
                <td className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full gradient-avatar-cyan flex items-center justify-center text-white font-semibold">
                      {(d.username || 'D').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {d.username || 'Unknown Donor'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">ID: {d.telegram_id}</div>
                    </div>
                  </div>
                </td>
                <td className="py-4">
                  {editingId === d.telegram_id ? (
                    <div className="flex items-center gap-2">
                      <input 
                        type="text" 
                        value={displayName} 
                        onChange={(e) => setDisplayName(e.target.value)} 
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" 
                        placeholder="e.g. አበበ መኮንን" 
                      />
                    </div>
                  ) : (
                    <div className="font-medium text-gray-900 dark:text-white">
                      {d.display_name || d.username || <span className="text-gray-400 dark:text-gray-500">Not set</span>}
                    </div>
                  )}
                </td>
                <td className="py-4">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 dark:text-white">{d.donations_count}</span>
                    <span className="badge badge-gray">donations</span>
                  </div>
                </td>
                <td className="py-4 text-right">
                  <div className="font-semibold text-gray-900 dark:text-white">
                    <Currency value={d.total_donated} />
                  </div>
                </td>
                <td className="py-4 text-right">
                  <Balance 
                    value={d.balance} 
                    className="text-lg text-green-600 dark:text-green-400"
                    showLabel={false}
                    showToggle={false}
                  />
                </td>
                <td className="py-4">
                  <div className="flex justify-center">
                    {editingId === d.telegram_id ? (
                      <div className="flex gap-2">
                        <button 
                          disabled={saving} 
                          onClick={() => save(d.telegram_id)} 
                          className="btn btn-success btn-sm"
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button 
                          disabled={saving} 
                          onClick={cancelEdit} 
                          className="btn btn-secondary btn-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => startEdit(d)} 
                        className="btn btn-outline btn-sm"
                      >
                        Edit Name
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

  useEffect(() => {
    if (!apiClient) return;
    setLoading(true);
    apiClient.get(`/donations?limit=200`).then(r => {
      setRows(r.data.donations || []);
    }).catch(e => setError(e?.message || 'Failed')).finally(()=>setLoading(false));
  }, [apiClient, refreshKey]);

  if (loading) return (
    <div className="flex justify-center p-8">
      <LoadingSpinner size="md" text="Loading donations..." />
    </div>
  );
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div className="card overflow-hidden animate-fade-in-stagger">
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Recent Donations</h3>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">View all donation transactions</p>
      </div>
      
      {/* Mobile Card View */}
      <div className="block sm:hidden">
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {rows.map((d, index) => (
            <div key={d.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors animate-fade-in-stagger" style={{ animationDelay: `${index * 50}ms` }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white truncate">
                    {d.donor?.username || 'Unknown Donor'}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    to {d.streamer?.username || 'Unknown Streamer'}
                  </div>
                </div>
                <span className={`badge ${
                  d.status === 'paid' 
                    ? 'badge-success' 
                    : d.status === 'pending'
                    ? 'badge-warning'
                    : 'badge-gray'
                }`}>
                  {d.status}
                </span>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Amount</span>
                  <div className="font-semibold text-gray-900 dark:text-white">
                    <Currency value={d.amount} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Date</span>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {new Date(d.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Time</span>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {new Date(d.created_at).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th className="font-semibold text-gray-700 dark:text-gray-300">When</th>
              <th className="font-semibold text-gray-700 dark:text-gray-300">Streamer</th>
              <th className="font-semibold text-gray-700 dark:text-gray-300">Donor</th>
              <th className="font-semibold text-gray-700 dark:text-gray-300">Amount</th>
              <th className="font-semibold text-gray-700 dark:text-gray-300">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d, index) => (
              <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors animate-fade-in-stagger" style={{ animationDelay: `${index * 50}ms` }}>
                <td className="py-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {new Date(d.created_at).toLocaleString()}
                  </div>
                </td>
                <td className="py-4">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {d.streamer?.username || '—'}
                  </div>
                </td>
                <td className="py-4">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {d.donor?.username || '—'}
                  </div>
                </td>
                <td className="py-4">
                  <div className="font-semibold text-gray-900 dark:text-white">
                    <Currency value={d.amount} />
                  </div>
                </td>
                <td className="py-4">
                  <span className={`badge ${
                    d.status === 'paid' 
                      ? 'badge-success' 
                      : d.status === 'pending'
                      ? 'badge-warning'
                      : 'badge-gray'
                  }`}>
                    {d.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
  const [modal, setModal] = useState({ open: false, id: null, amount: '' });
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [imageModal, setImageModal] = useState({ open: false, src: '' });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, action: null, id: null, title: '', message: '' });

  useEffect(() => {
    if (!apiClient) return;
    setLoading(true);
    apiClient.get(`/recharges`).then(r => setRows(r.data.recharges || [])).catch(e => setError(e?.message || 'Failed')).finally(()=>setLoading(false));

    socket.on('admin_update', (data) => {
      console.log('[Recharges] Admin update received via socket:', data);
      setRefresh(x => x + 1); // Trigger a refresh of recharges
    });

    return () => {
      socket.off('admin_update');
    };
  }, [apiClient, refresh]);

  const approve = (id, requestedAmount) => {
    setModal({ open: true, id, amount: requestedAmount ? String(requestedAmount) : '' });
  };

  const confirmApprove = async () => {
    if (!apiClient || !modal.id) return;
    const value = Number(modal.amount);
    if (!Number.isFinite(value) || value <= 0) {
      alert('Please enter a valid positive amount.');
      return;
    }
    try {
      setSaving(true);
      await apiClient.post(`/recharges/${modal.id}/approve?amount=${encodeURIComponent(value)}`);
      setModal({ open: false, id: null, amount: '' });
      setRefresh(x=>x+1);
    } finally {
      setSaving(false);
    }
  };

  const closeModal = () => setModal({ open: false, id: null, amount: '' });

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
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border bg-white dark:bg-gray-900 dark:border-gray-700 shadow-lg">
            <div className="p-4 border-b dark:border-gray-700">
              <div className="text-lg font-semibold">Approve Recharge</div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Enter the amount to credit to the donor&apos;s wallet.</div>
            </div>
            <div className="p-4 space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Amount (Br)</label>
              <input 
                type="number" 
                min="0" 
                step="0.01" 
                value={modal.amount} 
                onChange={(e)=>setModal(m=>({...m, amount: e.target.value }))} 
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" 
                placeholder="e.g. 100.00" 
              />
            </div>
            <div className="px-4 pb-4 flex items-center justify-end gap-2">
              <button onClick={closeModal} className="btn btn-secondary">Cancel</button>
               <button disabled={saving} onClick={confirmApprove} className="btn btn-success">{saving ? "Saving..." : "Approve"}</button>
            </div>
          </div>
        </div>
      )}
      <div className="card overflow-hidden animate-fade-in-stagger">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Recharge Requests</h3>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setStatusFilter('pending')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'pending' 
                  ? 'bg-primary-500 text-white' 
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}>Pending</button>
              <button onClick={() => setStatusFilter('approved')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'approved' 
                  ? 'bg-primary-500 text-white' 
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}>Approved</button>
              <button onClick={() => setStatusFilter('rejected')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'rejected' 
                  ? 'bg-primary-500 text-white' 
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}>Rejected</button>
            </div>
          </div>
        </div>
        
        {/* Mobile Card View */}
        <div className="block sm:hidden">
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredRows.map((r, index) => (
              <div key={r.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors animate-fade-in-stagger" style={{ animationDelay: `${index * 50}ms` }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white truncate">
                      {r.donor_username || 'Unknown Donor'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(r.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <span className={`badge ${
                    r.status === 'approved' 
                      ? 'badge-success' 
                      : r.status === 'rejected'
                      ? 'badge-error'
                      : 'badge-warning'
                  }`}>
                    {r.status}
                  </span>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    {r.screenshot_url ? (
                      <img 
                        src={r.screenshot_url} 
                        alt="screenshot" 
                        className="w-16 h-16 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
                        onClick={() => openImageModal(r.screenshot_url)} 
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                        <span className="text-gray-400 dark:text-gray-500 text-xs">No img</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-500 dark:text-gray-400">Name on Payment</div>
                      <div className="font-medium text-gray-900 dark:text-white truncate">
                        {r.name_on_payment}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Requested</span>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {r.requested_amount ? <Currency value={r.requested_amount} /> : <span className="text-gray-400">—</span>}
                    </div>
                  </div>
                  
                  {r.amount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Approved</span>
                      <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                        <Currency value={r.amount} />
                      </div>
                    </div>
                  )}
                  
                  {r.status === 'pending' && (
                    <div className="flex gap-2 pt-2">
                      <button onClick={()=>approve(r.id, r.requested_amount)} className="btn btn-success btn-sm flex-1">Approve</button>
                      <button onClick={()=>openConfirmModal('reject', r.id, 'Reject Recharge', `Are you sure you want to reject this recharge from ${r.donor_username || r.name_on_payment}?`)} className="btn btn-danger btn-sm flex-1">Reject</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="font-semibold text-gray-700 dark:text-gray-300">When</th>
                <th className="font-semibold text-gray-700 dark:text-gray-300">Donor</th>
                <th className="font-semibold text-gray-700 dark:text-gray-300">Name on Payment</th>
                <th className="font-semibold text-gray-700 dark:text-gray-300">Screenshot</th>
                <th className="font-semibold text-gray-700 dark:text-gray-300">Requested</th>
                <th className="font-semibold text-gray-700 dark:text-gray-300">Approved</th>
                <th className="font-semibold text-gray-700 dark:text-gray-300">Status</th>
                <th className="font-semibold text-center text-gray-700 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r, index) => (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors animate-fade-in-stagger" style={{ animationDelay: `${index * 50}ms` }}>
                  <td className="py-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(r.created_at).toLocaleString()}
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {r.donor_username || '—'}
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="text-gray-900 dark:text-white">
                      {r.name_on_payment}
                    </div>
                  </td>
                  <td className="py-4">
                    {r.screenshot_url ? (
                      <img 
                        src={r.screenshot_url} 
                        alt="screenshot" 
                        className="w-20 h-20 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => openImageModal(r.screenshot_url)} 
                      />
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500">—</span>
                    )}
                  </td>
                  <td className="py-4">
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {r.requested_amount ? <Currency value={r.requested_amount} /> : <span className="text-gray-400">—</span>}
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {r.amount > 0 ? <Currency value={r.amount} /> : <span className="text-gray-400">—</span>}
                    </div>
                  </td>
                  <td className="py-4">
                    <span className={`badge ${
                      r.status === 'approved' 
                        ? 'badge-success' 
                        : r.status === 'rejected'
                        ? 'badge-error'
                        : 'badge-warning'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="py-4">
                    <div className="flex justify-center">
                      {r.status==='pending' && (
                        <div className="flex gap-2">
                          <button onClick={()=>approve(r.id, r.requested_amount)} className="btn btn-success btn-sm">Approve</button>
                          <button onClick={()=>openConfirmModal('reject', r.id, 'Reject Recharge', `Are you sure you want to reject this recharge from ${r.donor_username || r.name_on_payment}?`)} className="btn btn-danger btn-sm">Reject</button>
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
      {imageModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={closeImageModal}>
          <img src={imageModal.src} className="max-h-full max-w-full" />
        </div>
      )}
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
    apiClient.get(`/withdrawals`).then(r => setRows(r.data.withdrawals || [])).catch(e => setError(e?.message || 'Failed')).finally(()=>setLoading(false));

    socket.on('admin_update', (data) => {
      console.log('[Withdrawals] Admin update received via socket:', data);
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
      <div className="card overflow-hidden animate-fade-in-stagger">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Withdrawal Requests</h3>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setStatusFilter('pending')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'pending' 
                  ? 'bg-primary-500 text-white' 
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}>Pending</button>
              <button onClick={() => setStatusFilter('approved')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'approved' 
                  ? 'bg-primary-500 text-white' 
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}>Approved</button>
              <button onClick={() => setStatusFilter('rejected')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'rejected' 
                  ? 'bg-primary-500 text-white' 
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}>Rejected</button>
            </div>
          </div>
        </div>
        
        {/* Mobile Card View */}
        <div className="block sm:hidden">
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredRows.map((w, index) => (
              <div key={w.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors animate-fade-in-stagger" style={{ animationDelay: `${index * 50}ms` }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white truncate">
                      {w.streamer_username || 'Unknown Streamer'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(w.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <span className={`badge ${
                    w.status === 'approved' 
                      ? 'badge-success' 
                      : w.status === 'rejected'
                      ? 'badge-error'
                      : 'badge-warning'
                  }`}>
                    {w.status}
                  </span>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Telebirr Username</div>
                    <div className="font-medium text-gray-900 dark:text-white truncate">
                      {w.telebirr_username}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Phone Number</div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {w.phone_number}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Amount</div>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        <Currency value={w.amount} />
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Payout (60%)</div>
                      <div className="font-semibold text-green-600 dark:text-green-400">
                        <Currency value={w.amount * 0.6} />
                      </div>
                    </div>
                  </div>
                  
                  {w.status === 'pending' && (
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => openConfirmModal('approve', w.id, 'Approve Withdrawal', `Are you sure you want to approve this withdrawal request from ${w.streamer_username}?`)} className="btn btn-success btn-sm flex-1">Approve</button>
                      <button onClick={() => openConfirmModal('reject', w.id, 'Reject Withdrawal', `Are you sure you want to reject this withdrawal request from ${w.streamer_username}?`)} className="btn btn-danger btn-sm flex-1">Reject</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="font-semibold text-gray-700 dark:text-gray-300">When</th>
                <th className="font-semibold text-gray-700 dark:text-gray-300">Streamer</th>
                <th className="font-semibold text-gray-700 dark:text-gray-300">Telebirr Username</th>
                <th className="font-semibold text-gray-700 dark:text-gray-300">Phone Number</th>
                <th className="font-semibold text-gray-700 dark:text-gray-300">Amount</th>
                <th className="font-semibold text-gray-700 dark:text-gray-300">Payout (60%)</th>
                <th className="font-semibold text-gray-700 dark:text-gray-300">Status</th>
                <th className="font-semibold text-center text-gray-700 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((w, index) => (
                <tr key={w.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors animate-fade-in-stagger" style={{ animationDelay: `${index * 50}ms` }}>
                  <td className="py-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(w.created_at).toLocaleString()}
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {w.streamer_username || '—'}
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="text-gray-900 dark:text-white">
                      {w.telebirr_username}
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="text-gray-900 dark:text-white">
                      {w.phone_number}
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="font-semibold text-gray-900 dark:text-white">
                      <Currency value={w.amount} />
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="font-semibold text-green-600 dark:text-green-400">
                      <Currency value={w.amount * 0.6} />
                    </div>
                  </td>
                  <td className="py-4">
                    <span className={`badge ${
                      w.status === 'approved' 
                        ? 'badge-success' 
                        : w.status === 'rejected'
                        ? 'badge-error'
                        : 'badge-warning'
                    }`}>
                      {w.status}
                    </span>
                  </td>
                  <td className="py-4">
                    <div className="flex justify-center">
                      {w.status==='pending' && (
                        <div className="flex gap-2">
                          <button onClick={() => openConfirmModal('approve', w.id, 'Approve Withdrawal', `Are you sure you want to approve this withdrawal request from ${w.streamer_username}?`)} className="btn btn-success btn-sm">Approve</button>
                          <button onClick={() => openConfirmModal('reject', w.id, 'Reject Withdrawal', `Are you sure you want to reject this withdrawal request from ${w.streamer_username}?`)} className="btn btn-danger btn-sm">Reject</button>
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
      console.log('[StreamerRequests] Admin update received via socket:', data);
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
      <div className="card overflow-hidden animate-fade-in-stagger">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Streamer Requests</h3>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setStatusFilter('pending')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'pending' 
                  ? 'bg-primary-500 text-white' 
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}>Pending</button>
              <button onClick={() => setStatusFilter('approved')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'approved' 
                  ? 'bg-primary-500 text-white' 
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}>Approved</button>
              <button onClick={() => setStatusFilter('rejected')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'rejected' 
                  ? 'bg-primary-500 text-white' 
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}>Rejected</button>
            </div>
          </div>
        </div>
        
        {/* Mobile Card View */}
        <div className="block sm:hidden">
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredRows.map((r, index) => (
              <div key={r.telegram_id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors animate-fade-in-stagger" style={{ animationDelay: `${index * 50}ms` }}>
                <div className="flex items-start gap-3 mb-3">
                  {r.profile_picture_url ? (
                    <img 
                      src={r.profile_picture_url} 
                      alt="Profile" 
                      className="w-12 h-12 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
                      onClick={() => openImageModal(r.profile_picture_url)} 
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                      <span className="text-gray-400 dark:text-gray-500">—</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white truncate">
                      {r.full_name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      @{r.username} • {new Date(r.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <span className={`badge ${
                    r.registration_status === 'approved' 
                      ? 'badge-success' 
                      : r.registration_status === 'rejected'
                      ? 'badge-error'
                      : 'badge-warning'
                  }`}>
                    {r.registration_status}
                  </span>
                </div>
                
                <div className="space-y-3">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Phone Number</div>
                    <div className="font-medium text-gray-900 dark:text-white truncate">
                      {r.phone_number}
                    </div>
                  
                  {r.registration_status === 'pending' && (
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => openConfirmModal('approve', r.telegram_id, 'Approve Streamer', `Are you sure you want to approve ${r.full_name || r.username}?`)} className="btn btn-success btn-sm flex-1">Approve</button>
                      <button onClick={() => openConfirmModal('reject', r.telegram_id, 'Reject Streamer', `Are you sure you want to reject ${r.full_name || r.username}?`)} className="btn btn-danger btn-sm flex-1">Reject</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="font-semibold text-gray-700 dark:text-gray-300">Submitted</th>
                <th className="font-semibold text-gray-700 dark:text-gray-300">Picture</th>
                <th className="font-semibold text-gray-700 dark:text-gray-300">Full Name</th>
                <th className="font-semibold text-gray-700 dark:text-gray-300">Username</th>
                <th className="font-semibold text-gray-700 dark:text-gray-300">Phone Number</th>
                <th className="font-semibold text-gray-700 dark:text-gray-300">Status</th>
                <th className="font-semibold text-center text-gray-700 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r, index) => (
                <tr key={r.telegram_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors animate-fade-in-stagger" style={{ animationDelay: `${index * 50}ms` }}>
                  <td className="py-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(r.created_at).toLocaleString()}
                    </div>
                  </td>
                  <td className="py-4">
                    {r.profile_picture_url ? (
                      <img 
                        src={r.profile_picture_url} 
                        alt="Profile" 
                        className="w-12 h-12 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => openImageModal(r.profile_picture_url)} 
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      </div>
                    )}
                  </td>
                  <td className="py-4">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {r.full_name}
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="text-gray-900 dark:text-white">
                      @{r.username}
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="text-gray-900 dark:text-white">
                      {r.phone_number}
                    </div>
                  </td>
                  <td className="py-4">
                    <a href={r.social_link} target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:text-primary-600 transition-colors">
                      View Profile
                    </a>
                  </td>
                  <td className="py-4">
                    <span className={`badge ${
                      r.registration_status === 'approved' 
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
      {imageModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={closeImageModal}>
          <img src={imageModal.src} className="max-h-full max-w-full" />
        </div>
      )}
    </>
  );
}
StreamerRequests.propTypes = {
  apiClient: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),
};

// --- Main Component ---
export default function AdminDashboard() {
  const [tab, setTab] = useState('overview');
  const [pendingCounts, setPendingCounts] = useState({ recharges: 0, withdrawals: 0, streamerRequests: 0, complaints: 0 });
  const [toasts, setToasts] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [adminToken, setAdminToken] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    // Check for theme in localStorage
    const saved = localStorage.getItem('theme');
    return saved === 'dark';
  });
  const toastTimersRef = useRef([]);

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

  // Apply theme on load and when darkMode changes
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const toggleDarkMode = (isDark) => {
    setDarkMode(isDark);
    const nextTheme = isDark ? 'dark' : 'light';
    localStorage.setItem('theme', nextTheme);
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
    let icon = 'ℹ️';

    switch (event.type) {
      case 'donation_paid': {
        icon = '💰';
        title = 'Donation Paid';
        const donor = payload.donorName || 'New donor';
        description = `${donor} sent ${formatAmount(payload.amount)}.`;
        break;
      }
      case 'withdrawal_created': {
        icon = '💸';
        title = 'New Withdrawal Request';
        description = `${formatAmount(payload.amount)} awaiting approval.`;
        break;
      }
      case 'withdrawal_updated': {
        icon = '💸';
        title = `Withdrawal ${capitalize(payload.status)}`;
        description = `${formatAmount(payload.amount)} for streamer #${payload.streamerId || '—'}.`;
        break;
      }
      case 'recharge_created': {
        icon = '🔄';
        title = 'Recharge Submitted';
        description = `Donor #${payload.donorId || '—'} uploaded proof.`;
        break;
      }
      case 'recharge_updated': {
        icon = '🔄';
        title = `Recharge ${capitalize(payload.status)}`;
        description = `Donation balance updated for donor #${payload.donorId || '—'}.`;
        break;
      }
      case 'streamer_request_created': {
        icon = '👥';
        title = 'Streamer Request Received';
        description = `${payload.fullName || 'New applicant'} is waiting for review.`;
        break;
      }
      case 'streamer_request_updated': {
        icon = '👥';
        title = `Streamer Request ${capitalize(payload.status)}`;
        description = `Telegram ID ${payload.telegramId || '—'} ${payload.status || 'updated'}.`;
        break;
      }
      case 'complaint_created': {
        icon = '📝';
        title = 'New Complaint';
        description = 'Check the complaints tab for the latest submission.';
        break;
      }
      case 'complaint_updated': {
        icon = '📝';
        title = 'Complaint Responded';
        description = 'Marked as responded successfully.';
        break;
      }
      default: {
        icon = 'ℹ️';
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
  }, [removeToast]);

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

  const fetchCounts = useCallback(async () => {
    if (!apiClient) return;
    try {
      const rechargesRes = await apiClient.get(`/recharges`);
      const withdrawalsRes = await apiClient.get(`/withdrawals`);
      const streamerRequestsRes = await apiClient.get(`/streamer-requests`);
      const complaintsRes = await apiClient.get(`/complaints/pending-count`);
      const pendingRecharges = rechargesRes.data.recharges.filter(r => r.status === 'pending').length;
      const pendingWithdrawals = withdrawalsRes.data.withdrawals.filter(w => w.status === 'pending').length;
      const pendingStreamerRequests = streamerRequestsRes.data.requests.filter(r => r.registration_status === 'pending').length;
      setPendingCounts({ recharges: pendingRecharges, withdrawals: pendingWithdrawals, streamerRequests: pendingStreamerRequests, complaints: complaintsRes.data.count });
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
      console.log('Admin socket connected');
      socket.emit('join_admin_room');
    });
    socket.on('disconnect', () => console.log('Admin socket disconnected'));
    socket.on('new_donation', (data) => {
      console.log('[AdminDashboard] New donation received via socket:', data);
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
      console.log('[AdminDashboard] Admin update received via socket:', data);
      fetchCounts();
      addToast(data);
    };

    socket.on('admin_update', handleAdminUpdate);
    return () => {
      socket.off('admin_update', handleAdminUpdate);
    };
  }, [apiClient, fetchCounts, addToast]);

  if (!apiClient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <ApiKeyModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onSubmit={handleTokenSubmit}
          title="Admin Authentication Required"
          message="Please enter the Admin Token to access this dashboard. The token can be found in your project's .env file."
        />
        <div className="text-center"><p>Waiting for Admin Token...</p></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-light dark:gradient-dark">
      <ApiKeyModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSubmit={handleTokenSubmit}
        title="Admin Authentication Required"
        message="Please enter Admin Token to access this dashboard. The token can be found in your project's .env file."
      />
      <div className="w-full px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6 lg:px-8 lg:py-8 xl:px-12 xl:py-10 2xl:px-16 2xl:py-12">
        {/* Header */}
        <div className="mb-4 sm:mb-6 md:mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 relative">
            {/* Theme Toggle - Inside Card at Right Top Corner */}
            <div className="absolute top-3 right-3 z-10">
              <ThemeToggle isDarkMode={darkMode} toggleDarkMode={toggleDarkMode} />
            </div>
            
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2 truncate">
                🎛️ Admin Panel
              </h1>
              <p className="text-xs sm:text-sm md:text-base lg:text-lg text-gray-600 dark:text-gray-300">
                Manage streamers, donors, and donations
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-4 sm:mb-6 md:mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-1 animate-fade-in">
            <div className="flex flex-wrap justify-between items-center gap-1 sm:gap-2">
              {['overview','streamer-requests','streamers','donors','donations','withdrawals','recharges', 'complaints', 'settings'].map((k, index) => (
                <button 
                  key={k} 
                  onClick={()=>setTab(k)} 
                  className={`flex-shrink-0 px-2 sm:px-3 md:px-4 py-2 rounded-lg font-medium transition-all duration-200 text-xs sm:text-sm md:text-base whitespace-nowrap relative animate-fade-in-stagger ${
                    tab===k 
                      ? 'bg-primary-500 text-white shadow-lg transform scale-105 ring-2 ring-primary-300 ring-offset-2 ring-offset-white dark:ring-offset-gray-900' 
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 hover:shadow-md'
                  }`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-lg sm:text-xl">
                      {k === 'overview' && '📊'}
                      {k === 'streamer-requests' && '👥'}
                      {k === 'streamers' && '🎥'}
                      {k === 'donors' && '💎'}
                      {k === 'donations' && '💰'}
                      {k === 'withdrawals' && '💸'}
                      {k === 'recharges' && '🔄'}
                      {k === 'complaints' && '📝'}
                      {k === 'settings' && '⚙️'}
                    </span>
                    <span className="hidden sm:block text-xs sm:text-sm font-medium">
                      {k.replace('-', ' ')[0].toUpperCase() + k.replace('-', ' ').slice(1)}
                    </span>
                    {k === 'streamer-requests' && pendingCounts.streamerRequests > 0 && (
                      <span className="ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold text-white bg-red-600 rounded-full h-5 min-w-[20px] animate-pulse shadow-md">
                        {pendingCounts.streamerRequests}
                      </span>
                    )}
                    {k === 'recharges' && pendingCounts.recharges > 0 && (
                      <span className="ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold text-white bg-red-600 rounded-full h-5 min-w-[20px] animate-pulse shadow-md">
                        {pendingCounts.recharges}
                      </span>
                    )}
                    {k === 'withdrawals' && pendingCounts.withdrawals > 0 && (
                      <span className="ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold text-white bg-red-600 rounded-full h-5 min-w-[20px] animate-pulse shadow-md">
                        {pendingCounts.withdrawals}
                      </span>
                    )}
                    {k === 'complaints' && pendingCounts.complaints > 0 && (
                      <span className="ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold text-white bg-red-600 rounded-full h-5 min-w-[20px] animate-pulse shadow-md">
                        {pendingCounts.complaints}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="animate-fade-in space-y-4 sm:space-y-6">
          {tab==='overview' && <Overview apiClient={apiClient} refreshKey={refreshKey} />}
          {tab==='streamer-requests' && <StreamerRequests apiClient={apiClient} />}
          {tab==='streamers' && <Streamers apiClient={apiClient} refreshKey={refreshKey} />}
          {tab==='donors' && <Donors apiClient={apiClient} refreshKey={refreshKey} />}
          {tab==='donations' && <Donations apiClient={apiClient} refreshKey={refreshKey} />}
          {tab==='withdrawals' && <Withdrawals apiClient={apiClient} />}
          {tab==='recharges' && <Recharges apiClient={apiClient} />}
          {tab==='complaints' && <AdminComplaints apiClient={apiClient} refreshData={refreshData} />}
          {tab==='settings' && <Settings apiClient={apiClient} />}
        </div>
      </div>

      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 max-w-xs sm:max-w-sm">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 rounded-xl p-4 w-72 sm:w-80 animate-fade-in"
              style={{ boxShadow: '0 12px 25px -12px rgba(15, 23, 42, 0.35)' }}
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl leading-none">
                  {toast.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {toast.title}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 leading-snug">
                    {toast.description}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mt-3">
                    {toast.timestamp ? 'Updated just now' : 'Live update'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  aria-label="Dismiss notification"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
