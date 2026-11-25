import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Badge, Button, Card, DataTable, formatETB } from '../../ui';
import { useStreamerApi } from '../../lib/streamerApi';
import { ErrorNote, KindBadge, PageHeader, fmtDate } from '../../components/dashboard/common';

const money = (n) => (n === null || n === undefined ? '—' : formatETB(n));

export default function EarningsPage() {
  const { uuid } = useParams();
  const call = useStreamerApi(uuid);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setError(null);
    call(`/streamer/${uuid}/donations?page=${page}`, { signal: ctrl.signal })
      .then(setData)
      .catch((e) => { if (e.name !== 'AbortError') setError(e.message); });
    return () => ctrl.abort();
  }, [call, uuid, page]);

  const rows = (data?.donations || []).map((d) => {
    const gross = Number(d.amount);
    // Older donations have no fee recorded: they were credited in full.
    const fee = d.is_demo ? 0 : d.platform_fee === null || d.platform_fee === undefined ? 0 : Number(d.platform_fee);
    const net = d.is_demo ? 0 : d.net_amount === null || d.net_amount === undefined ? gross : Number(d.net_amount);
    return { ...d, gross, fee, net };
  });

  const columns = [
    { key: 'created_at', header: 'Date', render: (r) => <span className="whitespace-nowrap text-muted">{fmtDate(r.created_at)}</span> },
    {
      key: 'donor_name',
      header: 'From',
      render: (r) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-medium text-fg">
            {r.donor_name || 'Anonymous'}
            {r.is_demo ? <Badge variant="warning" size="sm">Demo</Badge> : null}
          </div>
          {r.text ? <div className="max-w-xs truncate text-xs text-muted" title={r.text}>{r.text}</div> : null}
        </div>
      ),
    },
    { key: 'kind', header: 'Type', render: (r) => <div className="flex items-center gap-1.5"><KindBadge kind={r.kind} /><span className="text-xs text-muted">{r.source === 'web' ? 'Web' : 'Telegram'}</span></div> },
    { key: 'gross', header: 'Paid', align: 'right', render: (r) => <span className="tabular-nums">{money(r.gross)}</span> },
    { key: 'fee', header: 'Fee', align: 'right', render: (r) => <span className="tabular-nums text-muted">{r.fee ? `− ${formatETB(r.fee)}` : '—'}</span> },
    { key: 'net', header: 'You get', align: 'right', render: (r) => <span className="font-semibold tabular-nums text-fg">{money(r.net)}</span> },
  ];

  const p = data?.pagination;
  return (
    <div>
      <PageHeader title="Donations" description="Every paid donation, with the platform fee and what you received. Demo payments play on stream but earn nothing." />
      <ErrorNote>{error}</ErrorNote>
      <Card padding="none">
        <DataTable columns={columns} rows={rows} loading={!data && !error} empty={{ title: 'No donations yet', description: 'Share your donate link to get your first one.' }} />
      </Card>
      {p && p.totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>Page {p.currentPage} of {p.totalPages} · {p.totalCount} donations</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>Previous</Button>
            <Button size="sm" variant="secondary" disabled={!p.hasNextPage} onClick={() => setPage((n) => n + 1)}>Next</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
