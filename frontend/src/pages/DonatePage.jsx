import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useParams } from 'react-router-dom';
import {
  Avatar, Badge, Button, Card, EmptyState, Icon, Input, Select, Skeleton, Tabs, Textarea, cn, extendDictionaries, focusRing, formatETB, useI18n,
} from '../ui';
import { ViewerLayout } from '../components/viewer/ViewerLayout';
import { ApiError, looksLikeYouTube, messageLength, priceForTts, publicApi, usdFor } from '../lib/publicApi';
import '../lib/viewerStrings';
import '../lib/accountStrings';
import { useAccount } from '../lib/accountApi';

const NAME_KEY = 'habesha.donorName';

extendDictionaries({
  en: {
    'donate.preview.title': 'Your alert',
    'donate.preview.anon': 'Your name',
    'donate.preview.empty': 'Your message will appear here…',
    'donate.secure': 'Secure checkout · plays live on stream',
  },
  am: {
    'donate.preview.title': 'የእርስዎ መልዕክት',
    'donate.preview.anon': 'ስምዎ',
    'donate.preview.empty': 'መልዕክትዎ እዚህ ይታያል…',
    'donate.secure': 'ደህንነቱ የተጠበቀ ክፍያ · በቀጥታ ይነበባል',
  },
});
import { CLAIM_KEY } from '../lib/publicApi';

const readLocal = (key) => {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
};
const writeLocal = (key, value) => {
  try { if (value) localStorage.setItem(key, value); else localStorage.removeItem(key); } catch { /* storage unavailable */ }
};

const fmtUSD = (n) => `USD ${n.toFixed(2)}`;

