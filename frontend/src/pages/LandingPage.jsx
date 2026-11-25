import { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Badge,
  Button,
  Card,
  FlagBar,
  Icon,
  PublicLayout,
  Tabs,
  cn,
  extendDictionaries,
  formatETB,
  useI18n,
} from '../ui';

// Keep in sync with DEFAULT_PRICING in backend/utils/pricing.js (admins can override them in settings).
const PLATFORM_FEE_PERCENT = 10;
const MIN_MESSAGE_PRICE = 20;

const BOT_URL = 'https://t.me/HabeshaTTS_bot';

extendDictionaries({
  en: {
    'landing.nav.how': 'How it works',
    'landing.nav.features': 'Features',
    'landing.nav.pricing': 'Pricing',
    'landing.nav.faq': 'FAQ',
    'landing.cta.header': 'Start on Telegram',
    'landing.hero.badge': 'Chapa · Arifpay · Telebirr',
    'landing.hero.title1': 'Your viewers’ messages,',
    'landing.hero.title2': 'read aloud live',
    'landing.hero.title3': 'in Amharic.',
    'landing.hero.subtitle':
      'Viewers pay a few birr and their message is spoken on your stream through an OBS overlay, in natural Amharic voices. You keep {keep}%.',
    'landing.hero.primary': 'Start on Telegram',
    'landing.hero.secondary': 'How it works',
    'landing.hero.point1': 'Natural Amharic voices',
    'landing.hero.point2': 'Works in OBS and Streamlabs',
    'landing.hero.point3': 'You keep {keep}%',
    'landing.mock.live': 'Live',
    'landing.mock.sent': 'sent',
    'landing.mock.message': 'ሰላም! ከአዲስ አበባ ሰላምታ 💚💛❤️',
    'landing.mock.queue': '2 more in queue',
    'landing.how.title': 'How it works',
    'landing.how.subtitle': 'Three steps from a viewer’s phone to your stream.',
    'landing.how.1.title': 'A viewer sends a message',
    'landing.how.1.body': 'They open your donation link or the Telegram bot, type a message, and pay with Chapa, Arifpay or Telebirr.',
    'landing.how.2.title': 'It’s read aloud on stream',
    'landing.how.2.body': 'Your OBS overlay shows the alert and speaks the message in Amharic, in the order it was paid.',
    'landing.how.3.title': 'You get paid',
    'landing.how.3.body': 'Your share goes straight to your dashboard balance. Request a payout whenever you like.',
    'landing.features.title': 'Built for Ethiopian streamers',
    'landing.features.subtitle': 'Everything you need to turn your community’s support into a moment on stream.',
    'landing.features.voices.title': 'Amharic voices',
    'landing.features.voices.body': 'Messages are spoken with Google Cloud and Gemini voices that handle Ge’ez script.',
    'landing.features.overlay.title': 'OBS overlay',
    'landing.features.overlay.body': 'One browser source shows animated alerts and plays the audio. No extra software.',
    'landing.features.payments.title': 'Local payments',
    'landing.features.payments.body': 'Viewers pay with Chapa, Arifpay or Telebirr. No foreign account needed.',
    'landing.features.moderation.title': 'Moderation',
    'landing.features.moderation.body': 'A profanity filter, a minimum amount and donor blocking keep your stream safe.',
    'landing.features.soundboard.title': 'Paid soundboard',
    'landing.features.soundboard.body': 'Viewers trigger your sound clips at a price you set.',
    'landing.features.media.title': 'Media share',
    'landing.features.media.body': 'Viewers request clips, and nothing plays until you approve it.',
    'landing.soon': 'Soon',
    'landing.pricing.title': 'Simple, transparent pricing',
    'landing.pricing.subtitle': 'No monthly fee. The platform keeps {fee}% of each donation and the rest is yours.',
    'landing.pricing.viewers': 'For viewers',
    'landing.pricing.viewersFrom': 'from',
    'landing.pricing.viewersUnit': 'per message',
    'landing.pricing.viewersBody': 'Longer messages cost a little more. The exact price is shown before you pay.',
    'landing.pricing.streamers': 'For streamers',
    'landing.pricing.donation': 'Donation',
    'landing.pricing.youGet': 'You receive',
    'landing.pricing.fee': 'Platform fee ({fee}%)',
    'landing.faq.title': 'Questions, answered',
    'landing.faq.1.q': 'Which streaming apps does it work with?',
    'landing.faq.1.a':
      'Anything that supports a browser source: OBS Studio, Streamlabs and similar tools. Stream to YouTube, TikTok, Twitch or Facebook as usual.',
    'landing.faq.2.q': 'How do I get paid?',
    'landing.faq.2.a': 'Your share of every donation is added to your balance. Request a payout from the dashboard and it is sent to your Telebirr account.',
    'landing.faq.3.q': 'Is there a monthly fee?',
    'landing.faq.3.a': 'No. Habesha TTS only keeps {fee}% of each donation.',
    'landing.faq.4.q': 'Can I control what gets read aloud?',
    'landing.faq.4.a': 'Yes. Set a minimum amount, filter words and block donors. Messages that break your rules are not read.',
    'landing.final.title': 'Ready to hear your community?',
    'landing.final.body': 'Message the bot to set up your streamer account. It only takes a few minutes.',
    'landing.final.button': 'Open the Telegram bot',
    'landing.footer.call': 'Call us',
    'landing.footer.email': 'Email',
    'landing.footer.telegram': 'Telegram',
    'landing.footer.instagram': 'Instagram',
  },
  am: {
    'landing.nav.how': 'እንዴት ይሰራል',
    'landing.nav.features': 'ባህሪያት',
    'landing.nav.pricing': 'ዋጋ',
    'landing.nav.faq': 'ጥያቄዎች',
    'landing.cta.header': 'በቴሌግራም ይጀምሩ',
    'landing.hero.badge': 'ቻፓ · አሪፍፔይ · ቴሌብር',
    'landing.hero.title1': 'የተመልካቾችዎ መልዕክቶች',
    'landing.hero.title2': 'በቀጥታ ስርጭት',
    'landing.hero.title3': 'በአማርኛ ይነበባሉ።',
    'landing.hero.subtitle':
      'ተመልካቾች ጥቂት ብር ከፍለው መልዕክታቸው በOBS ኦቨርሌይ በኩል በተፈጥሯዊ የአማርኛ ድምፅ በስርጭትዎ ላይ ይነበባል። {keep}% የእርስዎ ነው።',
    'landing.hero.primary': 'በቴሌግራም ይጀምሩ',
    'landing.hero.secondary': 'እንዴት ይሰራል',
    'landing.hero.point1': 'ተፈጥሯዊ የአማርኛ ድምፆች',
    'landing.hero.point2': 'በOBS እና Streamlabs ይሰራል',
    'landing.hero.point3': '{keep}% የእርስዎ ነው',
    'landing.mock.live': 'ቀጥታ',
    'landing.mock.sent': 'ላከ',
    'landing.mock.message': 'ሰላም! ከአዲስ አበባ ሰላምታ 💚💛❤️',
    'landing.mock.queue': 'በወረፋ 2 ተጨማሪ',
    'landing.how.title': 'እንዴት ይሰራል',
    'landing.how.subtitle': 'ከተመልካች ስልክ እስከ ስርጭትዎ በሶስት ደረጃዎች።',
    'landing.how.1.title': 'ተመልካቹ መልዕክት ይልካል',
    'landing.how.1.body': 'የስጦታ ሊንክዎን ወይም የቴሌግራም ቦቱን ከፍተው መልዕክት ይጽፋሉ፤ በቻፓ፣ በአሪፍፔይ ወይም በቴሌብር ይከፍላሉ።',
    'landing.how.2.title': 'በስርጭቱ ላይ ይነበባል',
    'landing.how.2.body': 'የOBS ኦቨርሌዩ ማሳወቂያውን ያሳያል፤ መልዕክቱንም በተከፈለበት ቅደም ተከተል በአማርኛ ያነባል።',
    'landing.how.3.title': 'ክፍያዎን ያገኛሉ',
    'landing.how.3.body': 'ድርሻዎ በቀጥታ በዳሽቦርድዎ ቀሪ ሂሳብ ላይ ይጨመራል። በፈለጉት ጊዜ ክፍያ ይጠይቁ።',
    'landing.features.title': 'ለኢትዮጵያውያን ስትሪመሮች የተሰራ',
    'landing.features.subtitle': 'የማህበረሰብዎን ድጋፍ በስርጭትዎ ላይ ወደ ልዩ ጊዜ ለመቀየር የሚያስፈልግዎ ሁሉ።',
    'landing.features.voices.title': 'የአማርኛ ድምፆች',
    'landing.features.voices.body': 'መልዕክቶች የግዕዝ ፊደልን በሚያነቡ የGoogle Cloud እና Gemini ድምፆች ይነበባሉ።',
    'landing.features.overlay.title': 'የOBS ኦቨርሌይ',
    'landing.features.overlay.body': 'አንድ ብራውዘር ሶርስ ማሳወቂያዎችን ያሳያል፤ ድምፁንም ያጫውታል። ተጨማሪ ሶፍትዌር አያስፈልግም።',
    'landing.features.payments.title': 'የሀገር ውስጥ ክፍያዎች',
    'landing.features.payments.body': 'ተመልካቾች በቻፓ፣ በአሪፍፔይ ወይም በቴሌብር ይከፍላሉ። የውጭ ሀገር አካውንት አያስፈልግም።',
    'landing.features.moderation.title': 'ቁጥጥር',
    'landing.features.moderation.body': 'የብልግና ቃላት ማጣሪያ፣ ዝቅተኛ የስጦታ መጠን እና ለጋሾችን ማገድ ስርጭትዎን ይጠብቃሉ።',
    'landing.features.soundboard.title': 'የሚከፈልበት የድምፅ ሰሌዳ',
    'landing.features.soundboard.body': 'ተመልካቾች እርስዎ ባወጡት ዋጋ የድምፅ ክሊፖችዎን ያጫውታሉ።',
    'landing.features.media.title': 'የሚዲያ ማጋራት',
    'landing.features.media.body': 'ተመልካቾች ክሊፕ ይጠይቃሉ፤ እርስዎ እስኪያጸድቁ ድረስ ምንም አይጫወትም።',
    'landing.soon': 'በቅርቡ',
    'landing.pricing.title': 'ቀላል እና ግልጽ ዋጋ',
    'landing.pricing.subtitle': 'ወርሃዊ ክፍያ የለም። መድረኩ ከእያንዳንዱ ስጦታ {fee}% ይወስዳል፤ ቀሪው የእርስዎ ነው።',
    'landing.pricing.viewers': 'ለተመልካቾች',
    'landing.pricing.viewersFrom': 'ከ',
    'landing.pricing.viewersUnit': 'በአንድ መልዕክት',
    'landing.pricing.viewersBody': 'ረጅም መልዕክቶች ትንሽ ተጨማሪ ያስከፍላሉ። ትክክለኛው ዋጋ ከመክፈልዎ በፊት ይታያል።',
    'landing.pricing.streamers': 'ለስትሪመሮች',
    'landing.pricing.donation': 'ስጦታ',
    'landing.pricing.youGet': 'እርስዎ የሚያገኙት',
    'landing.pricing.fee': 'የመድረክ ክፍያ ({fee}%)',
    'landing.faq.title': 'ተደጋግመው የሚጠየቁ ጥያቄዎች',
    'landing.faq.1.q': 'በየትኞቹ የስትሪሚንግ መተግበሪያዎች ይሰራል?',
    'landing.faq.1.a':
      'ብራውዘር ሶርስ በሚደግፍ በማንኛውም፦ OBS Studio፣ Streamlabs እና መሰል መሣሪያዎች። እንደተለመደው ወደ YouTube፣ TikTok፣ Twitch ወይም Facebook ያስተላልፉ።',
    'landing.faq.2.q': 'ክፍያዬን እንዴት አገኛለሁ?',
    'landing.faq.2.a': 'ከእያንዳንዱ ስጦታ ድርሻዎ በቀሪ ሂሳብዎ ላይ ይጨመራል። ከዳሽቦርዱ ክፍያ ሲጠይቁ ወደ ቴሌብር አካውንትዎ ይላካል።',
    'landing.faq.3.q': 'ወርሃዊ ክፍያ አለ?',
    'landing.faq.3.a': 'የለም። ሀበሻ TTS ከእያንዳንዱ ስጦታ {fee}% ብቻ ይወስዳል።',
    'landing.faq.4.q': 'የሚነበበውን መቆጣጠር እችላለሁ?',
    'landing.faq.4.a': 'አዎ። ዝቅተኛ የስጦታ መጠን ያስቀምጡ፣ ቃላትን ያጣሩ እና ለጋሾችን ያግዱ። ደንብዎን የሚጥሱ መልዕክቶች አይነበቡም።',
    'landing.final.title': 'የማህበረሰብዎን ድምፅ ለመስማት ዝግጁ ነዎት?',
    'landing.final.body': 'የስትሪመር አካውንትዎን ለመክፈት ለቦቱ መልዕክት ይላኩ። ጥቂት ደቂቃዎች ብቻ ይወስዳል።',
    'landing.final.button': 'የቴሌግራም ቦቱን ይክፈቱ',
    'landing.footer.call': 'ይደውሉልን',
    'landing.footer.email': 'ኢሜይል',
    'landing.footer.telegram': 'ቴሌግራም',
    'landing.footer.instagram': 'ኢንስታግራም',
  },
});

