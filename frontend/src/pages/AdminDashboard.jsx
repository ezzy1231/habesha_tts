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
import DonorFlagsPanel from '../components/DonorFlagsPanel';
import ImageViewer from '../components/ImageViewer';
import { BAN_DURATION_OPTIONS, resolveBanDurationMinutes } from '../constants/banOptions';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const API = import.meta.env.VITE_BASE_URL || 'http://localhost:5000';
const socket = io(API, { transports: ['websocket'] });

function Currency({ value }) {
  return <span className="text-gray-900 dark:text-white">Br {Number(value || 0).toFixed(2)}</span>;
}
Currency.propTypes = { value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]) };

function StatCard({ title, value, subtitle, icon, iconClassName, chartData, chartColor }) {
  return (
    <div className="group bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl p-6 shadow-sm border border-gray-200/60 dark:border-gray-700/60 hover:shadow-xl hover:shadow-gray-200/40 dark:hover:shadow-gray-900/40 hover:border-gray-300/60 dark:hover:border-gray-600/60 transition-all duration-300 relative overflow-hidden">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent dark:from-gray-700/20 dark:to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className={`p-3 rounded-2xl bg-opacity-10 dark:bg-opacity-20 ring-1 ring-inset ring-black/5 dark:ring-white/10 ${iconClassName || 'bg-primary-500 text-primary-500'}`}>
          <span className="text-xl">{icon || '📊'}</span>
        </div>
        {chartData && chartData.length > 0 && (
           <div className="h-12 w-24 min-w-[6rem] opacity-60 group-hover:opacity-100 transition-opacity">
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={chartData}>
                 <defs>
                    <linearGradient id={`color-${title.replace(/\s+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColor || "#8884d8"} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={chartColor || "#8884d8"} stopOpacity={0}/>
                    </linearGradient>
                 </defs>
                 <Area type="monotone" dataKey="amount" stroke={chartColor || "#8884d8"} fillOpacity={1} fill={`url(#color-${title.replace(/\s+/g, '')})`} strokeWidth={2} />
               </AreaChart>
             </ResponsiveContainer>
           </div>
        )}
      </div>
      <div className="relative z-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{title}</p>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{value}</h3>
        {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-medium">{subtitle}</p>}
      </div>
    </div>
  );
}
StatCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.node.isRequired,
  subtitle: PropTypes.string,
  icon: PropTypes.node,
  iconClassName: PropTypes.string,
  chartData: PropTypes.array,
  chartColor: PropTypes.string,
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

  if (loading) return (
    <div className="flex justify-center p-8">
      <LoadingSpinner size="md" text="Loading overview..." />
    </div>
  );
  if (error) return <div className="text-red-600">{error}</div>;

  const t = data.totals || {};
  const chartData = data.chartData || [];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Revenue" 
          value={<Currency value={t.total_amount} />} 
          subtitle={`${t.total_count || 0} donations`} 
          icon="💰" 
          iconClassName="bg-green-500 text-green-500"
          chartData={chartData}
          chartColor="#22c55e"
        />
        <StatCard 
          title="Active Streamers" 
          value={t.unique_streamers || 0} 
          subtitle="Unique creators" 
          icon="🎥" 
          iconClassName="bg-purple-500 text-purple-500"
          chartData={chartData.map(d => ({ ...d, amount: Math.random() * 10 }))} // Mock data for now as backend only sends revenue chart
          chartColor="#a855f7"
        />
        <StatCard 
          title="Active Donors" 
          value={t.unique_donors || 0} 
          subtitle="Unique supporters" 
          icon="💎" 
          iconClassName="bg-blue-500 text-blue-500"
          chartData={chartData.map(d => ({ ...d, amount: Math.random() * 20 }))} // Mock data
          chartColor="#3b82f6"
        />
        <StatCard 
          title="Avg. Donation" 
          value={<Currency value={(t.total_amount || 0) / Math.max(1, t.total_count || 1)} />} 
          subtitle="Per transaction" 
          icon="📊" 
          iconClassName="bg-orange-500 text-orange-500"
          chartData={chartData.map(d => ({ ...d, amount: (d.amount / Math.max(1, Math.random() * 10)) }))} // Mock data
          chartColor="#f97316"
        />
      </div>

      {/* Revenue Trends Chart */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl p-6 shadow-sm border border-gray-200/60 dark:border-gray-700/60">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Revenue Trends</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Platform earnings over time</p>
          </div>
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50 px-3 py-1.5 rounded-lg">Last 30 Days</span>
        </div>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#6B7280', fontSize: 12 }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#6B7280', fontSize: 12 }} 
                tickFormatter={(value) => `Br ${value}`}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', borderRadius: '0.75rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                itemStyle={{ color: '#111827', fontWeight: 600 }}
                formatter={(value) => [`Br ${Number(value).toFixed(2)}`, 'Revenue']}
              />
              <Area 
                type="monotone" 
                dataKey="amount" 
                stroke="#22c55e" 
                strokeWidth={3} 
                fillOpacity={1} 
                fill="url(#colorRevenue)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Lists */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Top Streamers */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl p-6 shadow-sm border border-gray-200/60 dark:border-gray-700/60">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Top Streamers</h3>
            <span className="text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-3 py-1.5 rounded-lg text-xs font-semiboldg text-xs font-semibold">By Revenue</span>
          </div>
          <div className="space-y-4">
            {(data.topStreamers || []).map((s, idx) => (
              <div key={s.streamer_id} className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {s.profile_picture_url ? (
                      <img src={s.profile_picture_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 font-bold">
                        {s.username?.[0]?.toUpperCase() || '#'}
                      </div>
                    )}
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center text-xs font-bold shadow-sm border border-gray-100 dark:border-gray-700">
                      {idx + 1}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white group-hover:text-purple-500 transition-colors">
                      {s.username || `Streamer #${s.streamer_id}`}
                    </div>
                    <div className="text-xs text-gray-500">ID: {s.streamer_id}</div>
                  </div>
                </div>
                <div className="font-bold text-gray-900 dark:text-white">
                  <Currency value={s.amount} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Donors */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl p-6 shadow-sm border border-gray-200/60 dark:border-gray-700/60">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Top Donors</h3>
            <span className="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg text-xs font-semiboldtext-xs font-semibold">By Contribution</span>
          </div>
          <div className="space-y-4">
            {(data.topDonors || []).map((d, idx) => (
              <div key={d.donor_id} className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {d.profile_picture_url ? (
                      <img src={d.profile_picture_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 font-bold">
                        {d.username?.[0]?.toUpperCase() || '#'}
                      </div>
                    )}
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center text-xs font-bold shadow-sm border border-gray-100 dark:border-gray-700">
                      {idx + 1}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white group-hover:text-blue-500 transition-colors">
                      {d.username || `Donor #${d.donor_id}`}
                    </div>
                    <div className="text-xs text-gray-500">ID: {d.donor_id}</div>
                  </div>
                </div>
                <div className="font-bold text-gray-900 dark:text-white">
                  <Currency value={d.amount} />
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

    socket.on('admin_update', (data) => {// console.log('[Streamers] Admin update received via socket:', data);
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
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100/80 dark:border-gray-700/50 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Streamers Management</h3>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Drag and drop to reorder streamers on the public page.</p>
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
        <div className="block sm:hidden divide-y divide-gray-100 dark:divide-gray-700">
          {rows.map((s, index) => (
            <div
              key={s.telegram_id}
              className="p-4 flex flex-col gap-3"
            >
              <div className="flex items-center gap-3">
                {s.profile_picture_url ? (
                  <img src={s.profile_picture_url} alt="Profile" className="w-10 h-10 rounded-full object-cover ring-2 ring-white dark:ring-gray-800" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold ring-2 ring-white dark:ring-gray-800">
                    {(s.username || 'S').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 dark:text-white truncate">
                    {s.username || 'Unknown Streamer'}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">ID: {s.telegram_id}</div>
                </div>
                <button
                  type="button"
                  onClick={() => openDeleteModal(s)}
                  className="text-red-500 hover:text-red-700 text-sm font-medium px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg">
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Link UUID</span>
                  <code className="text-xs font-mono text-gray-700 dark:text-gray-300 mt-1 block truncate">
                    {s.link_uuid}
                  </code>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Total Earned</span>
                  <div className="font-bold text-gray-900 dark:text-white mt-1">
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
              <tr className="bg-gray-50/50 dark:bg-gray-700/20 border-b border-gray-100 dark:border-gray-700">
                <th className="py-3 px-6 w-12"></th>
                <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Streamer</th>
                <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Link UUID</th>
                <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">Donations</th>
                <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Total Earned</th>
                <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {rows.map((s, index) => (
                <tr
                  key={s.telegram_id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragEnter={(e) => handleDragEnter(e, index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  className="group hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                >
                  <td className="py-4 px-6 text-center text-gray-300 dark:text-gray-600 cursor-grab active:cursor-grabbing group-hover:text-gray-400 dark:group-hover:text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mx-auto" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      {s.profile_picture_url ? (
                        <img
                          src={s.profile_picture_url}
                          alt="Profile"
                          className="w-9 h-9 rounded-full object-cover ring-2 ring-white dark:ring-gray-800"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold text-sm ring-2 ring-white dark:ring-gray-800">
                          {(s.username || 'S').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white text-sm">
                          {s.username || 'Unknown Streamer'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">ID: {s.telegram_id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded text-xs font-mono border border-gray-200 dark:border-gray-700">
                      {s.link_uuid}
                    </code>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                      {s.donations_count}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="font-bold text-gray-900 dark:text-white text-sm">
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
                      className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
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

    socket.on('admin_update', (data) => {// console.log('[Donors] Admin update received via socket:', data);
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
    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 overflow-hidden animate-fade-in-stagger">
      <div className="px-6 py-5 border-b border-gray-100/80 dark:border-gray-700/50">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Donors Management</h3>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Manage donor information and display names</p>
      </div>

      {/* Mobile Card View */}
      <div className="block sm:hidden divide-y divide-gray-100 dark:divide-gray-700">
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
                    <div className="font-semibold text-gray-900 dark:text-white truncate">
                      {d.username || 'Unknown Donor'}
                    </div>
                    {isBanned ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">BANNED</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">ACTIVE</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">ID: {d.telegram_id}</div>

                  <div className="space-y-3">
                    <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg">
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1 uppercase tracking-wider">Display Name</label>
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
                              className="flex-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded transition-colors"
                            >
                              Save
                            </button>
                            <button
                              disabled={saving}
                              onClick={cancelEdit}
                              className="flex-1 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs font-medium rounded transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-gray-900 dark:text-white truncate">
                            {d.display_name || d.username || <span className="text-gray-400 dark:text-gray-500 italic">Not set</span>}
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
                      <div className="bg-gray-50 dark:bg-gray-700/30 p-2 rounded-lg">
                        <span className="text-xs text-gray-500 dark:text-gray-400 block">Donations</span>
                        <div className="font-semibold text-gray-900 dark:text-white text-sm mt-0.5">{d.donations_count}</div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/30 p-2 rounded-lg text-right">
                        <span className="text-xs text-gray-500 dark:text-gray-400 block">Total Donated</span>
                        <div className="font-semibold text-gray-900 dark:text-white text-sm mt-0.5">
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
            <tr className="bg-gray-50/50 dark:bg-gray-700/20 border-b border-gray-100 dark:border-gray-700">
              <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Donor</th>
              <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Display Name</th>
              <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">Donations</th>
              <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Total Donated</th>
              <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Balance</th>
              <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">Status</th>
              <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {rows.map((d, index) => {
              const isBanned = Boolean(d.is_banned);
              return (
                <tr
                  key={d.telegram_id}
                  className={`transition-colors ${isBanned ? 'bg-rose-50/30 dark:bg-rose-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'}`}
                >
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm ${isBanned ? 'bg-rose-400' : 'bg-cyan-500'}`}>
                        {(d.username || 'D').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white text-sm">
                          {d.username || 'Unknown Donor'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">ID: {d.telegram_id}</div>
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
                          className="w-64 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm"
                          placeholder="Name"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <div className="font-medium text-gray-900 dark:text-white text-sm">
                        {d.display_name || d.username || <span className="text-gray-400 dark:text-gray-500 italic">Not set</span>}
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                      {d.donations_count}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="font-bold text-gray-900 dark:text-white text-sm">
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
                          <p className="mt-1 text-gray-400">Expires: {formatBanExpiry(d.ban_expires_at)}</p>
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
                            className="text-gray-400 hover:text-gray-600 p-1"
                            title="Cancel"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startEdit(d)}
                          className="text-gray-400 hover:text-primary-600 transition-colors p-1"
                          title="Edit Name"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                      )}
                      
                      <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1"></div>

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
                          className="text-gray-400 hover:text-rose-600 transition-colors p-1"
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
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Page <span className="font-medium text-gray-900 dark:text-white">{page}</span> of <span className="font-medium text-gray-900 dark:text-white">{totalPages}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {banModal.open && banModal.donor && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 transition-all">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl p-6 space-y-4 animate-scale-in transform transition-all scale-100">
            <div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Ban Donor</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {banModal.donor.display_name || banModal.donor.username || `ID ${banModal.donor.telegram_id}`}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Reason</label>
              <textarea
                className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-rose-400"
                rows={3}
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="e.g. Offensive language in repeated donations"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Duration</label>
              <select
                className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-rose-400"
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
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-rose-400"
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
    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 overflow-hidden animate-fade-in-stagger">
      <div className="px-6 py-5 border-b border-gray-100/80 dark:border-gray-700/50">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Recent Donations</h3>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">View all donation transactions</p>
      </div>

      {/* Mobile Card View */}
      <div className="block sm:hidden divide-y divide-gray-100 dark:divide-gray-700">
        {rows.map((d, index) => (
          <div key={d.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 dark:text-white truncate">
                  {d.donor?.username || 'Unknown Donor'}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <span>to</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">{d.streamer?.username || 'Unknown Streamer'}</span>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${d.status === 'paid'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : d.status === 'pending'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                {d.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg">
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Amount</span>
                <div className="font-bold text-gray-900 dark:text-white mt-0.5">
                  <Currency value={d.amount} />
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Date</span>
                <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-0.5">
                  {new Date(d.created_at).toLocaleDateString()}
                </div>
                <div className="text-[10px] text-gray-400">
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
            <tr className="bg-gray-50/50 dark:bg-gray-700/20 border-b border-gray-100 dark:border-gray-700">
              <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">When</th>
              <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Streamer</th>
              <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Donor</th>
              <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Amount</th>
              <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {rows.map((d, index) => (
              <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <td className="py-4 px-6">
                  <div className="text-sm text-gray-900 dark:text-white font-medium">
                    {new Date(d.created_at).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(d.created_at).toLocaleTimeString()}
                  </div>
                </td>
                <td className="py-4 px-6">
                  <div className="font-medium text-gray-900 dark:text-white text-sm">
                    {d.streamer?.username || '—'}
                  </div>
                </td>
                <td className="py-4 px-6">
                  <div className="font-medium text-gray-900 dark:text-white text-sm">
                    {d.donor?.username || '—'}
                  </div>
                </td>
                <td className="py-4 px-6 text-right">
                  <div className="font-bold text-gray-900 dark:text-white text-sm">
                    <Currency value={d.amount} />
                  </div>
                </td>
                <td className="py-4 px-6 text-center">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${d.status === 'paid'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : d.status === 'pending'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
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
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Page <span className="font-medium text-gray-900 dark:text-white">{page}</span> of <span className="font-medium text-gray-900 dark:text-white">{totalPages}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

    socket.on('admin_update', (data) => {// console.log('[Recharges] Admin update received via socket:', data);
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
            className="relative w-full max-w-xl md:max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={closeModal}
              className="absolute top-3 right-3 z-10 p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="p-5 pb-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white pr-8">Review Recharge</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Request from <span className="font-medium text-gray-900 dark:text-white">{modal.recharge.donor_username || 'Unknown'}</span>
              </p>
            </div>
            
            {/* Content - Scrollable */}
            <div className="p-5 space-y-5 max-h-[calc(100vh-16rem)] overflow-y-auto">
              {/* Name on Payment */}
              <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <span className="text-sm text-gray-500 dark:text-gray-400">Name on Payment</span>
                <span className="font-semibold text-gray-900 dark:text-white">{modal.recharge.name_on_payment}</span>
              </div>
              
              {/* Screenshot */}
              {modal.recharge.screenshot_url && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Payment Screenshot</span>
                  <div 
                    className="relative group rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 cursor-pointer"
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
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Approved Amount (Br)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={modal.amount}
                  onChange={(e) => setModal(m => ({ ...m, amount: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xl font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow"
                  placeholder="0.00"
                />
                {modal.recharge.requested_amount && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-right">
                    Requested: <span className="font-semibold text-primary-600 dark:text-primary-400">{modal.recharge.requested_amount} Br</span>
                  </p>
                )}
              </div>
            </div>

            {/* Actions - Fixed at bottom */}
            <div className="p-5 pt-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 space-y-3">
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
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 overflow-hidden animate-fade-in-stagger">
        <div className="px-6 py-5 border-b border-gray-100/80 dark:border-gray-700/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Recharge Requests</h3>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Manage donor wallet top-ups</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setStatusFilter('pending')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'pending'
                ? 'bg-primary-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}>Pending</button>
              <button onClick={() => setStatusFilter('approved')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'approved'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}>Approved</button>
              <button onClick={() => setStatusFilter('rejected')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'rejected'
                ? 'bg-rose-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}>Rejected</button>
            </div>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="block sm:hidden divide-y divide-gray-100 dark:divide-gray-700">
          {filteredRows.map((r, index) => (
            <div key={r.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white truncate">
                    {r.donor_username || 'Unknown Donor'}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
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
                <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg">
                  {r.screenshot_url ? (
                    <img
                      src={r.screenshot_url}
                      alt="screenshot"
                      className="w-12 h-12 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0 border border-gray-200 dark:border-gray-600"
                      onClick={() => openImageModal(r.screenshot_url)}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-gray-400 dark:text-gray-500 text-[10px]">No img</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name on Payment</div>
                    <div className="font-medium text-gray-900 dark:text-white truncate text-sm">
                      {r.name_on_payment}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Requested</span>
                    <div className="font-bold text-gray-900 dark:text-white mt-0.5">
                      {r.requested_amount ? <Currency value={r.requested_amount} /> : <span className="text-gray-400">—</span>}
                    </div>
                  </div>
                  {r.amount > 0 && (
                    <div className="text-right">
                      <span className="text-xs text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Approved</span>
                      <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        <Currency value={r.amount} />
                      </div>
                    </div>
                  )}
                </div>

                {r.status === 'pending' && (
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-700 mt-2">
                    <button 
                      onClick={() => openReviewModal(r)} 
                      className="w-full py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl text-sm font-bold transition-all shadow-sm hover:shadow flex items-center justify-center gap-2"
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
              <tr className="bg-gray-50/50 dark:bg-gray-700/20 border-b border-gray-100 dark:border-gray-700">
                <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">When</th>
                <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Donor</th>
                <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Payment Name</th>
                <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Screenshot</th>
                <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Requested</th>
                <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Approved</th>
                <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">Status</th>
                <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredRows.map((r, index) => (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="py-4 px-6">
                    <div className="text-sm text-gray-900 dark:text-white font-medium">
                      {new Date(r.created_at).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(r.created_at).toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="font-medium text-gray-900 dark:text-white text-sm">
                      {r.donor_username || '—'}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {r.name_on_payment}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    {r.screenshot_url ? (
                      <img
                        src={r.screenshot_url}
                        alt="screenshot"
                        className="w-12 h-12 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity border border-gray-200 dark:border-gray-600"
                        onClick={() => openImageModal(r.screenshot_url)}
                      />
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500 text-xs">—</span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="font-bold text-gray-900 dark:text-white text-sm">
                      {r.requested_amount ? <Currency value={r.requested_amount} /> : <span className="text-gray-400">—</span>}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      {r.amount > 0 ? <Currency value={r.amount} /> : <span className="text-gray-400">—</span>}
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
                          className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-bold transition-all shadow-sm hover:shadow flex items-center gap-2"
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

    socket.on('admin_update', (data) => {// console.log('[Withdrawals] Admin update received via socket:', data);
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
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 overflow-hidden animate-fade-in-stagger">
        <div className="px-6 py-5 border-b border-gray-100/80 dark:border-gray-700/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Withdrawal Requests</h3>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Manage streamer payout requests</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setStatusFilter('pending')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'pending'
                ? 'bg-primary-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}>Pending</button>
              <button onClick={() => setStatusFilter('approved')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'approved'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}>Approved</button>
              <button onClick={() => setStatusFilter('rejected')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'rejected'
                ? 'bg-rose-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}>Rejected</button>
            </div>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="block sm:hidden divide-y divide-gray-100 dark:divide-gray-700">
          {filteredRows.map((w, index) => (
            <div key={w.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white truncate">
                    {w.streamer_username || 'Unknown Streamer'}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
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
                <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Telebirr</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{w.telebirr_username}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Phone</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{w.phone_number}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Amount</span>
                    <div className="font-bold text-gray-900 dark:text-white mt-0.5">
                      <Currency value={w.amount} />
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Payout (60%)</span>
                    <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      <Currency value={w.amount * 0.6} />
                    </div>
                  </div>
                </div>

                {w.status === 'pending' && (
                  <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700 mt-2">
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
              <tr className="bg-gray-50/50 dark:bg-gray-700/20 border-b border-gray-100 dark:border-gray-700">
                <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">When</th>
                <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Streamer</th>
                <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Telebirr Username</th>
                <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Phone Number</th>
                <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Amount</th>
                <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Payout (60%)</th>
                <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">Status</th>
                <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredRows.map((w, index) => (
                <tr key={w.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="py-4 px-6">
                    <div className="text-sm text-gray-900 dark:text-white font-medium">
                      {new Date(w.created_at).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(w.created_at).toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="font-medium text-gray-900 dark:text-white text-sm">
                      {w.streamer_username || '—'}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {w.telebirr_username}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {w.phone_number}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="font-bold text-gray-900 dark:text-white text-sm">
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

    socket.on('admin_update', (data) => {// console.log('[StreamerRequests] Admin update received via socket:', data);
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
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 overflow-hidden animate-fade-in-stagger">
        <div className="px-6 py-5 border-b border-gray-100/80 dark:border-gray-700/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Streamer Requests</h3>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Review new streamer applications</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setStatusFilter('pending')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'pending'
                ? 'bg-primary-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}>Pending</button>
              <button onClick={() => setStatusFilter('approved')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'approved'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}>Approved</button>
              <button onClick={() => setStatusFilter('rejected')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'rejected'
                ? 'bg-rose-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}>Rejected</button>
            </div>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="block sm:hidden divide-y divide-gray-100 dark:divide-gray-700">
          {filteredRows.map((r, index) => (
            <div key={r.telegram_id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <div className="flex items-start gap-3 mb-3">
                {r.profile_picture_url ? (
                  <img
                    src={r.profile_picture_url}
                    alt="Profile"
                    className="w-12 h-12 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0 border border-gray-200 dark:border-gray-600"
                    onClick={() => openImageModal(r.profile_picture_url)}
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-gray-400 dark:text-gray-500 text-[10px]">No img</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-gray-900 dark:text-white truncate">
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
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    @{r.username}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Phone</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{r.phone_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Submitted</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {r.registration_status === 'pending' && (
                  <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700 mt-2">
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
              <tr className="bg-gray-50/50 dark:bg-gray-700/20 border-b border-gray-100 dark:border-gray-700">
                <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Submitted</th>
                <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Picture</th>
                <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Full Name</th>
                <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Username</th>
                <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Phone Number</th>
                <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">Status</th>
                <th className="py-3 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredRows.map((r, index) => (
                <tr key={r.telegram_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="py-4 px-6">
                    <div className="text-sm text-gray-900 dark:text-white font-medium">
                      {new Date(r.created_at).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(r.created_at).toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    {r.profile_picture_url ? (
                      <img
                        src={r.profile_picture_url}
                        alt="Profile"
                        className="w-10 h-10 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity border border-gray-200 dark:border-gray-600"
                        onClick={() => openImageModal(r.profile_picture_url)}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                        <span className="text-gray-400 dark:text-gray-500 text-[10px]">No img</span>
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    <div className="font-medium text-gray-900 dark:text-white text-sm">
                      {r.full_name}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      @{r.username}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="text-sm text-gray-900 dark:text-white">
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
  const [tab, setTab] = useState('overview');
  const [globalSearch, setGlobalSearch] = useState('');
  const [pendingCounts, setPendingCounts] = useState({ recharges: 0, withdrawals: 0, streamerRequests: 0, complaints: 0, flags: 0 });
  const [toasts, setToasts] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [flagRefreshKey, setFlagRefreshKey] = useState(0);
  const [adminToken, setAdminToken] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    // Check for theme in localStorage
    const saved = localStorage.getItem('theme');
    return saved === 'dark';
  });
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

  // Apply theme on load and when darkMode changes
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

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

  const toggleDarkMode = (isDark) => {
    setDarkMode(isDark);
    const nextTheme = isDark ? 'dark' : 'light';
    localStorage.setItem('theme', nextTheme);
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
      case 'donor_flag_created': {
        icon = '🚩';
        title = 'Streamer Flag Raised';
        description = `Streamer #${payload.streamerId || '—'} escalated a donor.`;
        break;
      }
      case 'donor_flag_updated': {
        icon = '🚩';
        title = `Flag ${capitalize(payload.status)}`;
        description = `Donor #${payload.donorId || '—'} update posted.`;
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
    socket.on('connect', () => {// console.log('Admin socket connected');
      socket.emit('join_admin_room');
    });
    socket.on('disconnect', () => console.log('Admin socket disconnected'));
    socket.on('new_donation', (data) => {// console.log('[AdminDashboard] New donation received via socket:', data);
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

    const handleAdminUpdate = (data) => {// console.log('[AdminDashboard] Admin update received via socket:', data);
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
          audio.play().catch(err => {// console.log('Audio play failed:', err);
            if (!notificationAudioReady) {// console.log('Waiting for user interaction to unlock notification audio.');
            }
          });
        } catch (err) {// console.log('Audio notification failed:', err);
        }
      }
    };

    socket.on('admin_update', handleAdminUpdate);
    return () => {
      socket.off('admin_update', handleAdminUpdate);
    };
  }, [apiClient, fetchCounts, addToast, notificationsMuted, notificationAudioReady, triggerFlagRefresh]);

  const NAV_ITEMS = [
    { 
      id: 'overview', 
      label: 'Overview', 
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg> 
    },
    { 
      id: 'streamer-requests', 
      label: 'Streamer Requests', 
      count: pendingCounts.streamerRequests,
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
    },
    { 
      id: 'streamers', 
      label: 'Streamers', 
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
    },
    { 
      id: 'donors', 
      label: 'Donors', 
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
    },
    { 
      id: 'donations', 
      label: 'Donations', 
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    },
    { 
      id: 'withdrawals', 
      label: 'Withdrawals', 
      count: pendingCounts.withdrawals,
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" /></svg>
    },
    { 
      id: 'recharges', 
      label: 'Recharges', 
      count: pendingCounts.recharges,
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
    },
    { 
      id: 'flags', 
      label: 'Flags', 
      count: pendingCounts.flags,
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-8a2 2 0 012-2h14a2 2 0 012 2v8H3zM3 10V3m0 7h14v-7H3" /></svg>
    },
    { 
      id: 'complaints', 
      label: 'Complaints', 
      count: pendingCounts.complaints,
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
    },
    { 
      id: 'settings', 
      label: 'Settings', 
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
    }
  ];

  if (!apiClient) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <ApiKeyModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onSubmit={handleTokenSubmit}
          title="Admin Authentication Required"
          message="Please enter the Admin Token to access this dashboard. The token can be found in your project's .env file."
        />
        <div className="text-center"><p className="text-gray-500 dark:text-gray-400">Waiting for Admin Token...</p></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 font-sans overflow-hidden">
      <ApiKeyModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSubmit={handleTokenSubmit}
        title="Admin Authentication Required"
        message="Please enter Admin Token to access this dashboard. The token can be found in your project's .env file."
      />

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsMobileMenuOpen(false)}></div>
          <aside className="fixed inset-y-0 left-0 w-[280px] bg-white/95 dark:bg-gray-900/98 backdrop-blur-xl shadow-2xl shadow-black/20 transform transition-transform duration-300 ease-in-out flex flex-col z-50">
             {/* Logo */}
             <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100/80 dark:border-gray-800">
                <div className="flex items-center gap-3">
                   <div className="relative w-9 h-9">
                      <div className="absolute inset-0 bg-gradient-to-tr from-primary-500 to-purple-600 rounded-xl opacity-20 blur-sm"></div>
                      <img src="/image/habesha-logo.png" alt="Logo" className="relative w-full h-full object-contain" />
                   </div>
                   <div>
                     <span className="text-base font-bold text-gray-900 dark:text-white tracking-tight">HabeshaTTS</span>
                     <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600 -mt-0.5">Admin Console</p>
                   </div>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
             </div>
             
             {/* Section Label */}
             <div className="px-6 pt-6 pb-2">
               <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-600">Navigation</p>
             </div>

             {/* Nav Items */}
             <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-0.5 custom-scrollbar">
               {NAV_ITEMS.map((item) => (
                 <button
                   key={item.id}
                   onClick={() => { setTab(item.id); setIsMobileMenuOpen(false); }}
                   className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${
                     tab === item.id
                       ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25'
                       : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-gray-800/80 hover:text-gray-900 dark:hover:text-white'
                   }`}
                 >
                   {tab === item.id && (
                     <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white/30 rounded-r-full"></div>
                   )}
                   <div className="flex items-center gap-3">
                     <span className={`transition-colors ${tab === item.id ? 'text-white' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`}>
                       {item.icon}
                     </span>
                     <span className="font-medium text-[13px]">{item.label}</span>
                   </div>
                   {item.count > 0 && (
                     <span className={`text-[10px] font-bold min-w-[20px] text-center px-1.5 py-0.5 rounded-md ${
                       tab === item.id ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                     }`}>
                       {item.count}
                     </span>
                   )}
                 </button>
               ))}
             </nav>

             {/* User Profile */}
             <div className="p-3 border-t border-gray-100/80 dark:border-gray-800">
               <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50/80 dark:bg-gray-800/50 border border-gray-100/80 dark:border-gray-700/50">
                 <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-md shadow-primary-500/20">
                   A
                 </div>
                 <div className="flex-1 min-w-0">
                   <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">Admin</p>
                   <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate font-medium">Super Administrator</p>
                 </div>
                 <div className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20 flex-shrink-0"></div>
               </div>
             </div>
          </aside>
        </div>
      )}

      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-[260px] bg-white/80 dark:bg-gray-900/95 backdrop-blur-xl border-r border-gray-200/60 dark:border-gray-800 z-20">
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-gray-100/80 dark:border-gray-800">
          <div className="relative w-9 h-9">
             <div className="absolute inset-0 bg-gradient-to-tr from-primary-500 to-purple-600 rounded-xl opacity-20 blur-sm"></div>
             <img src="/image/habesha-logo.png" alt="Logo" className="relative w-full h-full object-contain" />
          </div>
          <div>
            <span className="text-base font-bold text-gray-900 dark:text-white tracking-tight">HabeshaTTS</span>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600 -mt-0.5">Admin Console</p>
          </div>
        </div>

        {/* Section Label */}
        <div className="px-6 pt-6 pb-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-600">Navigation</p>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-0.5 custom-scrollbar">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${
                tab === item.id
                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-gray-800/80 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {tab === item.id && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white/30 rounded-r-full"></div>
              )}
              <div className="flex items-center gap-3">
                <span className={`transition-colors ${tab === item.id ? 'text-white' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`}>
                  {item.icon}
                </span>
                <span className="font-medium text-[13px]">{item.label}</span>
              </div>
              {item.count > 0 && (
                <span className={`text-[10px] font-bold min-w-[20px] text-center px-1.5 py-0.5 rounded-md ${
                  tab === item.id ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* User Profile (Bottom Sidebar) */}
        <div className="p-3 border-t border-gray-100/80 dark:border-gray-800">
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50/80 dark:bg-gray-800/50 border border-gray-100/80 dark:border-gray-700/50">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-md shadow-primary-500/20">
              A
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">Admin</p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate font-medium">Super Administrator</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20 flex-shrink-0"></div>
          </div>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50/50 dark:bg-gray-950">
        {/* Header */}
        <header className="h-16 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800 flex items-center justify-between px-4 sm:px-6 lg:px-8 z-10">
          {/* Mobile Menu Button */}
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="md:hidden p-2 -ml-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 rounded-xl transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>

          {/* Search Bar */}
          <div className="flex-1 max-w-md px-4 hidden md:block">
            <div className="relative group">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-gray-400 group-focus-within:text-primary-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </span>
              <input
                type="text"
                placeholder="Search donors, streamers..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="block w-full pl-10 pr-4 py-2 border border-gray-200/60 dark:border-gray-700/60 rounded-xl leading-5 bg-gray-50/80 dark:bg-gray-800/50 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white dark:focus:bg-gray-800 transition-all text-[13px]"
              />
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleNotificationMute}
              className="p-2.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors relative"
              title={notificationsMuted ? 'Unmute notifications' : 'Mute notifications'}
            >
              {notificationsMuted ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
              )}
              {!notificationsMuted && (
                <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
              )}
            </button>
            
            <div className="h-6 w-px bg-gray-200/60 dark:bg-gray-700/60 mx-1"></div>
            
            <ThemeToggle isDarkMode={darkMode} toggleDarkMode={toggleDarkMode} />
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 scroll-smooth">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Page Title */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                  {NAV_ITEMS.find(i => i.id === tab)?.label}
                </h2>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">Manage and monitor your platform</p>
              </div>
            </div>

            {/* Content */}
            <div className="animate-fade-in">
              {tab === 'overview' && <Overview apiClient={apiClient} refreshKey={refreshKey} />}
              {tab === 'streamer-requests' && <StreamerRequests apiClient={apiClient} />}
              {tab === 'streamers' && <Streamers apiClient={apiClient} refreshKey={refreshKey} />}
              {tab === 'donors' && <Donors apiClient={apiClient} refreshKey={refreshKey} search={globalSearch} />}
              {tab === 'donations' && <Donations apiClient={apiClient} refreshKey={refreshKey} />}
              {tab === 'withdrawals' && <Withdrawals apiClient={apiClient} />}
              {tab === 'recharges' && <Recharges apiClient={apiClient} />}
              {tab === 'flags' && (
                <DonorFlagsPanel
                  apiClient={apiClient}
                  refreshKey={flagRefreshKey}
                  onFlagResolved={fetchCounts}
                />
              )}
              {tab === 'complaints' && <AdminComplaints apiClient={apiClient} refreshData={refreshData} />}
              {tab === 'settings' && <Settings apiClient={apiClient} />}
            </div>
          </div>
        </main>
      </div>

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 max-w-xs sm:max-w-sm">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl shadow-2xl border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-4 w-72 sm:w-80 animate-slide-in-right overflow-hidden relative"
            >
              {/* Accent color bar */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                toast.type === 'error' ? 'bg-red-500' :
                toast.type === 'warning' ? 'bg-amber-500' :
                toast.type === 'success' ? 'bg-emerald-500' :
                'bg-primary-500'
              }`}></div>
              <div className="flex items-start gap-3 pl-2">
                <div className="text-xl leading-none mt-0.5 flex-shrink-0">
                  {toast.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-gray-900 dark:text-white truncate tracking-tight">
                    {toast.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                    {toast.description}
                  </p>
                  <p className="text-[10px] uppercase tracking-widest font-semibold text-gray-300 dark:text-gray-600 mt-2.5">
                    {toast.timestamp ? 'Updated just now' : 'Live update'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  className="text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400 transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50"
                  aria-label="Dismiss notification"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
