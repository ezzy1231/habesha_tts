import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useParams } from 'react-router-dom';
import { Badge, Button, Card, CardHeader, EmptyState, Skeleton, Tabs, formatETB, useToast } from '../../ui';
import { useStreamerApi } from '../../lib/streamerApi';
import { ErrorNote, PageHeader, fmtDate } from '../../components/dashboard/common';

const STATUS = {
  pending: { label: 'Waiting', variant: 'warning' },
  approved: { label: 'Approved', variant: 'success' },
  played: { label: 'Played', variant: 'neutral' },
  rejected: { label: 'Rejected', variant: 'danger' },
};

const fmtStart = (s) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '0:00');

function MediaCard({ item, onApprove, onReject, busy }) {
  const st = STATUS[item.status] || STATUS.pending;
  return (
    <li className="flex flex-col gap-4 py-4 sm:flex-row">
      <a href={`${item.url}${item.start ? `&t=${item.start}` : ''}`} target="_blank" rel="noreferrer" className="shrink-0">
        {item.videoId ? (
          <img src={`https://i.ytimg.com/vi/${item.videoId}/mqdefault.jpg`} alt="" className="aspect-video w-full rounded-lg object-cover sm:w-48" loading="lazy" />
        ) : <div className="aspect-video w-full rounded-lg bg-surface-2 sm:w-48" />}
      </a>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={st.variant} size="sm">{st.label}</Badge>
          {item.isDemo ? <Badge variant="warning" size="sm">Demo</Badge> : null}
          <span className="text-xs text-muted">{fmtDate(item.createdAt)}</span>
        </div>
        <p className="mt-1 font-medium text-fg">{item.title || 'YouTube video'}</p>
        <p className="text-sm text-muted">
          {item.donorName || 'Anonymous'} · <span className="tabular-nums">{formatETB(item.amount)}</span> · starts at {fmtStart(item.start)}
        </p>
        {item.message ? <p className="mt-2 rounded-md bg-surface-2 px-3 py-2 text-sm text-fg">{item.message}</p> : null}
        {item.status === 'pending' ? (
          <div className="mt-3 flex gap-2">
            <Button size="sm" loading={busy === `a${item.id}`} disabled={Boolean(busy)} onClick={() => onApprove(item)}>Approve and play</Button>
            <Button size="sm" variant="secondary" loading={busy === `r${item.id}`} disabled={Boolean(busy)} onClick={() => onReject(item)}>Reject</Button>
          </div>
        ) : null}
      </div>
    </li>
  );
}

MediaCard.propTypes = { item: PropTypes.object.isRequired, onApprove: PropTypes.func.isRequired, onReject: PropTypes.func.isRequired, busy: PropTypes.string };

export default function MediaQueuePage({ onChange }) {
  const { uuid } = useParams();
  const call = useStreamerApi(uuid);
  const toast = useToast();
  const [tab, setTab] = useState('pending');
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      const r = await call(`/v1/streamer/${uuid}/media${tab === 'pending' ? '?status=pending' : ''}`);
      setItems(r.media);
      setError(null);
      if (tab === 'pending') onChange?.(r.media.length);
    } catch (e) {
      setError(e.message);
    }
  }, [call, uuid, tab, onChange]);

  useEffect(() => {
    setItems(null);
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [load]);

  const act = async (item, action) => {
    if (action === 'reject' && !window.confirm('Reject this video? The viewer gets the money back as credit.')) return;
    setBusy(`${action[0]}${item.id}`);
    try {
      const r = await call(`/v1/streamer/${uuid}/media/${item.id}/${action}`, { method: 'POST' });
      if (action === 'approve') toast.success('Sent to your overlay', { description: 'It plays after the current alert.' });
      else toast.success('Rejected', { description: r.refundedAs === 'none' ? 'Demo payment: nothing to refund.' : 'The viewer was refunded as credit.' });
      await load();
    } catch (e) {
      toast.error('Something went wrong', { description: e.message });
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Media queue"
        description="Viewers' YouTube requests. Nothing plays until you approve it. Requests you don't answer within 12 hours are refunded automatically."
        actions={<Button as={Link} to={`/streamer/${uuid}/settings`} variant="secondary" size="sm">Media settings</Button>}
      />
      <Tabs className="mb-4" value={tab} onChange={setTab} items={[{ value: 'pending', label: 'Waiting' }, { value: 'all', label: 'History' }]} label="Media queue" variant="pill" />
      <ErrorNote>{error}</ErrorNote>
      <Card>
        <CardHeader title={tab === 'pending' ? 'Waiting for you' : 'Recent requests'} />
        {!items ? (
          <Skeleton className="h-40 w-full rounded-lg" />
        ) : items.length === 0 ? (
          <EmptyState compact icon="film" title={tab === 'pending' ? 'Nothing waiting' : 'No requests yet'} description="Turn on media share in Settings so viewers can send videos." />
        ) : (
          <ul className="divide-y divide-line">
            {items.map((m) => <MediaCard key={m.id} item={m} busy={busy} onApprove={(i) => act(i, 'approve')} onReject={(i) => act(i, 'reject')} />)}
          </ul>
        )}
      </Card>
    </div>
  );
}

MediaQueuePage.propTypes = { onChange: PropTypes.func };