const NAV = [
  { href: '#how', labelKey: 'landing.nav.how' },
  { href: '#features', labelKey: 'landing.nav.features' },
  { href: '#pricing', labelKey: 'landing.nav.pricing' },
  { href: '#faq', labelKey: 'landing.nav.faq' },
];

const FOOTER_LINKS = [
  { href: 'tel:+251939976687', labelKey: 'landing.footer.call' },
  { href: 'mailto:support@habeshatts.com', labelKey: 'landing.footer.email' },
  { href: BOT_URL, labelKey: 'landing.footer.telegram' },
  { href: 'https://www.instagram.com/habeshatts/', labelKey: 'landing.footer.instagram' },
];

const FEATURES = [
  { key: 'voices', icon: 'mic' },
  { key: 'overlay', icon: 'layers' },
  { key: 'payments', icon: 'wallet' },
  { key: 'moderation', icon: 'shield' },
  { key: 'soundboard', icon: 'music', soon: true },
  { key: 'media', icon: 'film', soon: true },
];

const KEEP_PERCENT = 100 - PLATFORM_FEE_PERCENT;

function SectionHeading({ id, title, subtitle, center = false }) {
  return (
    <div className={cn('max-w-2xl', center && 'mx-auto text-center')}>
      <h2 id={id} className="text-2xl font-bold tracking-tight text-fg sm:text-3xl">
        {title}
      </h2>
      {subtitle ? <p className="mt-3 text-base text-muted sm:text-lg">{subtitle}</p> : null}
    </div>
  );
}

