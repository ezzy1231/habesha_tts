import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge, Button, Card, CopyField, EmptyState, Icon, Spinner, formatETB, useI18n } from '../ui';
import { ViewerLayout } from '../components/viewer/ViewerLayout';
import { publicApi } from '../lib/publicApi';
import { CLAIM_KEY } from '../lib/publicApi';
import '../lib/viewerStrings';

const POLL_MS = 3000;
const MAX_POLLS = 100; // about five minutes

function outcome(p) {
  if (!p) return null;
  if (p.status === 'failed') return 'failed';
  if (p.status === 'expired') return 'expired';
  if (p.status !== 'paid') return 'pending';
  if (p.donation?.status === 'refunded') return p.donation.mediaStatus === 'rejected' ? 'mediaRejected' : 'refunded';
  if (p.kind === 'media' && ['approved', 'played'].includes(p.donation?.mediaStatus)) return 'mediaApproved';
  return 'paid';
}

export default function DonateReturnPage() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const tx = params.get('tx') || '';
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!/^ht-[a-f0-9]{24}$/.test(tx)) {
      setError(t('ret.notFound'));
      return undefined;
    }
    let polls = 0;
    let timer;
    let stopped = false;
    const tick = async () => {
      try {
        const p = await publicApi.payment(tx);
        if (stopped) return;
        setPayment(p);
        if (p.claimCode) {
          try { localStorage.setItem(CLAIM_KEY, p.claimCode); } catch { /* storage unavailable */ }
        }
        // Keep polling while the payment is pending, and for media until the streamer decides.
        const waiting = p.status === 'pending' || (p.kind === 'media' && p.status === 'paid' && p.donation?.mediaStatus === 'pending');
        if (waiting && ++polls < MAX_POLLS) timer = setTimeout(tick, p.status === 'pending' ? POLL_MS : POLL_MS * 3);
      } catch (e) {
        if (stopped) return;
        if (e.status === 404) setError(t('ret.notFound'));
        else if (++polls < MAX_POLLS) timer = setTimeout(tick, POLL_MS * 2);
        else setError(e.message);
      }
    };
    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [tx, t]);

  const state = outcome(payment);
  const again = payment?.streamer ? `/@${payment.streamer.slug}` : '/streamers';

  let body;
  if (error) {
    body = <EmptyState icon="alert" title={error} action={<Button as={Link} to="/streamers" variant="secondary">{t('donate.back')}</Button>} />;
  } else if (!payment) {
    body = (
      <div className="flex flex-col items-center gap-3 py-10 text-muted" role="status">
        <Spinner size={40} />
        {t('ret.checking')}
      </div>
    );
  } else {
    const good = ['paid', 'mediaApproved'].includes(state);
    const icon = good ? 'checkCircle' : state === 'pending' ? 'info' : state === 'failed' || state === 'expired' ? 'xCircle' : 'wallet';
    const title = {
      paid: t('ret.paid'), mediaApproved: t('ret.paid'), pending: t('ret.pending'), failed: t('ret.failed'),
      expired: t('ret.expired'), refunded: t('ret.refunded'), mediaRejected: t('ret.refunded'),
    }[state];
    const detail = {
      paid: { tts: t('ret.paidTts'), sound: t('ret.paidSound'), media: t('ret.paidMedia') }[payment.kind],
      mediaApproved: t('ret.mediaApproved'),
      pending: t('ret.pendingHint'),
      failed: t('ret.failedHint'),
      expired: t('ret.failedHint'),
      refunded: null,
      mediaRejected: t('ret.mediaRejected'),
    }[state];

    body = (
      <div className="flex flex-col items-center text-center">
        <span className={good ? 'text-brand-600 dark:text-brand-400' : 'text-muted'}>
          {state === 'pending' ? <Spinner size={40} /> : <Icon name={icon} size={48} />}
        </span>
        <h1 className="mt-4 text-2xl font-bold text-fg">{title}</h1>
        {detail ? <p className="mt-2 max-w-sm text-muted">{detail}</p> : null}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm text-muted">
          {payment.streamer ? <span>{payment.streamer.name}</span> : null}
          <span>·</span>
          <span className="tabular-nums">{formatETB(payment.price)}</span>
          {payment.isDemo ? <Badge variant="warning" size="sm">{t('donate.demo')}</Badge> : null}
        </div>
        {payment.isDemo && payment.status === 'paid' ? <p className="mt-2 text-xs text-muted">{t('ret.demo')}</p> : null}

        {payment.claimCode ? (
          <div className="mt-6 w-full text-left">
            <CopyField label={t('ret.claimTitle')} value={payment.claimCode} hint={t('ret.claimHint')} />
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Button as={Link} to={again}>{t('ret.again')}</Button>
          <Button as={Link} to="/streamers" variant="secondary">{t('donate.back')}</Button>
        </div>
      </div>
    );
  }

  return (
    <ViewerLayout>
      <div className="mx-auto w-full max-w-lg px-4 py-12 sm:py-16">
        <Card padding="lg" accent>{body}</Card>
      </div>
    </ViewerLayout>
  );
}
