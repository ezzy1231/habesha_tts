import PropTypes from 'prop-types';
import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, AccordionTrigger } from '@ui-sdk/react/accordion';
import { cn, focusRing, Icon, useI18n } from '../ui';
import { BOT_URL, KEEP_PERCENT, PRICING } from './landing/strings';
import { CtaLink, Equalizer, Panel, SectionHeader } from './landing/parts';
import { LandingFooter, LandingHeader } from './landing/chrome';
import { AudienceTabs, DonationTicker, EarningsCalculator, HeroStudio, TryItDemo } from './landing/interactive';

/*
 * Public landing page — "studio" theme (.theme-studio in src/index.css).
 * Interactive parts (tabs, segmented control, sliders, accordion, mobile
 * drawer) are ui-sdk components styled with Tailwind.
 */

function Section({ id, labelledBy, className, children }) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={cn('mx-auto max-w-6xl scroll-mt-24 px-4 py-24 sm:px-6 sm:py-32', className)}>
      {children}
    </section>
  );
}

Section.propTypes = { id: PropTypes.string, labelledBy: PropTypes.string, className: PropTypes.string, children: PropTypes.node };

/** Aurora + grid + grain behind the hero and the final CTA. */
function Backdrop({ className }) {
  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <div className="lp-grid absolute inset-0" />
      <div className="absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-emerald-500/20 blur-[120px] dark:bg-emerald-500/25" />
      <div className="absolute -right-32 -top-24 h-[30rem] w-[30rem] rounded-full bg-amber-400/20 blur-[120px]" />
      <div className="absolute left-1/2 top-[40%] h-[20rem] w-[40rem] -translate-x-1/2 rounded-full bg-rose-500/10 blur-[120px]" />
      <div className="lp-noise absolute inset-0 opacity-[0.05] mix-blend-overlay dark:opacity-[0.08]" />
    </div>
  );
}

Backdrop.propTypes = { className: PropTypes.string };

function Hero() {
  const { t } = useI18n();
  const stats = [
    { value: t('lp.hero.stat1.value', { keep: KEEP_PERCENT }), label: t('lp.hero.stat1.label') },
    { value: t('lp.hero.stat2.value', { price: PRICING.basePrice }), label: t('lp.hero.stat2.label') },
    { value: t('lp.hero.stat3.value'), label: t('lp.hero.stat3.label') },
  ];
  return (
    <section aria-labelledby="hero-title" className="relative -mt-[4.25rem] overflow-hidden pb-20 pt-32 sm:pb-28 sm:pt-40">
      <Backdrop />
      <div className="relative mx-auto max-w-6xl px-4 text-center sm:px-6">
        <a
          href="#demo"
          className={cn(
            'inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 py-1 pl-1 pr-3 text-xs font-medium text-muted backdrop-blur transition-colors hover:text-fg sm:text-sm',
            focusRing,
          )}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500 motion-reduce:animate-none" aria-hidden="true" />
            {t('lp.hero.badgeLead')}
          </span>
          {t('lp.hero.badge')}
          <Icon name="chevronRight" size={14} />
        </a>

        <h1
          id="hero-title"
          className="mx-auto mt-8 max-w-4xl text-balance font-display text-[2.6rem] font-extrabold leading-[1.02] tracking-[-0.045em] text-fg sm:text-6xl lg:text-[5.25rem] [&:lang(am)]:leading-[1.15] [&:lang(am)]:tracking-[-0.01em]"
        >
          {t('lp.hero.title.a')} <span className="lp-text-gradient">{t('lp.hero.title.b')}</span> {t('lp.hero.title.c')}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted sm:text-lg">
          {t('lp.hero.body', { keep: KEEP_PERCENT })}
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <CtaLink href={BOT_URL} external icon="chevronRight" className="w-full sm:w-auto">
            {t('lp.cta.start')}
          </CtaLink>
          <CtaLink href="#demo" variant="secondary" className="w-full sm:w-auto">
            {t('lp.cta.demo')}
          </CtaLink>
        </div>

        <dl className="mx-auto mt-12 grid max-w-xl grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-surface/60 backdrop-blur">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col-reverse px-3 py-4">
              <dt className="mt-1 text-[11px] font-medium text-muted sm:text-xs">{s.label}</dt>
              <dd className="font-display text-xl font-bold tabular-nums tracking-tight text-fg sm:text-2xl">{s.value}</dd>
            </div>
          ))}
        </dl>

        <HeroStudio />
      </div>
    </section>
  );
}