SectionHeading.propTypes = {
  id: PropTypes.string.isRequired,
  title: PropTypes.node.isRequired,
  subtitle: PropTypes.node,
  center: PropTypes.bool,
};

/** A static mock of the OBS alert, styled like OverlayPage. Decorative. */
function OverlayPreview() {
  const { t } = useI18n();
  return (
    <div className="relative" aria-hidden="true">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-brand-500/10 blur-2xl dark:bg-brand-500/15" />
      <div className="overflow-hidden rounded-2xl border border-line bg-[#0b0f0d] shadow-overlay">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-flag-red/90 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            {t('landing.mock.live')}
          </span>
        </div>
        <div className="relative aspect-[16/11] bg-[radial-gradient(ellipse_at_top,rgba(23,162,79,0.18),transparent_60%),linear-gradient(180deg,#121815,#0b0f0d)] p-5 sm:p-7">
          <div className="absolute inset-x-5 bottom-5 sm:inset-x-7 sm:bottom-7">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/70 text-white shadow-overlay backdrop-blur">
              <FlagBar height={4} />
              <div className="p-4 font-ethiopic sm:p-5">
                <p className="text-lg font-extrabold text-flag-yellow sm:text-xl">
                  Selam <span className="text-sm font-medium text-white/70">{t('landing.mock.sent')}</span>
                </p>
                <p className="mt-0.5 text-3xl font-extrabold leading-tight sm:text-4xl">
                  <span className="bg-gradient-to-r from-emerald-400 via-flag-yellow to-red-400 bg-clip-text text-transparent">100</span>{' '}
                  <span className="text-lg text-white/80">ETB</span>
                </p>
                <p className="mt-2 text-base font-medium leading-snug sm:text-lg">{t('landing.mock.message')}</p>
                <div className="mt-3 flex items-end gap-0.5" style={{ height: 18 }}>
                  {[6, 12, 9, 16, 7, 13, 18, 10, 6, 14, 8, 12, 5, 15, 9, 11].map((h, i) => (
                    <span key={i} className="w-1 rounded-full bg-brand-400/80" style={{ height: h }} />
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-2 text-right text-xs text-white/50">{t('landing.mock.queue')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeeCalculator() {
  const { t } = useI18n();
  const [amount, setAmount] = useState('100');
  const value = Number(amount);
  const fee = Math.round(value * PLATFORM_FEE_PERCENT) / 100;
  const net = value - fee;

  return (
    <div>
      <Tabs
        variant="pill"
        size="sm"
        fitted
        label={`${t('landing.pricing.donation')} (ETB)`}
        value={amount}
        onChange={setAmount}
        items={['50', '100', '500', '1000'].map((v) => ({ value: v, label: Number(v).toLocaleString('en-US') }))}
      />
      <dl className="mt-5 flex flex-col gap-3 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted">{t('landing.pricing.donation')}</dt>
          <dd className="font-semibold tabular-nums text-fg">{formatETB(value)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted">{t('landing.pricing.fee', { fee: PLATFORM_FEE_PERCENT })}</dt>
          <dd className="tabular-nums text-muted">− {formatETB(fee)}</dd>
        </div>
        <div className="flex items-center justify-between border-t border-line pt-3">
          <dt className="font-semibold text-fg">{t('landing.pricing.youGet')}</dt>
          <dd className="text-xl font-bold tabular-nums text-brand-600 dark:text-brand-400" aria-live="polite">
            {formatETB(net)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function LandingPage() {
  const { t } = useI18n();

  const startButton = (size = 'sm') => (
    <Button as="a" href={BOT_URL} target="_blank" rel="noreferrer" size={size} rightIcon={size === 'lg' ? <Icon name="chevronRight" size={18} /> : undefined}>
      {t(size === 'lg' ? 'landing.hero.primary' : 'landing.cta.header')}
    </Button>
  );

  return (
    <PublicLayout nav={NAV} cta={startButton()} footerLinks={FOOTER_LINKS}>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 -z-0 bg-[radial-gradient(ellipse_60%_50%_at_70%_0%,rgba(7,137,48,0.12),transparent)] dark:bg-[radial-gradient(ellipse_60%_50%_at_70%_0%,rgba(23,162,79,0.16),transparent)]"
          aria-hidden="true"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-2 lg:py-24">
          <div>
            <Badge variant="brand" dot>
              {t('landing.hero.badge')}
            </Badge>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-fg sm:text-5xl lg:text-[3.5rem]">
              {t('landing.hero.title1')} <span className="text-brand-600 dark:text-brand-400">{t('landing.hero.title2')}</span>{' '}
              {t('landing.hero.title3')}
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">{t('landing.hero.subtitle', { keep: KEEP_PERCENT })}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {startButton('lg')}
              <Button as="a" href="#how" variant="secondary" size="lg">
                {t('landing.hero.secondary')}
              </Button>
            </div>
            <ul className="mt-8 flex flex-col gap-2.5 text-sm text-muted sm:flex-row sm:flex-wrap sm:gap-x-6">
              {['landing.hero.point1', 'landing.hero.point2', 'landing.hero.point3'].map((key) => (
                <li key={key} className="flex items-center gap-2">
                  <Icon name="checkCircle" size={16} className="shrink-0 text-brand-600 dark:text-brand-400" />
                  {t(key, { keep: KEEP_PERCENT })}
                </li>
              ))}
            </ul>
          </div>
          <OverlayPreview />
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="how-title" className="border-t border-line bg-surface/50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <span id="how" className="block scroll-mt-24" />
          <SectionHeading id="how-title" title={t('landing.how.title')} subtitle={t('landing.how.subtitle')} />
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <li key={n}>
                <Card className="h-full">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{n}</span>
                  <h3 className="mt-4 text-lg font-semibold text-fg">{t(`landing.how.${n}.title`)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{t(`landing.how.${n}.body`)}</p>
                </Card>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Features */}
      <section aria-labelledby="features-title" className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <span id="features" className="block scroll-mt-24" />
          <SectionHeading id="features-title" title={t('landing.features.title')} subtitle={t('landing.features.subtitle')} />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.key} interactive className="h-full">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                    <Icon name={f.icon} size={20} />
                  </span>
                  {f.soon ? (
                    <Badge variant="warning" size="sm">
                      {t('landing.soon')}
                    </Badge>
                  ) : null}
                </div>
                <h3 className="mt-4 text-base font-semibold text-fg">{t(`landing.features.${f.key}.title`)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{t(`landing.features.${f.key}.body`)}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section aria-labelledby="pricing-title" className="border-t border-line bg-surface/50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <span id="pricing" className="block scroll-mt-24" />
          <SectionHeading
            id="pricing-title"
            title={t('landing.pricing.title')}
            subtitle={t('landing.pricing.subtitle', { fee: PLATFORM_FEE_PERCENT })}
          />
          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            <Card className="flex flex-col">
              <p className="text-sm font-semibold uppercase tracking-wide text-muted">{t('landing.pricing.viewers')}</p>
              <p className="mt-4 flex items-baseline gap-2">
                <span className="text-sm text-muted">{t('landing.pricing.viewersFrom')}</span>
                <span className="text-4xl font-extrabold tracking-tight text-fg">{formatETB(MIN_MESSAGE_PRICE, { decimals: 0 })}</span>
                <span className="text-sm text-muted">{t('landing.pricing.viewersUnit')}</span>
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted">{t('landing.pricing.viewersBody')}</p>
              <div className="mt-auto flex flex-wrap gap-2 pt-6">
                {['Chapa', 'Arifpay', 'Telebirr'].map((m) => (
                  <Badge key={m}>{m}</Badge>
                ))}
              </div>
            </Card>
            <Card accent>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold uppercase tracking-wide text-muted">{t('landing.pricing.streamers')}</p>
                <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">{t('landing.hero.point3', { keep: KEEP_PERCENT })}</p>
              </div>
              <div className="mt-5">
                <FeeCalculator />
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-title" className="border-t border-line">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
          <span id="faq" className="block scroll-mt-24" />
          <SectionHeading id="faq-title" title={t('landing.faq.title')} center />
          <div className="mt-10 flex flex-col gap-3">
            {[1, 2, 3, 4].map((n) => (
              <details key={n} className="group rounded-xl border border-line bg-surface shadow-card open:shadow-raised">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-5 py-4 text-left font-semibold text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 [&::-webkit-details-marker]:hidden">
                  {t(`landing.faq.${n}.q`)}
                  <Icon name="chevronDown" size={18} className="shrink-0 text-subtle transition-transform group-open:rotate-180" />
                </summary>
                <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{t(`landing.faq.${n}.a`, { fee: PLATFORM_FEE_PERCENT })}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 pb-16 sm:px-6 sm:pb-20">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-2xl border border-brand-700/40 bg-brand-700 px-6 py-12 text-center text-white shadow-raised sm:px-12 sm:py-16 dark:bg-brand-800">
          <FlagBar className="absolute inset-x-0 top-0" height={4} />
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('landing.final.title')}</h2>
          <p className="mx-auto mt-3 max-w-xl text-base text-white/85 sm:text-lg">{t('landing.final.body')}</p>
          <a
            href={BOT_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-white px-6 text-base font-semibold text-brand-800 shadow-card transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-700"
          >
            {t('landing.final.button')}
            <Icon name="chevronRight" size={18} />
          </a>
        </div>
      </section>
    </PublicLayout>
  );
}

export default LandingPage;
