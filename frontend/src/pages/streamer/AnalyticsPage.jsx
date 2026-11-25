import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardHeader, DataTable, StatCard, Tabs, formatETB, useTheme } from '../../ui';
import { useStreamerApi } from '../../lib/streamerApi';
import { ErrorNote, KindBadge, PageHeader, fmtDate } from '../../components/dashboard/common';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const birr = (n) => formatETB(n, { decimals: 0 });

function ChartTooltip({ active, payload, label, labelFormat }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-overlay">
      <div className="font-medium text-fg">{labelFormat ? labelFormat(label) : label}</div>
      <div className="mt-0.5 tabular-nums text-muted">
        You got <span className="font-semibold text-fg">{formatETB(row.net)}</span> · {row.count} donation{row.count === 1 ? '' : 's'}
      </div>
    </div>
  );
}

ChartTooltip.propTypes = { active: PropTypes.bool, payload: PropTypes.array, label: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), labelFormat: PropTypes.func };

/** Single-series bar chart: no legend, the card title names the series. */
function NetBars({ data, xKey, tickFormat, labelFormat, height = 220 }) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const ink = dark ? '#9aa39e' : '#5b6660';
  const grid = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const fill = dark ? '#2fb466' : '#078930';
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke={grid} />
          <XAxis dataKey={xKey} tickFormatter={tickFormat} tick={{ fill: ink, fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={12} />
          <YAxis tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : v)} tick={{ fill: ink, fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
          <Tooltip cursor={{ fill: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }} content={<ChartTooltip labelFormat={labelFormat} />} />
          <Bar dataKey="net" fill={fill} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

NetBars.propTypes = { data: PropTypes.array.isRequired, xKey: PropTypes.string.isRequired, tickFormat: PropTypes.func, labelFormat: PropTypes.func, height: PropTypes.number };

const fmtDay = (d) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const fmtDuration = (s) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min` : `${Math.max(1, Math.round(s / 60))} min`);

/** Fill days with no donations so the time axis is continuous. */
function fillDays(daily, days) {
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const out = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    out.push(byDay.get(key) || { day: key, count: 0, gross: 0, net: 0 });
  }
  return out;
}

export default function AnalyticsPage() {
  const { uuid } = useParams();
  const call = useStreamerApi(uuid);
  const [days, setDays] = useState('30');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setData(null);
    setError(null);
    call(`/v1/streamer/${uuid}/analytics?days=${days}`, { signal: ctrl.signal })
      .then(setData)
      .catch((e) => { if (e.name !== 'AbortError') setError(e.message); });
    return () => ctrl.abort();
  }, [call, uuid, days]);

  const loading = !data && !error;
  const t = data?.totals;

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Real money only: demo payments are left out. Times are Addis Ababa time."
        actions={<Tabs variant="pill" size="sm" value={days} onChange={setDays} label="Time range" items={[{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }, { value: '90', label: '90 days' }]} />}
      />
      <ErrorNote>{error}</ErrorNote>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="You got" value={t ? birr(t.net) : '—'} icon="wallet" loading={loading} hint={t ? `${birr(t.gross)} paid by viewers` : undefined} />
        <StatCard label="Platform fee" value={t ? birr(t.fee) : '—'} icon="chart" loading={loading} />
        <StatCard label="Donations" value={t ? String(t.count) : '—'} icon="gift" loading={loading} />
        <StatCard label="Supporters" value={t ? String(t.donors) : '—'} icon="users" loading={loading} />
      </div>

      {data ? (
        <>
          <Card className="mt-6">
            <CardHeader title="Earnings per day" description="What you received after the fee." />
            <NetBars data={fillDays(data.daily, data.days)} xKey="day" tickFormat={fmtDay} labelFormat={fmtDay} height={240} />
          </Card>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Best hours" description="Earnings by hour of day." />
              <NetBars data={data.hourly} xKey="hour" tickFormat={(h) => `${h}:00`} labelFormat={(h) => `${h}:00–${h}:59`} />
            </Card>
            <Card>
              <CardHeader title="Best days" description="Earnings by day of week." />
              <NetBars data={data.weekday} xKey="weekday" tickFormat={(w) => WEEKDAYS[w - 1]} labelFormat={(w) => WEEKDAYS[w - 1]} />
            </Card>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="By type" />
              <ul className="flex flex-col gap-3">
                {['tts', 'sound', 'media'].map((k) => {
                  const v = data.byKind[k];
                  const pct = t.net ? Math.round((v.net / t.net) * 100) : 0;
                  return (
                    <li key={k} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <KindBadge kind={k} />
                        <span className="tabular-nums text-muted"><span className="font-semibold text-fg">{birr(v.net)}</span> · {v.count} · {pct}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-brand-600 dark:bg-brand-400" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
            <Card padding="none">
              <div className="px-5 pt-5 sm:px-6"><CardHeader title="Top supporters" /></div>
              <DataTable
                dense
                rowKey={(r, i) => `${r.name}-${i}`}
                rows={data.topDonors}
                empty={{ title: 'No supporters yet' }}
                columns={[
                  { key: 'name', header: 'Name' },
                  { key: 'count', header: 'Donations', align: 'right' },
                  { key: 'total', header: 'Paid', align: 'right', render: (r) => <span className="tabular-nums">{birr(r.total)}</span> },
                ]}
              />
            </Card>
          </div>

          <Card className="mt-6" padding="none">
            <div className="px-5 pt-5 sm:px-6"><CardHeader title="Streams" description="Each time you went live, and what it earned." /></div>
            <DataTable
              dense
              rows={data.sessions}
              empty={{ title: 'No streams recorded yet', description: 'Streams are recorded from when you go live with the dashboard open.' }}
              columns={[
                { key: 'startedAt', header: 'Started', render: (r) => fmtDate(r.startedAt) },
                { key: 'seconds', header: 'Length', render: (r) => (r.endedAt ? fmtDuration(r.seconds) : `Live · ${fmtDuration(r.seconds)}`) },
                { key: 'count', header: 'Donations', align: 'right' },
                { key: 'net', header: 'You got', align: 'right', render: (r) => <span className="font-semibold tabular-nums">{formatETB(r.net)}</span> },
              ]}
            />
          </Card>
        </>
      ) : null}
    </div>
  );
}