/** Big radio-card group used for providers and currencies. */
function ChoiceGroup({ label, options, value, onChange }) {
  return (
    <fieldset>
      <legend className="mb-2.5 text-sm font-medium text-fg">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => {
          const active = value === o.value;
          return (
            <label
              key={o.value}
              className={cn(
                'relative flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-sm transition-all has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500/50',
                active ? 'border-brand-500 bg-brand-500/[0.08] shadow-[0_0_0_1px_rgb(139_92_246/0.35)]' : 'border-line bg-surface hover:border-line-strong hover:bg-surface-2',
              )}
            >
              <input type="radio" className="sr-only" checked={active} onChange={() => onChange(o.value)} name={String(label)} />
              <span
                aria-hidden="true"
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors',
                  active ? 'border-brand-500 bg-brand-500' : 'border-line-strong',
                )}
              >
                {active ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
              </span>
              <span className="flex-1 font-medium text-fg">{o.label}</span>
              {o.badge}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

ChoiceGroup.propTypes = {
  label: PropTypes.node.isRequired,
  options: PropTypes.arrayOf(PropTypes.shape({ value: PropTypes.string, label: PropTypes.node, badge: PropTypes.node })).isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
};

function SoundGrid({ sounds, selected, onSelect }) {
  const { t } = useI18n();
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(null);

  useEffect(() => () => audioRef.current?.pause(), []);

  const preview = (s) => {
    audioRef.current?.pause();
    if (playing === s.id) {
      setPlaying(null);
      return;
    }
    const a = new Audio(s.previewUrl);
    a.volume = 0.6;
    audioRef.current = a;
    setPlaying(s.id);
    a.onended = () => setPlaying(null);
    // Previews stop after 10 s, the same limit the overlay uses.
    setTimeout(() => { if (audioRef.current === a) { a.pause(); setPlaying(null); } }, 10_000);
    a.play().catch(() => setPlaying(null));
  };

  if (!sounds.length) return <EmptyState compact icon="music" title={t('donate.sound.none')} description={t('donate.sound.noneHint')} />;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {sounds.map((s) => {
        const cooling = s.availableIn > 0;
        const active = selected === s.id;
        return (
          <div
            key={s.id}
            className={cn(
              'flex flex-col gap-2 rounded-lg border p-3 transition-colors',
              active ? 'border-brand-500 bg-brand-500/10' : 'border-line',
              cooling && 'opacity-60',
            )}
          >
            <button
              type="button"
              disabled={cooling}
              onClick={() => onSelect(s.id)}
              aria-pressed={active}
              className={cn('text-left disabled:cursor-not-allowed', focusRing, 'rounded')}
            >
              <span className="block truncate font-medium text-fg">{s.label}</span>
              <span className="text-sm tabular-nums text-muted">
                {cooling ? t('donate.sound.cooldown', { s: s.availableIn }) : formatETB(s.price, { decimals: 0 })}
              </span>
            </button>
            <Button size="sm" variant="ghost" onClick={() => preview(s)} leftIcon={<Icon name={playing === s.id ? 'close' : 'live'} size={14} />}>
              {t('donate.sound.preview')}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

SoundGrid.propTypes = {
  sounds: PropTypes.array.isRequired,
  selected: PropTypes.number,
  onSelect: PropTypes.func.isRequired,
};

/** Profile hero: soft violet glow, large avatar, live state and links. */
function Header({ s }) {
  const { t } = useI18n();
  let host = null;
  try {
    host = s.socialLink ? new URL(s.socialLink).hostname.replace(/^www\./, '') : null;
  } catch {
    host = null;
  }
  return (
    <div className="relative overflow-hidden border-b border-line">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[26rem] w-[56rem] -translate-x-1/2 rounded-full bg-brand-500/20 blur-[120px]" />
        <div className="absolute -top-24 right-[8%] h-64 w-64 rounded-full bg-sky-500/10 blur-[90px]" />
        <div className="lp-grid absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      </div>
      <div className="relative mx-auto w-full max-w-5xl px-4 pb-8 pt-6 sm:px-6 sm:pb-10">
        <Link to="/streamers" className={cn('inline-flex items-center gap-1 rounded text-sm text-muted transition-colors hover:text-fg', focusRing)}>
          <Icon name="chevronLeft" size={16} />
          {t('donate.back')}
        </Link>
        <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="relative w-fit">
            <div aria-hidden="true" className={cn('absolute -inset-1 rounded-full blur-md', s.live ? 'bg-red-500/40' : 'bg-brand-500/30')} />
            <Avatar src={s.avatarUrl} name={s.name} size="xl" status={s.live ? 'live' : 'offline'} className="relative rounded-full ring-4 ring-canvas" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="truncate font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">{s.name}</h1>
              {s.live ? (
                <Badge variant="danger" dot pulse>
                  {t('dir.liveNow')}
                </Badge>
              ) : (
                <Badge>{t('dir.offline')}</Badge>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <span className="font-medium">@{s.slug}</span>
              {host ? (
                <a href={s.socialLink} target="_blank" rel="noreferrer nofollow" className={cn('inline-flex items-center gap-1 rounded transition-colors hover:text-fg', focusRing)}>
                  <Icon name="external" size={13} />
                  {host}
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Header.propTypes = { s: PropTypes.object.isRequired };

export default function DonatePage() {
  const { t, lang } = useI18n();
  const params = useParams();
  const slug = String(params.slug || params.handle || '').replace(/^@/, '').toLowerCase();

  const [profile, setProfile] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [tab, setTab] = useState('tts');
  const [donorName, setDonorName] = useState(() => readLocal(NAME_KEY));
  const [message, setMessage] = useState('');
  const [voiceKey, setVoiceKey] = useState('');
  const [soundId, setSoundId] = useState(null);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaStart, setMediaStart] = useState('');
  const [mediaAmount, setMediaAmount] = useState('');
  const [mediaNote, setMediaNote] = useState('');
  const [provider, setProvider] = useState('');
  const [currency, setCurrency] = useState('ETB');
  const [claimCode, setClaimCode] = useState(() => readLocal(CLAIM_KEY));
  const [credit, setCredit] = useState(null); // remaining credit on the code, once checked
  const [creditMsg, setCreditMsg] = useState(null);
  const [checkingCredit, setCheckingCredit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Signed-in donors can pay from their (Telegram) wallet.
  const { account } = useAccount();
  const walletAccount = account?.role === 'donor' && !account.banned ? account : null;
  const hasWallet = Boolean(walletAccount);
  useEffect(() => {
    if (!hasWallet) return;
    setProvider('wallet');
    setDonorName((cur) => cur || walletAccount.displayName || '');
  }, [hasWallet]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ctrl = new AbortController();
    setProfile(null);
    setLoadError(null);
    publicApi.streamer(slug, { signal: ctrl.signal }).then((p) => {
      setProfile(p);
      const firstVoice = p.tts.voices[0];
      if (firstVoice) setVoiceKey(`${firstVoice.engine}:${firstVoice.voice}`);
      setProvider((cur) => cur || p.providers.find((x) => !x.test && x.name !== 'demo')?.name || p.providers[0]?.name || '');
    }).catch((e) => {
      if (e.name !== 'AbortError') setLoadError(e);
    });
    return () => ctrl.abort();
  }, [slug]);

  // Keep sound cooldowns and live state fresh while the page is open.
  const loaded = Boolean(profile);
  useEffect(() => {
    if (!loaded) return undefined;
    const id = setInterval(() => publicApi.streamer(slug).then(setProfile).catch(() => {}), 20_000);
    return () => clearInterval(id);
  }, [slug, loaded]);

  const tabs = useMemo(() => {
    if (!profile) return [];
    return [
      { value: 'tts', label: <><span className="sm:hidden">{t('donate.tab.tts.short')}</span><span className="hidden sm:inline">{t('donate.tab.tts')}</span></>, icon: <Icon name="mic" size={16} /> },
      profile.soundboard.enabled ? { value: 'sound', label: <><span className="sm:hidden">{t('donate.tab.sound.short')}</span><span className="hidden sm:inline">{t('donate.tab.sound')}</span></>, icon: <Icon name="music" size={16} /> } : null,
      profile.media.enabled ? { value: 'media', label: <><span className="sm:hidden">{t('donate.tab.media.short')}</span><span className="hidden sm:inline">{t('donate.tab.media')}</span></>, icon: <Icon name="film" size={16} /> } : null,
    ].filter(Boolean);
  }, [profile, t]);

  const selectedProvider = profile?.providers.find((p) => p.name === provider);
  const usdAvailable = Boolean(profile?.usdRate && selectedProvider?.currencies?.includes('USD'));
  useEffect(() => {
    if (!usdAvailable && currency !== 'ETB') setCurrency('ETB');
  }, [usdAvailable, currency]);

  if (loadError) {
    return (
      <ViewerLayout>
        <div className="mx-auto max-w-xl px-4 py-16">
          <EmptyState
            icon={loadError instanceof ApiError && loadError.status === 404 ? 'users' : 'alert'}
            title={loadError.status === 404 ? t('donate.notFound') : t('dir.error')}
            description={loadError.status === 404 ? t('donate.notFoundHint') : loadError.message}
            action={<Button as={Link} to="/streamers" variant="secondary">{t('donate.back')}</Button>}
          />
        </div>
      </ViewerLayout>
    );
  }

  if (!profile) {
    return (
      <ViewerLayout>
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <Skeleton className="h-96 w-full rounded-xl" />
            <Skeleton className="h-80 w-full rounded-xl" />
          </div>
        </div>
      </ViewerLayout>
    );
  }

  const { tts, media, soundboard } = profile;
  const len = messageLength(message);
  const tooLong = len > tts.maxChars;
  const sound = soundboard.sounds.find((s) => s.id === soundId);
  const mediaMin = Number(media.minAmount) || 0;
  const mediaValue = Math.max(mediaMin, Math.floor(Number(mediaAmount) || 0));
  const urlBad = mediaUrl.trim() !== '' && !looksLikeYouTube(mediaUrl);

  const price = tab === 'tts' ? (len ? priceForTts(message, tts) : 0)
    : tab === 'sound' ? (sound?.price || 0)
    : mediaValue;

  const ready = donorName.trim().length > 0 && price > 0 && (
    tab === 'tts' ? len > 0 && !tooLong
      : tab === 'sound' ? Boolean(sound) && !(sound.availableIn > 0)
        : looksLikeYouTube(mediaUrl)
  );

  const creditUsed = credit ? Math.min(credit, price) : 0;
  const toPay = Math.max(0, price - creditUsed);
  const fee = Math.round(price * profile.platformFeePercent) / 100;
  const net = price - fee;
  const usd = currency === 'USD' ? usdFor(toPay, profile.usdRate) : null;
  const payLabel = toPay === 0 && creditUsed > 0 ? t('donate.payCredit')
    : t('donate.pay', { amount: usd ? fmtUSD(usd) : formatETB(toPay, { decimals: 0 }) });

  const voiceOptions = tts.voices.map((v) => ({
    value: `${v.engine}:${v.voice}`,
    label: `${lang === 'am' ? v.label : v.labelEn || v.label}${v.engine === 'gemini' ? ' · AI' : ''}`,
  }));

  const checkCredit = async () => {
    setCheckingCredit(true);
    setCreditMsg(null);
    try {
      const { remaining } = await publicApi.checkCredit(claimCode.trim());
      setCredit(remaining > 0 ? Number(remaining) : null);
      setCreditMsg(remaining > 0 ? t('donate.claimBalance', { amount: formatETB(remaining) }) : t('donate.claimNone'));
    } catch (e) {
      setCredit(null);
      setCreditMsg(e.message);
    } finally {
      setCheckingCredit(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!ready || submitting || !provider || walletShort) return;
    setSubmitting(true);
    setSubmitError(null);
    writeLocal(NAME_KEY, donorName.trim());
    const [engine, voice] = voiceKey.split(':');
    const body = { slug: profile.slug, kind: tab, donorName: donorName.trim(), provider, currency };
    if (credit && claimCode.trim()) body.claimCode = claimCode.trim();
    if (tab === 'tts') Object.assign(body, { message: message.trim(), engine, voice });
    if (tab === 'sound') body.soundId = sound.id;
    if (tab === 'media') {
      Object.assign(body, { mediaUrl: mediaUrl.trim(), amount: mediaValue });
      if (mediaStart !== '') body.mediaStart = Math.max(0, Math.floor(Number(mediaStart) || 0));
      if (mediaNote.trim()) body.message = mediaNote.trim();
    }
    try {
      const out = await publicApi.checkout(body);
      window.location.assign(out.redirectUrl);
    } catch (err) {
      setSubmitError(err.message);
      setSubmitting(false);
    }
  };

  const providerOptions = [
    ...(walletAccount ? [{ value: 'wallet', label: t('donate.wallet', { balance: formatETB(walletAccount.balance) }) }] : []),
    ...profile.providers.map((p) => ({
      value: p.name,
      label: p.name === 'demo' ? t('donate.demo') : p.label,
      badge: p.name === 'demo' ? <Badge variant="warning" size="sm">{t('donate.demo')}</Badge>
        : p.test ? <Badge variant="info" size="sm">{t('donate.test')}</Badge> : null,
    })),
  ];
  const walletShort = provider === 'wallet' && walletAccount && toPay > Number(walletAccount.balance);

  const voiceLabel = voiceOptions.find((v) => v.value === voiceKey)?.label;
  const previewText = tab === 'tts' ? message.trim()
    : tab === 'sound' ? (sound ? sound.label : '')
    : (mediaNote.trim() || mediaUrl.trim());
  const kindIcon = tab === 'tts' ? 'mic' : tab === 'sound' ? 'music' : 'film';
  const errorText = 'text-red-600 dark:text-red-400';

  return (
    <ViewerLayout>
      <Header s={profile} />

      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        {!profile.live ? (
          <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-line bg-surface p-3.5 text-sm text-muted" role="status">
            <Icon name="info" size={18} className="mt-0.5 shrink-0 text-brand-500" />
            {t('donate.offline')}
          </div>
        ) : null}

        <form onSubmit={submit} noValidate className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-w-0 flex-col gap-6">
            <Card padding="none" className="overflow-hidden">
              {tabs.length > 1 ? (
                <div className="border-b border-line bg-surface-2/50 px-5 pt-4 sm:px-6">
                  <Tabs items={tabs} value={tab} onChange={setTab} label={t('donate.tab.tts')} fitted />
                </div>
              ) : null}

              <div className="flex flex-col gap-5 p-5 sm:p-6">
                <Input
                  label={t('donate.name')}
                  placeholder={t('donate.namePh')}
                  value={donorName}
                  maxLength={40}
                  required
                  autoComplete="nickname"
                  onChange={(e) => setDonorName(e.target.value)}
                />

                {tab === 'tts' ? (
                  <>
                    <Textarea
                      label={t('donate.message')}
                      placeholder={t('donate.messagePh')}
                      rows={5}
                      value={message}
                      required
                      inputClassName="font-ethiopic text-[15px] leading-relaxed"
                      onChange={(e) => setMessage(e.target.value)}
                      error={tooLong ? `${len}/${tts.maxChars}` : undefined}
                      hint={
                        <span className="flex justify-between gap-2">
                          <span>{t('donate.priceHint', { base: tts.basePrice, step: tts.stepChars, inc: tts.incrementPrice })}</span>
                          <span className="tabular-nums">{len}/{tts.maxChars}</span>
                        </span>
                      }
                    />
                    {tts.minAmount > 0 ? <p className="-mt-3 text-xs text-muted">{t('donate.minimum', { min: tts.minAmount })}</p> : null}
                    {voiceOptions.length > 1 ? (
                      <Select label={t('donate.voice')} options={voiceOptions} value={voiceKey} onChange={(e) => setVoiceKey(e.target.value)} />
                    ) : null}
                  </>
                ) : null}

                {tab === 'sound' ? <SoundGrid sounds={soundboard.sounds} selected={soundId} onSelect={setSoundId} /> : null}

                {tab === 'media' ? (
                  <>
                    <p className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-2 p-3.5 text-sm text-muted">
                      <Icon name="info" size={16} className="mt-0.5 shrink-0 text-brand-500" />
                      {t('donate.media.rules', { max: media.maxSeconds })}
                    </p>
                    <Input
                      label={t('donate.media.url')}
                      placeholder={t('donate.media.urlPh')}
                      inputMode="url"
                      value={mediaUrl}
                      required
                      leftIcon={<Icon name="link" size={15} />}
                      error={urlBad ? t('donate.media.urlBad') : undefined}
                      onChange={(e) => setMediaUrl(e.target.value)}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input
                        label={t('donate.media.amount')}
                        type="number"
                        min={mediaMin}
                        step={1}
                        placeholder={String(mediaMin)}
                        value={mediaAmount}
                        hint={t('donate.minimum', { min: mediaMin })}
                        onChange={(e) => setMediaAmount(e.target.value)}
                      />
                      <Input
                        label={t('donate.media.start')}
                        type="number"
                        min={0}
                        step={1}
                        placeholder="0"
                        value={mediaStart}
                        onChange={(e) => setMediaStart(e.target.value)}
                      />
                    </div>
                    <Input label={t('donate.media.note')} maxLength={200} value={mediaNote} onChange={(e) => setMediaNote(e.target.value)} />
                  </>
                ) : null}
              </div>
            </Card>

            <Card className="flex flex-col gap-5">
              {providerOptions.length ? (
                <ChoiceGroup label={t('donate.payWith')} options={providerOptions} value={provider} onChange={setProvider} />
              ) : (
                <p className={cn('text-sm', errorText)} role="alert">{t('donate.noProviders')}</p>
              )}
              {provider === 'demo' ? <p className="-mt-3 text-xs text-muted">{t('donate.demoHint')}</p> : null}
              {walletShort ? (
                <p className={cn('-mt-3 text-sm', errorText)} role="alert">
                  {t('donate.walletLow')} <Link to="/account" className="underline">{t('acct.nav')}</Link>
                </p>
              ) : null}
              {account === null ? (
                <Link to="/account" className={cn('-mt-2 inline-flex items-center gap-1.5 self-start rounded text-sm text-muted transition-colors hover:text-fg', focusRing)}>
                  <Icon name="wallet" size={15} />
                  {t('donate.signInWallet')}
                </Link>
              ) : null}

              {usdAvailable ? (
                <ChoiceGroup
                  label={t('donate.currency')}
                  options={[{ value: 'ETB', label: 'ETB · ብር' }, { value: 'USD', label: 'USD · card' }]}
                  value={currency}
                  onChange={setCurrency}
                />
              ) : null}

              <details className="group rounded-xl border border-line" open={Boolean(claimCode)}>
                <summary className={cn('flex cursor-pointer select-none items-center justify-between gap-2 rounded-xl px-3.5 py-3 text-sm font-medium text-muted transition-colors hover:text-fg [&::-webkit-details-marker]:hidden', focusRing)}>
                  <span className="inline-flex items-center gap-2">
                    <Icon name="gift" size={15} />
                    {t('donate.claim')}
                  </span>
                  <Icon name="chevronDown" size={15} className="transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t border-line p-3.5">
                  <div className="flex items-end gap-2">
                    <Input
                      className="flex-1"
                      aria-label={t('donate.claim')}
                      placeholder={t('donate.claimPh')}
                      value={claimCode}
                      autoComplete="off"
                      spellCheck={false}
                      inputClassName="font-mono tracking-wider"
                      onChange={(e) => { setClaimCode(e.target.value.toUpperCase()); setCredit(null); setCreditMsg(null); }}
                    />
                    <Button type="button" variant="secondary" loading={checkingCredit} disabled={!claimCode.trim()} onClick={checkCredit}>
                      {t('donate.claimCheck')}
                    </Button>
                  </div>
                  {creditMsg ? <p className="mt-2 text-sm text-muted" role="status">{creditMsg}</p> : null}
                </div>
              </details>
            </Card>
          </div>

          <aside className="lg:sticky lg:top-24">
            <Card padding="none" className="overflow-hidden">
              <div className="border-b border-line p-5">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-subtle">{t('donate.preview.title')}</p>
                <div className="relative mt-3 overflow-hidden rounded-xl border border-line bg-canvas p-4">
                  <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-500/70 to-transparent" />
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-300">
                      <Icon name={kindIcon} size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-fg">{donorName.trim() || t('donate.preview.anon')}</p>
                      {tab === 'tts' && voiceLabel ? <p className="truncate text-xs text-subtle">{voiceLabel}</p> : null}
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-brand-600 dark:text-brand-300">{formatETB(price, { decimals: 0 })}</span>
                  </div>
                  <p className={cn('mt-3 line-clamp-4 break-words font-ethiopic text-sm leading-relaxed', previewText ? 'text-fg' : 'italic text-subtle')}>
                    {previewText || t('donate.preview.empty')}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-4 p-5">
                <dl className="flex flex-col gap-2 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted">{t('donate.price')}</dt>
                    <dd className="font-display text-3xl font-semibold tabular-nums tracking-tight text-fg" aria-live="polite">{formatETB(price, { decimals: 0 })}</dd>
                  </div>
                  {creditUsed > 0 ? (
                    <div className="flex justify-between gap-3 text-muted">
                      <dt>{t('donate.payCredit')}</dt>
                      <dd className="tabular-nums">− {formatETB(creditUsed)}</dd>
                    </div>
                  ) : null}
                </dl>
                {price > 0 ? <p className="-mt-1 text-xs leading-relaxed text-subtle">{t('donate.fee', { fee: profile.platformFeePercent, net: formatETB(net) })}</p> : null}

                {submitError ? (
                  <p className={cn('flex items-start gap-1.5 text-sm font-medium', errorText)} role="alert">
                    <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
                    {submitError}
                  </p>
                ) : null}

                <Button type="submit" size="lg" fullWidth loading={submitting} disabled={!ready || !profile.live || !provider || walletShort} rightIcon={<Icon name="chevronRight" size={16} />}>
                  {payLabel}
                </Button>
                <p className="flex items-center justify-center gap-1.5 text-xs text-subtle">
                  <Icon name="shield" size={13} />
                  {t('donate.secure')}
                </p>
              </div>
            </Card>
          </aside>
        </form>
      </div>
    </ViewerLayout>
  );
}
