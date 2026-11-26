import PropTypes from 'prop-types';
import { Badge, Icon, cn, useI18n } from '../ui';
import { BOT_URL, KEEP_PERCENT, PRICING } from './landing/strings';
import { CtaLink, Eyebrow, SectionHeader, TiletBand } from './landing/parts';
import { LandingFooter, LandingHeader } from './landing/chrome';
import { AudienceSwitcher, DonationTicker, EarningsCalculator, HeroStage, TryItDemo } from './landing/interactive';

/*
 * Public landing page — "coffee & gold" theme (.theme-coffee in src/index.css),
 * scoped to this page. Sections: hero · ticker · audiences · live demo ·
 * features · setup · earnings · FAQ · final CTA.
 */

function Section({ id, labelledBy, className, children }) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={cn('scroll-mt-16', className)}>
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">{children}</div>
    </section>
  );
}

Section.propTypes = {
  id: PropTypes.string,
  labelledBy: PropTypes.string.isRequired,
  className: PropTypes.string,
  children: PropTypes.node,
};

function Hero() {
  const { t } = useI18n();
  const stats = [
    { value: t('lp.hero.stat1.value', { keep: KEEP_PERCENT }), label: t('lp.hero.stat1.label') },
    { value: t('lp.hero.stat2.value', { price: PRICING.basePrice }), label: t('lp.hero.stat2.label') },
    { value: t('lp.hero.stat3.value'), label: t('lp.hero.stat3.label') },
  ];
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_85%_10%,rgba(242,183,5,0.16),transparent),radial-gradient(ellipse_50%_50%_at_0%_100%,rgba(7,137,48,0.12),transparent)]"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -left-6 top-24 hidden select-none font-display text-[16rem] font-bold leading-none text-fg/[0.03] lg:block"
      >
        ድምፅ
      </span>
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-10 sm:px-6 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:pb-28">
        <div>
          <Eyebrow>{t('lp.hero.eyebrow')}</Eyebrow>
          <h1
            id="hero-title"
            className="mt-5 font-display text-[2.6rem] font-bold leading-[1.08] tracking-tight text-fg sm:text-6xl lg:text-[4.1rem]"
          >
            {t('lp.hero.title.a')}{' '}
            <span className="relative whitespace-nowrap italic text-gold">
              {t('lp.hero.title.b')}
              <svg aria-hidden="true" viewBox="0 0 200 12" preserveAspectRatio="none" className="absolute -bottom-1 left-0 h-3 w-full text-gold-bright">
                <path d="M2 9 Q 50 2 100 7 T 198 4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </span>{' '}
            {t('lp.hero.title.c')}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">{t('lp.hero.body', { keep: KEEP_PERCENT })}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <CtaLink href={BOT_URL} external icon="chevronRight">
              {t('lp.cta.start')}
            </CtaLink>
            <CtaLink href="#demo" variant="secondary">
              {t('lp.cta.demo')}
            </CtaLink>
          </div>
          <dl className="mt-10 grid max-w-md grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-surface/70 backdrop-blur">
            {stats.map((s) => (
              <div key={s.label} className="px-4 py-3">
                <dt className="sr-only">{s.label}</dt>
                <dd className="font-display text-xl font-bold tabular-nums text-fg sm:text-2xl">{s.value}</dd>
                <dd className="mt-0.5 text-xs text-muted">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
        <HeroStage />
      </div>
    </section>
  );
}

const FEATURES = [
  { key: 'overlay', icon: 'layers', span: 'lg:col-span-2 lg:row-span-2', hero: true },
  { key: 'voices', icon: 'mic' },
  { key: 'payments', icon: 'wallet' },
  { key: 'moderation', icon: 'shield' },
  { key: 'analytics', icon: 'chart' },
  { key: 'soundboard', icon: 'music', soon: true, span: 'lg:col-span-2' },
  { key: 'media', icon: 'film', soon: true, span: 'lg:col-span-2' },
];

function Features() {
  const { t } = useI18n();
  return (
    <Section id="features" labelledBy="features-title" className="bg-surface/60">
      <SectionHeader id="features-title" eyebrow={t('lp.features.eyebrow')} title={t('lp.features.title')} />
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:auto-rows-[minmax(11rem,auto)]">
        {FEATURES.map((f) => (
          <article
            key={f.key}
            className={cn(
              'group relative flex flex-col overflow-hidden rounded-3xl border p-6 transition-[border-color,transform] duration-200 hover:-translate-y-0.5',
              f.hero
                ? 'border-transparent bg-[#17120d] text-white sm:col-span-2'
                : 'border-line bg-surface shadow-card hover:border-line-strong',
              f.span,
            )}
          >
            {f.hero ? (
              <>
                <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-gold-bright/20 blur-3xl" aria-hidden="true" />
                <TiletBand className="absolute inset-x-0 bottom-0 opacity-80" />
              </>
            ) : null}
            <div className="relative flex items-start justify-between gap-3">
              <span
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-2xl',
                  f.hero ? 'bg-gold-bright text-[#1e160e]' : 'bg-gold/15 text-gold',
                )}
              >
                <Icon name={f.icon} size={20} />
              </span>
              {f.soon ? (
                <Badge variant="warning" size="sm">
                  {t('lp.soon')}
                </Badge>
              ) : null}
            </div>
            <h3
              className={cn(
                'relative mt-5 font-semibold leading-snug',
                f.hero ? 'font-display text-2xl sm:text-3xl' : 'text-base text-fg',
              )}
            >
              {t(`lp.f.${f.key}.title`)}
            </h3>
            <p className={cn('relative mt-2 text-sm leading-relaxed', f.hero ? 'max-w-md text-white/70 sm:text-base' : 'text-muted')}>
              {t(`lp.f.${f.key}.body`)}
            </p>
            {f.hero ? (
              <div className="relative mt-auto pt-8 pb-4">
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] p-3 font-mono text-xs text-white/70">
                  <Icon name="layers" size={14} className="shrink-0 text-gold-bright" />
                  <span className="truncate">https://habeshatts.com/overlay/••••••••••••</span>
                  <span className="ml-auto shrink-0 rounded-md bg-gold-bright px-2 py-0.5 font-sans font-semibold text-[#1e160e]">OBS</span>
                </div>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </Section>
  );
}

function Setup() {
  const { t } = useI18n();
  return (
    <Section id="setup" labelledBy="setup-title">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeader id="setup-title" eyebrow={t('lp.setup.eyebrow')} title={t('lp.setup.title')} />
          <div className="mt-8">
            <CtaLink href={BOT_URL} external icon="chevronRight">
              {t('lp.cta.start')}
            </CtaLink>
          </div>
        </div>
        <ol className="relative flex flex-col gap-4 before:absolute before:bottom-6 before:left-[1.4rem] before:top-6 before:w-px before:bg-line-strong">
          {[1, 2, 3, 4].map((n) => (
            <li key={n} className="relative flex gap-5">
              <span className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-canvas font-display text-lg font-bold text-gold">
                {n}
              </span>
              <div className="flex-1 rounded-2xl border border-line bg-surface p-5 shadow-card">
                <h3 className="font-semibold text-fg">{t(`lp.setup.${n}.title`)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{t(`lp.setup.${n}.body`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}

function Faq() {
  const { t } = useI18n();
  const vars = { fee: PRICING.platformFeePercent, max: PRICING.maxChars };
  return (
    <Section id="faq" labelledBy="faq-title">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr]">
        <SectionHeader id="faq-title" eyebrow={t('lp.faq.eyebrow')} title={t('lp.faq.title')} />
        <div className="flex flex-col divide-y divide-line border-y border-line">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <details key={n} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left text-base font-semibold text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-bright [&::-webkit-details-marker]:hidden">
                {t(`lp.faq.${n}.q`)}
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-muted transition-transform duration-200 group-open:rotate-45 group-open:border-gold group-open:text-gold">
                  <Icon name="plus" size={16} />
                </span>
              </summary>
              <p className="-mt-1 pb-5 pr-12 text-sm leading-relaxed text-muted sm:text-base">{t(`lp.faq.${n}.a`, vars)}</p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}

function FinalCta() {
  const { t } = useI18n();
  return (
    <section aria-labelledby="final-title" className="px-4 pb-20 sm:px-6 sm:pb-24">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-[#17120d] px-6 py-16 text-center text-white shadow-overlay sm:px-12 sm:py-20">
        <TiletBand className="absolute inset-x-0 top-0" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_70%_at_50%_120%,rgba(242,183,5,0.3),transparent)]" aria-hidden="true" />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-10 left-1/2 -translate-x-1/2 select-none font-display text-[11rem] font-bold leading-none text-white/[0.05] sm:text-[16rem]"
        >
          ድምፅ
        </span>
        <div className="relative">
          <h2 id="final-title" className="mx-auto max-w-2xl font-display text-3xl font-bold leading-tight sm:text-5xl">
            {t('lp.final.title')}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/70 sm:text-lg">{t('lp.final.body')}</p>
          <div className="mt-9 flex justify-center">
            <CtaLink href={BOT_URL} external icon="chevronRight">
              {t('lp.cta.start')}
            </CtaLink>
          </div>
        </div>
      </div>
    </section>
  );
}

function LandingPage() {
  const { t } = useI18n();
  return (
    <div id="top" className="theme-coffee min-h-screen bg-canvas font-sans text-fg">
      <a
        href="#main-content"
        className="sr-only z-[70] rounded-md bg-gold-bright px-3 py-2 text-sm font-semibold text-[#1e160e] focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        {t('nav.skip')}
      </a>
      <TiletBand />
      <LandingHeader />
      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        <Hero />
        <DonationTicker />
        <Section labelledBy="who-title">
          <SectionHeader id="who-title" eyebrow={t('lp.who.eyebrow')} title={t('lp.who.title')} />
          <div className="mt-10">
            <AudienceSwitcher />
          </div>
        </Section>
        <Section id="demo" labelledBy="demo-title" className="border-y border-line bg-surface/60">
          <SectionHeader id="demo-title" eyebrow={t('lp.demo.eyebrow')} title={t('lp.demo.title')} body={t('lp.demo.body')} />
          <div className="mt-10">
            <TryItDemo />
          </div>
        </Section>
        <Features />
        <Setup />
        <Section id="earnings" labelledBy="earn-title" className="border-y border-line bg-surface/60">
          <SectionHeader id="earn-title" eyebrow={t('lp.earn.eyebrow')} title={t('lp.earn.title')} body={t('lp.earn.body')} />
          <div className="mt-10">
            <EarningsCalculator />
          </div>
        </Section>
        <Faq />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}

export default LandingPage;
