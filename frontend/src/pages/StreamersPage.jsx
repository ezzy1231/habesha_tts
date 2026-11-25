import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { Avatar, Badge, Button, Card, EmptyState, Icon, Input, Skeleton, useI18n } from '../ui';
import { ViewerLayout } from '../components/viewer/ViewerLayout';
import { publicApi } from '../lib/publicApi';
import '../lib/viewerStrings';

function StreamerCard({ s }) {
  const { t } = useI18n();
  return (
    <Card as={Link} to={`/@${s.slug}`} interactive padding="sm" className="flex items-center gap-4">
      <Avatar src={s.avatarUrl} name={s.name} size="lg" status={s.live ? 'live' : 'offline'} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold text-fg">{s.name}</span>
          {s.live ? (
            <Badge variant="danger" size="sm" dot pulse>
              {t('dir.liveNow')}
            </Badge>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted">
          <span className="inline-flex items-center gap-1"><Icon name="mic" size={13} />TTS</span>
          {s.features?.soundboard ? <span className="inline-flex items-center gap-1"><Icon name="music" size={13} />{t('donate.tab.sound')}</span> : null}
          {s.features?.media ? <span className="inline-flex items-center gap-1"><Icon name="film" size={13} />{t('donate.tab.media')}</span> : null}
        </div>
      </div>
      <Icon name="chevronRight" size={18} className="text-subtle" />
    </Card>
  );
}

StreamerCard.propTypes = {
  s: PropTypes.shape({
    slug: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    avatarUrl: PropTypes.string,
    live: PropTypes.bool,
    features: PropTypes.shape({ soundboard: PropTypes.bool, media: PropTypes.bool }),
  }).isRequired,
};

export default function StreamersPage() {
  const { t } = useI18n();
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setError(null);
    publicApi.streamers({ signal: ctrl.signal }).then(setList).catch((e) => {
      if (e.name !== 'AbortError') setError(e.message);
    });
    // Live status changes; refresh every 30 s while the page is open.
    const id = setInterval(() => publicApi.streamers().then(setList).catch(() => {}), 30_000);
    return () => {
      ctrl.abort();
      clearInterval(id);
    };
  }, [attempt]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!list) return null;
    return q ? list.filter((s) => s.name.toLowerCase().includes(q) || s.slug.includes(q)) : list;
  }, [list, query]);

  const live = filtered?.filter((s) => s.live) || [];
  const offline = filtered?.filter((s) => !s.live) || [];

  return (
    <ViewerLayout>
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-3xl font-bold tracking-tight text-fg sm:text-4xl">{t('dir.title')}</h1>
        <p className="mt-2 max-w-2xl text-muted">{t('dir.subtitle')}</p>
        <Input
          className="mt-6 max-w-md"
          aria-label={t('dir.search')}
          placeholder={t('dir.search')}
          leftIcon={<Icon name="search" size={16} />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {error ? (
          <EmptyState
            className="mt-10"
            icon="alert"
            title={t('dir.error')}
            description={error}
            action={<Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>{t('dir.retry')}</Button>}
          />
        ) : !filtered ? (
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState className="mt-10" icon="users" title={t('dir.empty')} description={t('dir.emptyHint')} />
        ) : (
          <>
            {live.length ? (
              <section className="mt-8">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t('dir.liveNow')} · {live.length}</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{live.map((s) => <StreamerCard key={s.slug} s={s} />)}</div>
              </section>
            ) : null}
            {offline.length ? (
              <section className="mt-8">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t('dir.offline')} · {offline.length}</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{offline.map((s) => <StreamerCard key={s.slug} s={s} />)}</div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </ViewerLayout>
  );
}
