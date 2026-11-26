import { useEffect, useId, useState } from 'react';
import PropTypes from 'prop-types';
import { Input, Textarea, Tabs, cn, formatETB, Icon, useI18n } from '../../ui';
import { BOT_URL, KEEP_PERCENT, PRICING, SAMPLE_DONATIONS, priceForMessage } from './strings';
import { AlertCard, CtaLink } from './parts';

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

/** Hero visual: a mock stream frame whose alert cycles through sample donations. */
export function HeroStage() {
  const { t } = useI18n();
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduced) return undefined;
    const id = setInterval(() => setIndex((i) => (i + 1) % SAMPLE_DONATIONS.length), 3800);
    return () => clearInterval(id);
  }, [reduced]);

  const d = SAMPLE_DONATIONS[index];
  const next = SAMPLE_DONATIONS.slice(index + 1, index + 3).concat(SAMPLE_DONATIONS).slice(0, 2);

  return (
    <div className="relative" aria-hidden="true">
      <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-[radial-gradient(closest-side,rgba(242,183,5,0.22),transparent)] blur-2xl" />
      <div className="overflow-hidden rounded-[1.75rem] border border-line bg-[#0f0b08] p-2 shadow-overlay">
        <div className="relative overflow-hidden rounded-[1.25rem] bg-[radial-gradient(ellipse_at_30%_0%,rgba(7,137,48,0.35),transparent_55%),radial-gradient(ellipse_at_100%_100%,rgba(218,18,26,0.25),transparent_50%),linear-gradient(160deg,#1d1712,#0c0907)]">
          <div className="flex items-center justify-between px-4 pt-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-flag-red px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              {t('lp.alert.live')}
            </span>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/70 backdrop-blur">
              {t('lp.alert.overlay')}
            </span>
          </div>
          <div className="flex min-h-[19rem] flex-col justify-end p-4 sm:min-h-[22rem] sm:p-6">
            <AlertCard key={index} name={d.name} amount={d.amount} message={d.message} className="animate-ui-pop-in" />
            <div className="mt-3 flex flex-col gap-1.5">
              {next.map((n) => (
                <div key={n.name} className="flex items-center justify-between rounded-xl bg-white/[0.06] px-3 py-2 text-xs text-white/70">
                  <span className="truncate font-ethiopic">
                    <span className="font-semibold text-white/90">{n.name}</span> · {n.message}
                  </span>
                  <span className="ml-3 shrink-0 font-semibold tabular-nums text-flag-yellow">{n.amount} ETB</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Infinite ticker of sample donations. */
export function DonationTicker() {
  const { t } = useI18n();
  const items = [...SAMPLE_DONATIONS, ...SAMPLE_DONATIONS];
  return (
    <section aria-label={t('lp.ticker.label')} className="relative overflow-hidden border-y border-line bg-surface py-4">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-surface to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-surface to-transparent" />
      <ul className="flex w-max animate-marquee gap-3 hover:[animation-play-state:paused] motion-reduce:animate-none">
        {items.map((d, i) => (
          <li
            key={i}
            aria-hidden={i >= SAMPLE_DONATIONS.length || undefined}
            className="flex shrink-0 items-center gap-2.5 rounded-full border border-line bg-canvas px-4 py-2 text-sm"
          >
            <span className="font-semibold text-fg">{d.name}</span>
            <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-bold tabular-nums text-gold">{d.amount} ETB</span>
            <span className="max-w-[14rem] truncate font-ethiopic text-muted">{d.message}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "For viewers / For streamers" switcher. */
export function AudienceSwitcher() {
  const { t } = useI18n();
  const [who, setWho] = useState('viewers');
  const points = [1, 2, 3, 4].map((n) => t(`lp.who.${who}.${n}`, { keep: KEEP_PERCENT }));
  const icons = who === 'viewers' ? ['globe', 'wallet', 'checkCircle', 'mic'] : ['gift', 'layers', 'shield', 'chart'];

  return (
    <div>
      <Tabs
        variant="pill"
        label={t('lp.who.title')}
        value={who}
        onChange={setWho}
        items={[
          { value: 'viewers', label: t('lp.who.viewers'), icon: <Icon name="users" size={16} /> },
          { value: 'streamers', label: t('lp.who.streamers'), icon: <Icon name="mic" size={16} /> },
        ]}
      />
      <div key={who} className="mt-8 grid animate-ui-fade-in gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-center">
        <p className="font-display text-2xl font-semibold leading-snug text-fg sm:text-3xl">{t(`lp.who.${who}.headline`)}</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {points.map((p, i) => (
            <li key={p} className="flex gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
                <Icon name={icons[i]} size={18} />
              </span>
              <span className="text-sm leading-relaxed text-fg">{p}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Interactive demo: type a message, see the alert and the price. */
export function TryItDemo() {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [message, setMessage] = useState(null);
  const text = message ?? t('lp.demo.messageDefault');
  const count = Array.from(text).length;
  const price = priceForMessage(text);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.05fr] lg:gap-10">
      <div className="flex flex-col gap-5 rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-7">
        <Input
          label={t('lp.demo.name')}
          placeholder={t('lp.demo.namePlaceholder')}
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
        />
        <Textarea
          label={t('lp.demo.message')}
          value={text}
          rows={4}
          maxLength={PRICING.maxChars}
          onChange={(e) => setMessage(e.target.value)}
          hint={t('lp.demo.chars', { count, max: PRICING.maxChars })}
        />
        <div className="flex items-end justify-between gap-4 rounded-2xl bg-surface-2 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-subtle">{t('lp.demo.price')}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {t('lp.demo.priceHint', { base: PRICING.basePrice, step: PRICING.stepChars, inc: PRICING.incrementPrice })}
            </p>
          </div>
          <p className="shrink-0 font-display text-3xl font-bold tabular-nums text-fg" aria-live="polite">
            {price} <span className="text-base font-semibold text-muted">ETB</span>
          </p>
        </div>
        <CtaLink href={BOT_URL} external icon="chevronRight" className="w-full sm:w-auto sm:self-start">
          {t('lp.demo.send')}
        </CtaLink>
      </div>
      <div className="relative flex flex-col justify-end overflow-hidden rounded-3xl border border-line bg-[radial-gradient(ellipse_at_20%_0%,rgba(7,137,48,0.3),transparent_55%),linear-gradient(160deg,#1d1712,#0c0907)] p-5 sm:p-7">
        <span className="mb-auto self-start rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/70">
          {t('lp.alert.overlay')}
        </span>
        <AlertCard
          name={name.trim() || t('lp.demo.anonymous')}
          amount={price}
          message={text || '…'}
          className="mt-16"
        />
      </div>
    </div>
  );
}

function RangeField({ label, value, min, max, step, onChange, format }) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-fg">
          {label}
        </label>
        <output htmlFor={id} className="font-semibold tabular-nums text-fg">
          {format ? format(value) : value}
        </output>
      </div>
      <input
        id={id}
        data-ui=""
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-3 accent-[#F2B705] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-bright focus-visible:ring-offset-2 focus-visible:ring-offset-surface [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-gold-bright [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gold-bright [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(242,183,5,0.25)]"
        style={{ background: `linear-gradient(to right, #F2B705 ${pct}%, rgb(var(--ui-surface-3)) ${pct}%)` }}
      />
    </div>
  );
}

RangeField.propTypes = {
  label: PropTypes.node.isRequired,
  value: PropTypes.number.isRequired,
  min: PropTypes.number.isRequired,
  max: PropTypes.number.isRequired,
  step: PropTypes.number,
  onChange: PropTypes.func.isRequired,
  format: PropTypes.func,
};

/** Monthly earnings estimate from three sliders. */
export function EarningsCalculator() {
  const { t } = useI18n();
  const [perStream, setPerStream] = useState(15);
  const [avg, setAvg] = useState(60);
  const [streams, setStreams] = useState(12);

  const gross = perStream * avg * streams;
  const fee = Math.round(gross * PRICING.platformFeePercent) / 100;
  const net = gross - fee;
  const keepShare = KEEP_PERCENT;

  return (
    <div className="grid overflow-hidden rounded-3xl border border-line bg-surface shadow-card lg:grid-cols-[1.1fr_1fr]">
      <div className="flex flex-col gap-7 p-6 sm:p-8">
        <RangeField label={t('lp.earn.perStream')} value={perStream} min={1} max={100} step={1} onChange={setPerStream} />
        <RangeField
          label={t('lp.earn.avg')}
          value={avg}
          min={20}
          max={500}
          step={10}
          onChange={setAvg}
          format={(v) => formatETB(v, { decimals: 0 })}
        />
        <RangeField label={t('lp.earn.streams')} value={streams} min={1} max={30} step={1} onChange={setStreams} />
      </div>
      <div className="relative flex flex-col justify-between gap-6 overflow-hidden bg-[#17120d] p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold-bright/20 blur-3xl" aria-hidden="true" />
        <dl className="relative flex flex-col gap-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-white/65">{t('lp.earn.gross')}</dt>
            <dd className="font-semibold tabular-nums">{formatETB(gross, { decimals: 0 })}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-white/65">{t('lp.earn.fee', { fee: PRICING.platformFeePercent })}</dt>
            <dd className="tabular-nums text-white/65">− {formatETB(fee, { decimals: 0 })}</dd>
          </div>
        </dl>
        <div className="relative">
          <p className="text-sm text-white/65">{t('lp.earn.net')}</p>
          <p className="mt-1 font-display text-4xl font-bold tabular-nums text-gold-bright sm:text-5xl" aria-live="polite">
            {formatETB(net, { decimals: 0 })}
          </p>
          <div className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <span className="bg-gold-bright" style={{ width: `${keepShare}%` }} />
            <span className="flex-1 bg-white/25" />
          </div>
          <div className={cn('mt-2 flex justify-between text-xs text-white/55')}>
            <span>{keepShare}%</span>
            <span>{PRICING.platformFeePercent}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
