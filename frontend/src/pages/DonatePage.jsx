import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useParams } from 'react-router-dom';
import {
  Avatar, Badge, Button, Card, EmptyState, Icon, Input, Select, Skeleton, Tabs, Textarea, cn, focusRing, formatETB, useI18n,
} from '../ui';
import { ViewerLayout } from '../components/viewer/ViewerLayout';
import { ApiError, looksLikeYouTube, messageLength, priceForTts, publicApi, usdFor } from '../lib/publicApi';
import '../lib/viewerStrings';

const NAME_KEY = 'habesha.donorName';
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
      <legend className="mb-2 text-sm font-medium text-fg">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors',
              value === o.value ? 'border-brand-500 bg-brand-500/10 text-fg' : 'border-line hover:border-line-strong text-muted',
            )}
          >
            <input
              type="radio"
              className="h-4 w-4 accent-[#078930]"
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              name={label}
            />
            <span className="flex-1 font-medium text-fg">{o.label}</span>
            {o.badge}
          </label>
        ))}
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

function Header({ s }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-4">
      <Avatar src={s.avatarUrl} name={s.name} size="xl" status={s.live ? 'live' : 'offline'} />
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-bold tracking-tight text-fg sm:text-3xl">{s.name}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
          {s.live ? <Badge variant="danger" dot pulse>{t('dir.liveNow')}</Badge> : <Badge>{t('dir.offline')}</Badge>}
          <span>@{s.slug}</span>
          {s.socialLink ? (
            <a href={s.socialLink} target="_blank" rel="noreferrer nofollow" className="underline-offset-2 hover:text-fg hover:underline">
              {new URL(s.socialLink).hostname.replace(/^www\./, '')}
            </a>
          ) : null}
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
        <div className="mx-auto max-w-2xl px-4 py-10">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="mt-6 h-96 w-full rounded-xl" />
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
    if (!ready || submitting || !provider) return;
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

  const providerOptions = profile.providers.map((p) => ({
    value: p.name,
    label: p.name === 'demo' ? t('donate.demo') : p.label,
    badge: p.name === 'demo' ? <Badge variant="warning" size="sm">{t('donate.demo')}</Badge>
      : p.test ? <Badge variant="info" size="sm">{t('donate.test')}</Badge> : null,
  }));

  return (
    <ViewerLayout>
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <Link to="/streamers" className={cn('mb-6 inline-flex items-center gap-1 rounded text-sm text-muted hover:text-fg', focusRing)}>
          <Icon name="chevronLeft" size={16} />
          {t('donate.back')}
        </Link>
        <Header s={profile} />

        {!profile.live ? (
          <div className="mt-6 flex items-start gap-2 rounded-lg border border-line bg-surface-2 p-3 text-sm text-muted" role="status">
            <Icon name="info" size={18} className="mt-0.5 shrink-0" />
            {t('donate.offline')}
          </div>
        ) : null}

        <Card className="mt-6" padding="none">
          <form onSubmit={submit} noValidate>
            {tabs.length > 1 ? (
              <div className="px-5 pt-4 sm:px-6">
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
                    rows={4}
                    value={message}
                    required
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
                  <p className="rounded-lg bg-surface-2 p-3 text-sm text-muted">{t('donate.media.rules', { max: media.maxSeconds })}</p>
                  <Input
                    label={t('donate.media.url')}
                    placeholder={t('donate.media.urlPh')}
                    inputMode="url"
                    value={mediaUrl}
                    required
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

            <div className="flex flex-col gap-5 border-t border-line p-5 sm:p-6">
              {profile.providers.length ? (
                <ChoiceGroup label={t('donate.payWith')} options={providerOptions} value={provider} onChange={setProvider} />
              ) : (
                <p className="text-sm text-[#e5484d]" role="alert">{t('donate.noProviders')}</p>
              )}
              {provider === 'demo' ? <p className="-mt-3 text-xs text-muted">{t('donate.demoHint')}</p> : null}

              {usdAvailable ? (
                <ChoiceGroup
                  label={t('donate.currency')}
                  options={[{ value: 'ETB', label: 'ETB · ብር' }, { value: 'USD', label: 'USD · card' }]}
                  value={currency}
                  onChange={setCurrency}
                />
              ) : null}

              <details className="group" open={Boolean(claimCode)}>
                <summary className={cn('cursor-pointer select-none rounded text-sm font-medium text-muted hover:text-fg', focusRing)}>
                  {t('donate.claim')}
                </summary>
                <div className="mt-3 flex items-end gap-2">
                  <Input
                    className="flex-1"
                    aria-label={t('donate.claim')}
                    placeholder={t('donate.claimPh')}
                    value={claimCode}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(e) => { setClaimCode(e.target.value.toUpperCase()); setCredit(null); setCreditMsg(null); }}
                  />
                  <Button type="button" variant="secondary" loading={checkingCredit} disabled={!claimCode.trim()} onClick={checkCredit}>
                    {t('donate.claimCheck')}
                  </Button>
                </div>
                {creditMsg ? <p className="mt-2 text-sm text-muted" role="status">{creditMsg}</p> : null}
              </details>

              <div className="rounded-lg bg-surface-2 p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted">{t('donate.price')}</span>
                  <span className="text-2xl font-bold tabular-nums text-fg" aria-live="polite">{formatETB(price, { decimals: 0 })}</span>
                </div>
                {creditUsed > 0 ? (
                  <div className="mt-1 flex justify-between text-sm text-muted">
                    <span>{t('donate.payCredit')}</span>
                    <span className="tabular-nums">− {formatETB(creditUsed)}</span>
                  </div>
                ) : null}
                {price > 0 ? (
                  <p className="mt-2 text-xs text-muted">{t('donate.fee', { fee: profile.platformFeePercent, net: formatETB(net) })}</p>
                ) : null}
              </div>

              {submitError ? (
                <p className="flex items-center gap-1.5 text-sm font-medium text-[#e5484d]" role="alert">
                  <Icon name="alert" size={16} />
                  {submitError}
                </p>
              ) : null}

              <Button type="submit" size="lg" fullWidth loading={submitting} disabled={!ready || !profile.live || !provider}>
                {payLabel}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </ViewerLayout>
  );
}
