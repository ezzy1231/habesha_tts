import { useEffect, useId, useState } from 'react';
import PropTypes from 'prop-types';
import { Tabs, TabsIndicator, TabsList, TabsPanel, TabsTab } from '@ui-sdk/react/tabs';
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from '@ui-sdk/react/segmented-control';
import { Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack, SliderValue } from '@ui-sdk/react/slider';
import { cn, focusRing, Icon, Input, Textarea, useI18n } from '../../ui';
import { BOT_URL, KEEP_PERCENT, PRICING, priceForMessage, SAMPLE_DONATIONS } from './strings';
import { AlertCard, CtaLink, Equalizer, LiveChip, Panel, WindowFrame } from './parts';

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return undefined;
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

function useCycle(length, ms) {
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (reduced) return undefined;
    const id = setInterval(() => setIndex((i) => (i + 1) % length), ms);
    return () => clearInterval(id);
  }, [length, ms, reduced]);
  return index;
}

const etb = (n) => `ETB ${Math.round(n).toLocaleString('en-US')}`;

function Initial({ name, className }) {
  const hue = [...String(name)].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <span
      aria-hidden="true"
      className={cn('inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white', className)}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 45%), hsl(${(hue + 40) % 360} 70% 35%))` }}
    >
      {String(name).charAt(0)}
    </span>
  );
}

Initial.propTypes = { name: PropTypes.string.isRequired, className: PropTypes.string };

/** A stylised "stream" backdrop: dusk sky, mountains, sun. Pure CSS, decorative. */
function StreamScene({ className, children }) {
  return (
    <div className={cn('relative overflow-hidden bg-[#0b1020]', className)}>
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 55% at 70% 28%, rgba(245,190,30,0.55), transparent 60%), radial-gradient(70% 60% at 20% 10%, rgba(52,211,153,0.35), transparent 60%), linear-gradient(180deg, #14213d 0%, #3b1f4a 55%, #6b2b3a 100%)',
        }}
      />
      <div aria-hidden="true" className="absolute left-[64%] top-[22%] h-16 w-16 rounded-full bg-[#ffd27a] opacity-90 blur-[1px] sm:h-24 sm:w-24" />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[55%] bg-[#1d1630]"
        style={{ clipPath: 'polygon(0 55%, 12% 30%, 24% 48%, 38% 12%, 52% 42%, 63% 25%, 78% 50%, 90% 28%, 100% 45%, 100% 100%, 0 100%)' }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[38%] bg-[#0f0c1c]"
        style={{ clipPath: 'polygon(0 40%, 18% 62%, 33% 30%, 47% 58%, 60% 38%, 74% 66%, 88% 34%, 100% 55%, 100% 100%, 0 100%)' }}
      />
      <div aria-hidden="true" className="lp-noise absolute inset-0 opacity-[0.12] mix-blend-overlay" />
      {children}
    </div>
  );
}

StreamScene.propTypes = { className: PropTypes.string, children: PropTypes.node };

/** The hero product shot: an OBS-style window with a live alert, the queue and today's total. */
export function HeroStudio() {
  const { t } = useI18n();
  const index = useCycle(SAMPLE_DONATIONS.length, 3800);
  const current = SAMPLE_DONATIONS[index];
  const queue = [1, 2, 3].map((n) => SAMPLE_DONATIONS[(index + n) % SAMPLE_DONATIONS.length]);
  const bars = [38, 52, 44, 70, 58, 82, 66, 94, 76, 100];

  return (
    <div className="relative mx-auto mt-16 max-w-5xl sm:mt-20" aria-label={t('lp.alert.overlay')} role="img">
      <div
        aria-hidden="true"
        className="absolute -inset-x-10 -top-10 bottom-0 -z-10 rounded-[50%] bg-[radial-gradient(closest-side,rgba(52,211,153,0.28),transparent),radial-gradient(closest-side,rgba(245,190,30,0.18),transparent)] blur-2xl"
      />
      <div className="[perspective:2200px]">
        <div className="origin-top transition-transform duration-700 [transform:rotateX(8deg)] motion-reduce:[transform:none] lg:hover:[transform:rotateX(0deg)]">
          <WindowFrame
            title={t('lp.mock.window')}
            right={<span className="hidden text-[11px] text-white/40 sm:inline">1920 × 1080</span>}
            className="lp-ring-gradient"
          >
            <div className="grid lg:grid-cols-[1fr_250px]">
              <StreamScene className="aspect-[4/3] sm:aspect-video">
                <div className="absolute left-3 top-3 flex items-center gap-2 sm:left-4 sm:top-4">
                  <LiveChip />
                  <span className="rounded-md bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-white/85 backdrop-blur">
                    {t('lp.mock.viewers')}
                  </span>
                </div>
                <div className="absolute inset-x-3 bottom-3 sm:inset-x-auto sm:bottom-5 sm:left-5 sm:w-[min(400px,62%)]">
                  <AlertCard
                    key={index}
                    compact
                    name={current.name}
                    amount={current.amount}
                    message={current.message}
                    className="animate-ui-pop-in"
                  />
                </div>
              </StreamScene>
              <aside className="hidden flex-col border-l border-white/[0.07] bg-white/[0.02] p-4 lg:flex" aria-hidden="true">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">{t('lp.mock.queue')}</p>
                <ul className="mt-3 flex flex-col gap-2">
                  {queue.map((d, i) => (
                    <li
                      key={`${d.name}-${i}`}
                      className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.03] p-2"
                      style={{ opacity: 1 - i * 0.22 }}
                    >
                      <Initial name={d.name} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-white/90">{d.name}</span>
                        <span className="block truncate font-ethiopic text-[11px] text-white/45">{d.message}</span>
                      </span>
                      <span className="text-xs font-bold tabular-nums text-gold-bright">{d.amount}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto rounded-xl border border-white/[0.06] bg-gradient-to-b from-emerald-400/10 to-transparent p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">{t('lp.mock.today')}</p>
                  <p className="mt-1 font-display text-2xl font-bold tabular-nums text-white">ETB 4,860</p>
                  <div className="mt-3 flex h-10 items-end gap-1">
                    {bars.map((h, i) => (
                      <span
                        key={i}
                        className="flex-1 rounded-sm bg-gradient-to-t from-emerald-500/40 to-emerald-300"
                        style={{ height: `${h}%`, opacity: 0.45 + i * 0.055 }}
                      />
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          </WindowFrame>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="absolute -left-4 top-[18%] hidden animate-float-slow items-center gap-3 rounded-2xl border border-line bg-surface/90 p-3 pr-4 shadow-xl backdrop-blur-xl motion-reduce:animate-none md:flex xl:-left-16"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
          <Icon name="checkCircle" size={18} />
        </span>
        <span>
          <span className="block text-xs font-semibold text-fg">{t('lp.mock.paid')}</span>
          <span className="block text-[11px] text-muted">Telebirr · ETB {current.amount}</span>
        </span>
      </div>
      <div
        aria-hidden="true"
        className="absolute -right-4 bottom-[22%] hidden animate-float-slow items-center gap-3 rounded-2xl border border-line bg-surface/90 p-3 pr-4 shadow-xl backdrop-blur-xl [animation-delay:1.5s] motion-reduce:animate-none md:flex xl:-right-14"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-bright/15 text-gold">
          <Icon name="mic" size={18} />
        </span>
        <span>
          <span className="block text-xs font-semibold text-fg">{t('lp.mock.voice')}</span>
          <Equalizer bars={14} className="mt-1 h-3" barClassName="bg-gold" />
        </span>
      </div>
    </div>
  );
}

/** Endless marquee of sample donations. Pauses on hover. */
export function DonationTicker() {
  const { t } = useI18n();
  const items = [...SAMPLE_DONATIONS, ...SAMPLE_DONATIONS];
  return (
    <section aria-label={t('lp.ticker.label')} className="relative border-y border-line bg-surface/40 py-4">
      <div className="group overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)]">
        <ul className="flex w-max animate-marquee gap-3 group-hover:[animation-play-state:paused] motion-reduce:animate-none">
          {items.map((d, i) => (
            <li
              key={`${d.name}-${i}`}
              aria-hidden={i >= SAMPLE_DONATIONS.length || undefined}
              className="flex items-center gap-2.5 whitespace-nowrap rounded-full border border-line bg-surface py-1.5 pl-1.5 pr-4 text-sm"
            >
              <Initial name={d.name} />
              <span className="font-semibold text-fg">{d.name}</span>
              <span className="font-bold tabular-nums text-gold">ETB {d.amount}</span>
              <span className="font-ethiopic text-muted">{d.message}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function CheckRow({ children }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500" aria-hidden="true">
        <Icon name="check" size={14} strokeWidth={3} />
      </span>
      <span className="text-[15px] leading-relaxed text-fg/90">{children}</span>
    </li>
  );
}

CheckRow.propTypes = { children: PropTypes.node };

/** Phone mockup of the viewer's donation form. */
function ViewerMock() {
  const { t } = useI18n();
  return (
    <div className="relative mx-auto w-full max-w-[300px]" aria-hidden="true">
      <div className="rounded-[2.4rem] border border-line-strong bg-[#0b0e0c] p-2.5 shadow-2xl">
        <div className="overflow-hidden rounded-[1.9rem] bg-[#111512] text-white">
          <div className="mx-auto mt-2 h-5 w-24 rounded-full bg-black" />
          <div className="p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-700 font-ethiopic text-sm font-bold">
                ኤ
              </span>
              <span>
                <span className="block text-sm font-bold">@ermias_live</span>
                <span className="flex items-center gap-1.5 text-[11px] text-white/50">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> {t('lp.alert.live')}
                </span>
              </span>
            </div>
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
              <p className="text-[11px] text-white/45">{t('lp.demo.message')}</p>
              <p className="mt-1 font-ethiopic text-sm leading-relaxed">ሰላም ከአዲስ አበባ! ቀጥል 💚</p>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] font-semibold">
              {['Telebirr', 'Chapa', 'Arifpay'].map((p, i) => (
                <span
                  key={p}
                  className={cn('rounded-xl border py-2', i === 0 ? 'border-gold-bright/70 bg-gold-bright/10 text-gold-bright' : 'border-white/10 text-white/60')}
                >
                  {p}
                </span>
              ))}
            </div>
            <div className="mt-5 flex h-11 items-center justify-center rounded-full bg-gradient-to-b from-[#ffd24d] to-[#f2b705] text-sm font-bold text-[#16130a]">
              {t('lp.mock.donate')} · ETB 20
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Dashboard card mockup for streamers. */
function StreamerMock() {
  const { t } = useI18n();
  const week = [30, 55, 40, 75, 60, 90, 70];
  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden="true">
      <Panel className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-subtle">{t('lp.mock.balance')}</p>
            <p className="mt-1 font-display text-4xl font-bold tabular-nums tracking-tight text-fg">ETB 12,480</p>
          </div>
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-500">+18%</span>
        </div>
        <div className="mt-6 flex h-28 items-end gap-2">
          {week.map((h, i) => (
            <span
              key={i}
              className={cn('flex-1 rounded-lg', i === 5 ? 'bg-gradient-to-t from-[#f2b705] to-[#ffd24d]' : 'bg-surface-3')}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-subtle">
          {t('lp.mock.week')} · {t('lp.mock.sample')}
        </p>
        <div className="mt-5 flex items-center justify-between rounded-2xl border border-line bg-surface-2 p-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-fg">
            <Icon name="wallet" size={16} className="text-gold" /> Telebirr
          </span>
          <span className="rounded-full bg-fg px-3 py-1.5 text-xs font-bold text-canvas">{t('lp.mock.payout')}</span>
        </div>
      </Panel>
    </div>
  );
}

const AUDIENCES = [
  { value: 'viewers', prefix: 'lp.who.viewers', Mock: ViewerMock },
  { value: 'streamers', prefix: 'lp.who.streamers', Mock: StreamerMock },
];

/** Viewers / streamers tabs (ui-sdk Tabs with a sliding indicator). */
export function AudienceTabs() {
  const { t } = useI18n();
  return (
    <Tabs defaultValue="viewers" className="mt-10">
      <TabsList aria-label={t('lp.who.title')} className="relative mx-auto flex w-fit rounded-full border border-line bg-surface p-1">
        <TabsIndicator className="rounded-full bg-fg shadow-sm" />
        {AUDIENCES.map(({ value, prefix }) => (
          <TabsTab
            key={value}
            value={value}
            className={cn(
              'relative z-10 rounded-full px-5 py-2.5 text-sm font-semibold text-muted transition-colors duration-200 hover:text-fg data-[selected]:text-canvas sm:px-7',
              focusRing,
            )}
          >
            {t(prefix)}
          </TabsTab>
        ))}
      </TabsList>
      {AUDIENCES.map(({ value, prefix, Mock }) => (
        <TabsPanel key={value} value={value} className="mt-12 animate-ui-fade-in focus:outline-none">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h3 className="text-balance font-display text-2xl font-bold tracking-tight text-fg sm:text-3xl">{t(`${prefix}.headline`)}</h3>
              <ul className="mt-7 flex flex-col gap-4">
                {[1, 2, 3, 4].map((k) => (
                  <CheckRow key={k}>{t(`${prefix}.${k}`, { keep: KEEP_PERCENT })}</CheckRow>
                ))}
              </ul>
            </div>
            <Mock />
          </div>
        </TabsPanel>
      ))}
    </Tabs>
  );
}

const PRESETS = ['am', 'en', 'mix'];
const PRESET_KEYS = { am: 'lp.demo.messageDefault', en: 'lp.demo.sample.en', mix: 'lp.demo.sample.mix' };

/** Live demo: write a message, see the price and the alert update. */
export function TryItDemo() {
  const { t } = useI18n();
  const [preset, setPreset] = useState('am');
  const [name, setName] = useState('');
  const [message, setMessage] = useState(() => t(PRESET_KEYS.am));
  const nameId = useId();
  const messageId = useId();
  const price = priceForMessage(message);
  const count = Array.from(message).length;

  return (
    <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <Panel className="p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-subtle">{t('lp.demo.preset')}</p>
        <SegmentedControl
          aria-label={t('lp.demo.preset')}
          value={preset}
          onValueChange={(v) => {
            if (!v) return;
            setPreset(v);
            setMessage(t(PRESET_KEYS[v]));
          }}
          className="relative isolate mt-3 inline-flex rounded-full border border-line bg-surface-2 p-1"
        >
          <SegmentedControlIndicator className="rounded-full bg-surface shadow-[0_1px_3px_rgb(0_0_0/0.2)] ring-1 ring-line" />
          {PRESETS.map((k) => (
            <SegmentedControlItem
              key={k}
              value={k}
              className={cn('rounded-full px-4 py-1.5 text-sm font-semibold text-muted transition-colors data-[checked]:text-fg', focusRing)}
            >
              {t(`lp.demo.preset.${k}`)}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>

        <div className="mt-6 flex flex-col gap-5">
          <div>
            <label htmlFor={nameId} className="text-sm font-semibold text-fg">
              {t('lp.demo.name')}
            </label>
            <Input
              id={nameId}
              value={name}
              maxLength={40}
              placeholder={t('lp.demo.namePlaceholder')}
              onChange={(e) => setName(e.target.value)}
              className="mt-2"
            />
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor={messageId} className="text-sm font-semibold text-fg">
                {t('lp.demo.message')}
              </label>
              <span className="text-xs tabular-nums text-subtle">{t('lp.demo.chars', { count, max: PRICING.maxChars })}</span>
            </div>
            <Textarea
              id={messageId}
              rows={4}
              value={message}
              maxLength={PRICING.maxChars}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-2 font-ethiopic"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-line bg-surface-2 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-subtle">{t('lp.demo.price')}</p>
            <p className="mt-1 font-display text-3xl font-bold tabular-nums text-fg" aria-live="polite">
              {etb(price)}
            </p>
          </div>
          <p className="max-w-[16rem] text-xs leading-relaxed text-muted">
            {t('lp.demo.priceHint', { base: PRICING.basePrice, step: PRICING.stepChars, inc: PRICING.incrementPrice })}
          </p>
        </div>
        <CtaLink href={BOT_URL} external icon="chevronRight" className="mt-6 w-full">
          {t('lp.demo.send')}
        </CtaLink>
      </Panel>

      <WindowFrame title={t('lp.alert.overlay')} right={<LiveChip />} className="flex flex-col">
        <StreamScene className="flex min-h-[320px] flex-1 items-end p-4 sm:p-6">
          <AlertCard
            name={name.trim() || t('lp.demo.anonymous')}
            amount={price}
            message={message || '…'}
            className="relative w-full max-w-md"
          />
        </StreamScene>
      </WindowFrame>
    </div>
  );
}

function SliderRow({ label, value, onChange, min, max, step = 1, format }) {
  return (
    <Slider value={value} onValueChange={onChange} min={min} max={max} step={step} format={format} locale="en-US">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-muted">{label}</span>
        <SliderValue className="font-display text-lg font-bold tabular-nums text-fg" />
      </div>
      <SliderControl className="relative mt-1 flex h-8 cursor-pointer touch-none items-center">
        <SliderTrack className="relative h-2 w-full rounded-full bg-surface-3">
          <SliderIndicator className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-gold-bright" />
          <SliderThumb
            aria-label={label}
            className="h-6 w-6 rounded-full border-[3px] border-gold-bright bg-white shadow-[0_4px_12px_rgb(0_0_0/0.3)] transition-transform data-[dragging]:scale-110"
          />
        </SliderTrack>
      </SliderControl>
    </Slider>
  );
}

SliderRow.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
  min: PropTypes.number.isRequired,
  max: PropTypes.number.isRequired,
  step: PropTypes.number,
  format: PropTypes.object,
};

const ETB_FORMAT = { style: 'currency', currency: 'ETB', currencyDisplay: 'code', maximumFractionDigits: 0 };

/** Earnings estimate with three ui-sdk sliders. */
export function EarningsCalculator() {
  const { t } = useI18n();
  const [perStream, setPerStream] = useState(15);
  const [avg, setAvg] = useState(60);
  const [streams, setStreams] = useState(12);
  const gross = perStream * avg * streams;
  const fee = (gross * PRICING.platformFeePercent) / 100;
  const net = gross - fee;

  return (
    <div className="mt-12 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <Panel className="flex flex-col justify-center gap-7 p-6 sm:p-8">
        <SliderRow label={t('lp.earn.perStream')} value={perStream} onChange={setPerStream} min={1} max={100} />
        <SliderRow label={t('lp.earn.avg')} value={avg} onChange={setAvg} min={20} max={500} step={10} format={ETB_FORMAT} />
        <SliderRow label={t('lp.earn.streams')} value={streams} onChange={setStreams} min={1} max={30} />
      </Panel>

      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0b0e0c] p-6 text-white sm:p-8">
        <div aria-hidden="true" className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(245,190,30,0.35),transparent)]" />
        <div aria-hidden="true" className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(52,211,153,0.25),transparent)]" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/50">{t('lp.earn.net')}</p>
          <p className="mt-2 font-display text-5xl font-extrabold tabular-nums tracking-tight sm:text-6xl" aria-live="polite">
            <span className="lp-text-gradient">{etb(net)}</span>
          </p>
          <dl className="mt-8 flex flex-col gap-3 text-sm">
            <div className="flex justify-between border-b border-white/10 pb-3">
              <dt className="text-white/60">{t('lp.earn.gross')}</dt>
              <dd className="font-semibold tabular-nums">{etb(gross)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-white/60">{t('lp.earn.fee', { fee: PRICING.platformFeePercent })}</dt>
              <dd className="font-semibold tabular-nums text-white/70">− {etb(fee)}</dd>
            </div>
          </dl>
          <div className="mt-6 flex h-3 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <span className="bg-gradient-to-r from-emerald-400 to-gold-bright" style={{ width: `${KEEP_PERCENT}%` }} />
            <span className="flex-1 bg-white/25" />
          </div>
          <div className="mt-2 flex justify-between text-[11px] font-semibold text-white/50" aria-hidden="true">
            <span>{KEEP_PERCENT}%</span>
            <span>{PRICING.platformFeePercent}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