/* ── Feature visuals (decorative mini-UIs) ─────────────────────── */

function VisualFrame({ className, children }) {
  return (
    <div aria-hidden="true" className={cn('relative overflow-hidden rounded-2xl border border-line bg-surface-2', className)}>
      {children}
    </div>
  );
}

VisualFrame.propTypes = { className: PropTypes.string, children: PropTypes.node };

function OverlayVisual() {
  const { t } = useI18n();
  const sources = [
    { name: 'Habesha TTS', type: t('lp.mock.browserSource'), on: true },
    { name: 'Webcam', type: 'Video Capture', on: true },
    { name: 'Game', type: 'Game Capture', on: true },
  ];
  return (
    <VisualFrame className="grid h-full min-h-[220px] grid-cols-[1fr_1.1fr]">
      <div className="border-r border-line p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-subtle">{t('lp.mock.sources')}</p>
        <ul className="mt-3 flex flex-col gap-1.5">
          {sources.map((s, i) => (
            <li
              key={s.name}
              className={cn(
                'flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs',
                i === 0 ? 'bg-gold-bright/15 font-semibold text-fg ring-1 ring-gold-bright/40' : 'text-muted',
              )}
            >
              <Icon name={i === 0 ? 'mic' : i === 1 ? 'eye' : 'layers'} size={13} />
              <span className="min-w-0 flex-1 truncate">{s.name}</span>
              <span className="hidden truncate text-[10px] text-subtle sm:inline">{s.type}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-dashed border-line-strong px-2.5 py-2 text-[11px] text-subtle">
          <Icon name="copy" size={12} />
          <span className="truncate">habeshatts.com/overlay/••••</span>
        </div>
      </div>
      <div className="relative bg-[#0f0c1c]">
        <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_70%_20%,rgba(245,190,30,0.4),transparent),linear-gradient(180deg,#14213d,#3b1f4a)]" />
        <div className="absolute inset-x-3 bottom-3 rounded-xl border border-white/15 bg-black/60 p-2.5 text-white backdrop-blur">
          <div className="mb-1.5 flex h-0.5 overflow-hidden rounded-full">
            <span className="flex-1 bg-flag-green" />
            <span className="flex-1 bg-flag-yellow" />
            <span className="flex-1 bg-flag-red" />
          </div>
          <p className="text-[11px] font-bold text-flag-yellow">
            Meron <span className="font-display text-white">500 ETB</span>
          </p>
          <p className="truncate font-ethiopic text-[10px] text-white/80">እንኳን ደስ አለህ! 💚💛❤️</p>
        </div>
      </div>
    </VisualFrame>
  );
}

function VoiceVisual() {
  return (
    <VisualFrame className="flex h-44 flex-col items-center justify-center gap-4">
      <span className="rounded-2xl rounded-bl-sm bg-fg px-4 py-2 font-ethiopic text-lg font-bold text-canvas shadow-lg">ሰላም ጤና ይስጥልኝ 👋</span>
      <Equalizer bars={28} className="h-8" barClassName="bg-gradient-to-t from-emerald-500 to-gold-bright" />
    </VisualFrame>
  );
}

function PaymentsVisual() {
  const { t } = useI18n();
  const rows = [
    { name: 'Telebirr', amount: 200 },
    { name: 'Chapa', amount: 50 },
    { name: 'Arifpay', amount: 100 },
  ];
  return (
    <VisualFrame className="flex h-44 flex-col justify-center gap-2 p-4">
      {rows.map((r, i) => (
        <div key={r.name} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2" style={{ opacity: 1 - i * 0.18 }}>
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-3 text-[11px] font-bold text-fg">{r.name.charAt(0)}</span>
          <span className="flex-1 text-sm font-semibold text-fg">{r.name}</span>
          <span className="text-xs font-bold tabular-nums text-gold">+{r.amount}</span>
          {i === 0 ? (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-500">
              <Icon name="checkCircle" size={12} />
              <span className="hidden sm:inline">{t('lp.mock.paid')}</span>
            </span>
          ) : null}
        </div>
      ))}
    </VisualFrame>
  );
}

function ModerationVisual() {
  const { t } = useI18n();
  const rules = [
    { label: t('lp.mock.rules.min'), on: true },
    { label: t('lp.mock.rules.filter'), on: true },
    { label: t('lp.mock.rules.block'), on: false },
  ];
  return (
    <VisualFrame className="flex h-44 flex-col justify-center gap-2 p-4">
      {rules.map((r) => (
        <div key={r.label} className="flex items-center justify-between rounded-xl border border-line bg-surface px-3 py-2.5">
          <span className="text-sm font-medium text-fg">{r.label}</span>
          <span className={cn('flex h-5 w-9 items-center rounded-full p-0.5 transition-colors', r.on ? 'bg-emerald-500' : 'bg-surface-3')}>
            <span className={cn('h-4 w-4 rounded-full bg-white shadow', r.on && 'translate-x-4')} />
          </span>
        </div>
      ))}
    </VisualFrame>
  );
}

function AnalyticsVisual() {
  const points = [20, 34, 28, 46, 40, 62, 55, 74, 68, 88];
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${(i / (points.length - 1)) * 100} ${100 - p}`).join(' ');
  return (
    <VisualFrame className="h-44 p-4">
      <p className="font-display text-2xl font-bold tabular-nums text-fg">ETB 9,720</p>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-24 w-full">
        <defs>
          <linearGradient id="lp-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${d} L 100 100 L 0 100 Z`} fill="url(#lp-area)" />
        <path d={d} fill="none" stroke="#34d399" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
    </VisualFrame>
  );
}

function FeatureCard({ title, body, visual, className, soon }) {
  const { t } = useI18n();
  return (
    <Panel className={cn('group flex flex-col p-3 transition-colors hover:border-line-strong', className)}>
      <div className="flex-1">{visual}</div>
      <div className="p-3 pt-5">
        <h3 className="flex flex-wrap items-center gap-2 font-display text-lg font-bold tracking-tight text-fg">
          {title}
          {soon ? (
            <span className="rounded-full border border-line-strong px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
              {t('lp.soon')}
            </span>
          ) : null}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
      </div>
    </Panel>
  );
}

FeatureCard.propTypes = {
  title: PropTypes.node.isRequired,
  body: PropTypes.node,
  visual: PropTypes.node,
  className: PropTypes.string,
  soon: PropTypes.bool,
};

function Features() {
  const { t } = useI18n();
  const soon = [
    { key: 'soundboard', icon: 'music' },
    { key: 'media', icon: 'film' },
  ];
  return (
    <Section id="features" labelledBy="features-title">
      <SectionHeader id="features-title" eyebrow={t('lp.features.eyebrow')} title={t('lp.features.title')} center />
      <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <FeatureCard
          className="md:col-span-2 lg:col-span-4"
          visual={<OverlayVisual />}
          title={t('lp.f.overlay.title')}
          body={t('lp.f.overlay.body')}
        />
        <FeatureCard className="lg:col-span-2" visual={<VoiceVisual />} title={t('lp.f.voices.title')} body={t('lp.f.voices.body')} />
        <FeatureCard className="lg:col-span-2" visual={<PaymentsVisual />} title={t('lp.f.payments.title')} body={t('lp.f.payments.body')} />
        <FeatureCard className="lg:col-span-2" visual={<ModerationVisual />} title={t('lp.f.moderation.title')} body={t('lp.f.moderation.body')} />
        <FeatureCard
          className="md:col-span-2 lg:col-span-2"
          visual={<AnalyticsVisual />}
          title={t('lp.f.analytics.title')}
          body={t('lp.f.analytics.body')}
        />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {soon.map(({ key, icon }) => (
          <div key={key} className="flex items-start gap-4 rounded-3xl border border-dashed border-line-strong p-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-muted" aria-hidden="true">
              <Icon name={icon} size={20} />
            </span>
            <div>
              <h3 className="flex flex-wrap items-center gap-2 font-display text-lg font-bold tracking-tight text-fg">
                {t(`lp.f.${key}.title`)}
                <span className="rounded-full border border-line-strong px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                  {t('lp.soon')}
                </span>
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{t(`lp.f.${key}.body`)}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Setup() {
  const { t } = useI18n();
  const steps = [1, 2, 3, 4];
  return (
    <Section id="setup" labelledBy="setup-title">
      <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
        <SectionHeader id="setup-title" eyebrow={t('lp.setup.eyebrow')} title={t('lp.setup.title')} />
        <CtaLink href={BOT_URL} external icon="chevronRight" size="md" className="shrink-0">
          {t('lp.cta.start')}
        </CtaLink>
      </div>
      <ol className="relative mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <span
          aria-hidden="true"
          className="absolute left-8 right-8 top-[2.35rem] hidden h-px bg-gradient-to-r from-emerald-400/60 via-gold-bright/60 to-rose-400/50 lg:block"
        />
        {steps.map((n) => (
          <li key={n} className="relative">
            <Panel className="h-full p-6">
              <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border border-line-strong bg-canvas font-display text-sm font-bold text-fg">
                {String(n).padStart(2, '0')}
              </span>
              <h3 className="mt-6 font-display text-lg font-bold tracking-tight text-fg">{t(`lp.setup.${n}.title`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{t(`lp.setup.${n}.body`)}</p>
            </Panel>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function Faq() {
  const { t } = useI18n();
  const items = [1, 2, 3, 4, 5, 6];
  return (
    <Section id="faq" labelledBy="faq-title">
      <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeader id="faq-title" eyebrow={t('lp.faq.eyebrow')} title={t('lp.faq.title')} />
          <a
            href={BOT_URL}
            target="_blank"
            rel="noreferrer"
            className={cn('mt-8 flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong', focusRing)}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/15 text-sky-500" aria-hidden="true">
              <Icon name="info" size={20} />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-semibold text-fg">{t('lp.footer.telegram')}</span>
              <span className="block text-xs text-muted">@HabeshaTTS_bot</span>
            </span>
            <Icon name="chevronRight" size={16} className="text-subtle" />
          </a>
        </div>
        <Accordion defaultValue={['1']} className="flex flex-col gap-3">
          {items.map((n) => (
            <AccordionItem
              key={n}
              value={String(n)}
              className="rounded-2xl border border-line bg-surface transition-colors has-[[data-open]]:border-line-strong has-[[data-open]]:bg-surface-2/60"
            >
              <AccordionHeader className="m-0">
                <AccordionTrigger
                  className={cn(
                    'group/q flex w-full items-center justify-between gap-4 rounded-2xl px-5 py-5 text-left text-base font-semibold text-fg sm:px-6',
                    focusRing,
                  )}
                >
                  {t(`lp.faq.${n}.q`)}
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-canvas text-muted transition-transform duration-300 group-data-[open]/q:rotate-45 group-data-[open]/q:text-fg">
                    <Icon name="plus" size={16} />
                  </span>
                </AccordionTrigger>
              </AccordionHeader>
              <AccordionPanel>
                <p className="px-5 pb-5 text-[15px] leading-relaxed text-muted sm:px-6">
                  {t(`lp.faq.${n}.a`, { fee: PRICING.platformFeePercent, max: PRICING.maxChars })}
                </p>
              </AccordionPanel>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </Section>
  );
}

function FinalCta() {
  const { t } = useI18n();
  return (
    <section aria-labelledby="final-title" className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 sm:pb-32">
      <div className="dark relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-[#070908] px-6 py-20 text-center text-white sm:px-12 sm:py-28">
        <Backdrop />
        <div className="relative">
          <h2
            id="final-title"
            className="mx-auto max-w-3xl text-balance font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.04em] sm:text-6xl [&:lang(am)]:leading-[1.15] [&:lang(am)]:tracking-normal"
          >
            {t('lp.final.title')}
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base text-white/65 sm:text-lg">{t('lp.final.body')}</p>
          <div className="mt-10 flex justify-center">
            <CtaLink href={BOT_URL} external icon="chevronRight">
              {t('lp.cta.start')}
            </CtaLink>
          </div>
          <p className="mt-5 text-xs text-white/45">{t('lp.final.note')}</p>
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const { t } = useI18n();
  return (
    <div id="top" className="theme-studio min-h-screen overflow-x-clip bg-canvas font-sans text-fg antialiased">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-fg focus:shadow-lg"
      >
        {t('nav.skip')}
      </a>
      <LandingHeader />
      <main id="main">
        <Hero />
        <DonationTicker />
        <Section id="who" labelledBy="who-title">
          <SectionHeader id="who-title" eyebrow={t('lp.who.eyebrow')} title={t('lp.who.title')} center />
          <AudienceTabs />
        </Section>
        <div className="border-y border-line bg-surface/40">
          <Section id="demo" labelledBy="demo-title">
            <SectionHeader id="demo-title" eyebrow={t('lp.demo.eyebrow')} title={t('lp.demo.title')} body={t('lp.demo.body')} />
            <TryItDemo />
          </Section>
        </div>
        <Features />
        <div className="border-y border-line bg-surface/40">
          <Setup />
        </div>
        <Section id="earnings" labelledBy="earnings-title">
          <SectionHeader id="earnings-title" eyebrow={t('lp.earn.eyebrow')} title={t('lp.earn.title')} body={t('lp.earn.body')} />
          <EarningsCalculator />
        </Section>
        <Faq />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
