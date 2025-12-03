import { useState } from 'react';

const logoSrc = '/image/habesha-logo.png';

const localeOptions = [
  { code: 'en', label: 'EN' },
  { code: 'am', label: 'አማ' },
];

const navLinks = [
  { href: '#features', key: 'navPlatform' },
  { href: '#growth', key: 'navGrowth' },
  { href: '#pricing', key: 'navRevenue' },
  { href: '#faq', key: 'navFAQ' },
];

const translations = {
  en: {
    brandSubtitle: 'Creator Commerce Suite',
    headerPrimaryCTA: 'Talk to the Bot',
    navPlatform: 'Platform',
    navGrowth: 'Growth',
    navRevenue: 'Revenue',
    navFAQ: 'FAQ',
    heroBadge: 'Trusted by creators from Addis to Atlanta',
    heroHeadingStart: 'Monetize every shout-out with a',
    heroHeadingHighlight: 'localized',
    heroHeadingEnd: 'TTS engine.',
    heroDescription:
      'Habesha TTS is the fastest path from heartfelt donation to on-stream reaction—complete with queue control, concierge payouts, and safety rails built for Amharic-speaking communities.',
    heroCTASecondary: 'Explore Platform',
    heroStatSplit: 'Creator / Habesha split • No monthly fee',
    heroStatSpeed: 'Payout reconciliation SLA',
    heroCardQueueTitle: 'Live Donation Queue',
    heroCardDonationLabel: 'Donation',
    heroCardReady: 'Ready',
    heroCardWeekLabel: 'This week',
    heroCardWeekChange: '+18% vs last week',
    heroCardWeekSubtitle: 'net volume',
    featuresOverline: 'Platform',
    featuresHeading: 'What creators unlock with Habesha TTS',
    featuresDescription:
      'Purpose-built for live Amharic shows, the dashboard merges automation with human concierge support for reliability and delight.',
    featuresLink: 'See revenue share →',
    growthOverline: 'Growth engine',
    growthHeading: 'Launch-ready playbooks.',
    growthDescription:
      'Spin up charity streams, anniversaries, and launch parties with pacing widgets, spotlight assets, and concierge checklists tuned for new creators.',
    growthBullet1: 'Promo kits for seasonal spotlights and social clips.',
    growthBullet2: 'Agency dashboard for multi-streamer rollouts with consolidated reporting.',
    growthBullet3: 'Weekly concierge syncs to iterate on pacing and audio styling.',
    growthCTA: 'Chat on Telegram',
    revenueOverline: 'Revenue share',
    revenueHeading: 'Keep 60% of every donation. Fuel the platform with 40%.',
    revenueDescription:
      'No hidden fees. Optional seasonal boosts drop the Habesha share to 35% while you headline spotlight events. Segment-based bonuses reward agencies and top creators.',
    revenueCardLabel: 'Average creator',
    revenueCardSubtitle: 'net monthly take-home',
    pricingHeaderVolume: 'Monthly Volume',
    pricingHeaderCreator: 'Creator Take (60%)',
    pricingHeaderPlatform: 'Habesha Platform (40%)',
    pricingHeaderPerks: 'Perks',
    faqHeading: 'Questions, answered.',
    faqDescription:
      'Need more detail? Email partnerships@habeshatts.com and a human will reply within one business day.',
    ctaOverline: 'Get started',
    ctaHeading: 'Ready to give your community a voice?',
    ctaDescription:
      'Join Habesha TTS and turn every shout-out into a memorable moment. Invite-only cohorts open monthly—apply now to reserve a slot.',
    ctaPrimary: 'Apply via Telegram',
    footerTagline: 'Built in Addis, streamed worldwide.',
    footerSupport: 'Support',
    footerPartner: 'Partner Program',
    footerSocial: 'Instagram',
    footerContact: 'Call Us',
  },
  am: {
    brandSubtitle: 'የፈጣሪዎች የገቢ ማግኛ ስብስብ',
    headerPrimaryCTA: 'ቦቱን ያናግሩ',
    navPlatform: 'መድረክ',
    navGrowth: 'እድገት',
    navRevenue: 'ገቢ',
    navFAQ: 'ጥያቄዎች',
    heroBadge: 'ከአዲስ አበባ እስከ አትላንታ ባሉ ፈጣሪዎች የታመነ',
    heroHeadingStart: 'እያንዳንዱን መልእክት',
    heroHeadingHighlight: 'በሀገርኛ',
    heroHeadingEnd: 'የTTS ሞተር ወደ ገቢ ይለውጡ።',
    heroDescription:
      'Habesha TTS ከልብ የመነጨ ልገሳን በቀጥታ ስርጭት ላይ ወደ ምላሽ የሚቀይር ፈጣን መንገድ ነው፤ የሰልፍ ቁጥጥር፣ ፈጣን ክፍያ እና ለአማርኛ ተናጋሪ ማህበረሰቦች የተበጁ የደህንነት መቆጣጠሪያዎችን ያካተተ ነው።',
    heroCTASecondary: 'መድረኩን ያስሱ',
    heroStatSplit: 'የፈጣሪ / Habesha ድርሻ • ወርሃዊ ክፍያ የለም',
    heroStatSpeed: 'የክፍያ ማስተካከያ SLA',
    heroCardQueueTitle: 'የቀጥታ የልገሳ ሰልፍ',
    heroCardDonationLabel: 'ልገሳ',
    heroCardReady: 'ዝግጁ',
    heroCardWeekLabel: 'ይህ ሳምንት',
    heroCardWeekChange: '+18% ከባለፈው ሳምንት',
    heroCardWeekSubtitle: 'የተጣራ ገቢ',
    featuresOverline: 'መድረክ',
    featuresHeading: 'ፈጣሪዎች በHabesha TTS ምን ያገኛሉ?',
    featuresDescription: 'ለቀጥታ የአማርኛ ስርጭቶች የተሰራ፤ ሙሉ አውቶማቲክ ሂደት ከልዩ ድጋፍ ጋር የተዋሃደ አስተማማኝ መድረክ።',
    featuresLink: 'የገቢ ድርሻን ይመልከቱ →',
    growthOverline: 'የእድገት ሞተር',
    growthHeading: 'ለመነሻ ዝግጁ መመሪያዎች።',
    growthDescription: 'የበጎ አድራጎት ስርጭቶችን፣ ክብረ በዓላትን እና የምረቃ ዝግጅቶችን በልዩ ፍጥነት መቆጣጠሪያዎች እና በኮንሲየርጅ ዝርዝሮች ይጀምሩ።',
    growthBullet1: 'ለወቅታዊ ስፖትላይት እና ማህበራዊ ክሊፖች የተዘጋጀ የፕሮሞ ፓኬጅ።',
    growthBullet2: 'ለብዙ ፈጣሪዎች የተዋሃደ የሪፖርት ዳሽቦርድ።',
    growthBullet3: 'የጊዜ እና የድምጽ ቅንብርን ለማስተካከል ሳምንታዊ የኮንሲየርጅ ስብሰባ።',
    growthCTA: 'በቴሌግራም ይወያዩ',
    revenueOverline: 'የገቢ ድርሻ',
    revenueHeading: 'ከእያንዳንዱ ልገሳ 60% የእርስዎ ነው፣ 40% ለመድረኩ ማስኬጃ ይሆናል።',
    revenueDescription:
      'ምንም ድብቅ ክፍያዎች የሉም። በወቅታዊ ስፖትላይቶች ጊዜ የHabesha ድርሻ እስከ 35% ሊወርድ ይችላል፣ ይህም ለከፍተኛ ፈጣሪዎች እና ኤጀንሲዎች ተጨማሪ ቦነስ ይሰጣል።',
    revenueCardLabel: 'አማካይ ፈጣሪ',
    revenueCardSubtitle: 'ወርሃዊ የተጣራ ገቢ',
    pricingHeaderVolume: 'ወርሃዊ መጠን',
    pricingHeaderCreator: 'የፈጣሪ ድርሻ (60%)',
    pricingHeaderPlatform: 'Habesha መድረክ (40%)',
    pricingHeaderPerks: 'ጥቅሞች',
    faqHeading: 'ጥያቄዎች እና መልሶች',
    faqDescription:
      'ተጨማሪ መረጃ ይፈልጋሉ? partnerships@habeshatts.com ላይ ይፃፉልን፣ በአንድ የስራ ቀን ውስጥ መልስ እንሰጣለን።',
    ctaOverline: 'ይጀምሩ',
    ctaHeading: 'ለማህበረሰብዎ ድምጽ ለመስጠት ዝግጁ ነዎት?',
    ctaDescription:
      'Habesha TTSን ይቀላቀሉ እና እያንዳንዱን መልእክት የማይረሳ ተሞክሮ ያድርጉት። የግብዣ ቡድኖች በየወሩ ይከፈታሉ—ቦታዎን ለመያዝ አሁኑኑ ያመልክቱ።',
    ctaPrimary: 'በቴሌግራም ያመልክቱ',
    footerTagline: 'በአዲስ አበባ የተሰራ፣ ለዓለም የሚሰራጭ።',
    footerSupport: 'ድጋፍ',
    footerPartner: 'የአጋር ፕሮግራም',
    footerSocial: 'ኢንስታግራም',
    footerContact: 'ይደውሉልን',
  },
};

const metricsByLocale = {
  en: [
    { label: 'Pilot Creators', value: '25+', detail: 'launch partners on day one' },
    { label: 'Payout Speed', value: 'Same-Day', detail: 'Telebirr withdrawals before midnight' },
    { label: 'Queue Accuracy', value: '100%', detail: 'tested with sleeping tabs and wake locks' },
  ],
  am: [
    { label: 'የፓይሎት ፈጣሪዎች', value: '25+', detail: 'በመጀመሪያ ቀን የተጀመሩ አጋሮች' },
    { label: 'የክፍያ ፍጥነት', value: 'በተመሳሳይ ቀን', detail: 'ከእኩለ ሌሊት በፊት በቴሌብር' },
    { label: 'የሰልፍ ትክክለኛነት', value: '100%', detail: 'በቦዘነ ታብ እና ስክሪን ተፈትኖ የተረጋገጠ' },
  ],
};

const featuresByLocale = {
  en: [
    {
      title: 'Real-time Donation Flow',
      description: 'Instant queueing, branded notification sounds, and auto-sanitized messages keep the hype rolling without tab juggling.',
      icon: '⚡',
    },
    {
      title: 'Localized Payments',
      description: 'Support Telebirr, cards, and diaspora-friendly wallets with transparent FX and on-demand balance snapshots.',
      icon: '🌍',
    },
    {
      title: 'Safety & Compliance',
      description: 'AI-powered profanity guards, manual escalations, and annual KYB reviews protect both creators and communities.',
      icon: '🛡️',
    },
    {
      title: 'Concierge Support',
      description: 'Live-chat coverage every day plus proactive alerts when audio, queue, or payouts need attention.',
      icon: '🤝',
    },
  ],
  am: [
    {
      title: 'የቀጥታ ልገሳ ፍሰት',
      description: 'ፈጣን ሰልፍ፣ ብራንድ የተደረጉ የማስታወቂያ ድምጾች እና እጅግ ፈጣን የጽዳት ሂደት ስትሪሙን ሳያቋርጡ ያቆያሉ።',
      icon: '⚡',
    },
    {
      title: 'የሀገር ውስጥ ክፍያዎች',
      description: 'ቴሌብርን፣ ካርዶችን እና ዲያስፖራ ተስማሚ የሆኑ አማራጮችን ከግልጽ ምንዛሬ እና የቀሪ ሂሳብ መግለጫ ጋር ይደግፋል።',
      icon: '🌍',
    },
    {
      title: 'ደህንነት እና ህጋዊነት',
      description: 'በAI የሚደገፍ የብልግና ቃላት ማጣሪያ፣ የእጅ ቁጥጥር እና ዓመታዊ የKYB ግምገማዎች ፈጣሪዎችን እና ማህበረሰቡን ይጠብቃሉ።',
      icon: '🛡️',
    },
    {
      title: 'ልዩ የደንበኛ ድጋፍ',
      description: 'በየቀኑ የሚገኝ የውይይት ድጋፍ፣ እንዲሁም በድምጽ፣ በሰልፍ ወይም በክፍያ ላይ እገዛ ሲያስፈልግ የሚደርስ ፈጣን ማሳወቂያ።',
      icon: '🤝',
    },
  ],
};

const stepsByLocale = {
  en: [
    {
      step: '01',
      title: 'Apply & Verify',
      body: 'Share your stream handles, complete KYB-lite, and unlock your secure link UUID in under 24 hours.',
    },
    {
      step: '02',
      title: 'Customize Experience',
      body: 'Pick voices, notification sounds, and safety filters while our concierge helps wire overlays and alerts.',
    },
    {
      step: '03',
      title: 'Monetize & Grow',
      body: 'Track donations, withdrawals, and campaign results in one dashboard—plus join seasonal spotlights.',
    },
  ],
  am: [
    {
      step: '01',
      title: 'ይመዝገቡ እና ያረጋግጡ',
      body: 'የስትሪም መለያዎን ያጋሩ፣ ቀላል የKYB ማረጋገጫ ያጠናቅቁ እና በ24 ሰዓት ውስጥ ደህንነቱ የተጠበቀ ሊንክ ያግኙ።',
    },
    {
      step: '02',
      title: 'ተሞክሮዎን ያብጁ',
      body: 'ድምጾችን፣ የማስታወቂያ ድምጾችን እና የደህንነት ማጣሪያዎችን ይምረጡ፤ የኛ ቡድንም ኦቨርሌዎችን ለማስተካከል ያግዛል።',
    },
    {
      step: '03',
      title: 'ይምጡ እና ይድጉ',
      body: 'ልገሳዎችን፣ ወጪዎችን እና የዘመቻ ውጤቶችን በአንድ ቦታ ይከታተሉ፤ እንዲሁም ወቅታዊ ስፖትላይቶችን ይቀላቀሉ።',
    },
  ],
};

const testimonialsByLocale = {
  en: [
    {
      quote: 'Habesha TTS finally gave our Amharic audience a native way to tip. The queue never misses a beat, even when the tab sleeps.',
      name: 'Feven Kebede',
      role: 'Variety Streamer',
    },
    {
      quote: 'Payouts hitting within the same day changed how we plan charity drives. The admin team feels like an extension of ours.',
      name: 'Studio K Promotions',
      role: 'Creator Agency',
    },
  ],
  am: [
    {
      quote: 'Habesha TTS ለአማርኛ ተመልካቾቻችን ተፈጥሯዊ የመለገስ መንገድ ሰጠ፤ ታብ ሲተኛ እንኳን ሰልፉ አይቆምም።',
      name: 'Feven Kebede',
      role: 'የተለያዩ ትርዒቶች ፈጣሪ',
    },
    {
      quote: 'በተመሳሳይ ቀን የሚደርሱ ክፍያዎች የበጎ አድራጎት ዕቅዶቻችንን ቀይረውታል፤ የአስተዳደር ቡድኑ ልክ እንደ እኛ የቡድን አባል ነው።',
      name: 'Studio K Promotions',
      role: 'የፈጣሪዎች ኤጀንሲ',
    },
  ],
};

const faqsByLocale = {
  en: [
    {
      q: 'How does the revenue share work?',
      a: 'Creators receive 60% of every paid donation automatically. Habesha TTS retains 40% to cover infrastructure, moderation, and concierge services.',
    },
    {
      q: 'Which platforms are supported?',
      a: 'Any platform that can open a browser source: Twitch, YouTube, TikTok Live, and custom RTMP players. Telegram dashboards stay synced everywhere.',
    },
    {
      q: 'What are the payout options?',
      a: 'Telebirr withdrawals only during the early access phase. Bank transfers and USD rails are on the roadmap, but today all payouts clear through Telebirr within 24 hours.',
    },
    {
      q: 'Is there a monthly fee?',
      a: 'No platform fee. You only share 40% of donations, with optional boosts that temporarily reduce the platform side by 5%.',
    },
  ],
  am: [
    {
      q: 'የገቢ ክፍፍሉ እንዴት ይሰራል?',
      a: 'ፈጣሪዎች ከእያንዳንዱ ልገሳ 60% ወዲያውኑ ያገኛሉ። Habesha TTS ለመሠረተ ልማት፣ ለቁጥጥር እና ለድጋፍ አገልግሎቶች 40% ያስቀራል።',
    },
    {
      q: 'የትኞቹን መድረኮች ትደግፋላችሁ?',
      a: 'የብራውዘር ሶርስ የሚቀበል ማንኛውም መድረክ፡ Twitch, YouTube, TikTok Live እና RTMP ፕሌየሮች። የቴሌግራም ዳሽቦርድ በሁሉም ቦታ አብሮ ይሰራል.',
    },
    {
      q: 'የክፍያ አማራጮች ምንድናቸው?',
      a: 'በቅድመ መዳረሻ ወቅት በቴሌብር ብቻ ነው። የባንክ እና የውጭ ሀገር ክፍያዎች በሂደት ላይ ናቸው፣ ነገር ግን በአሁን ሰዓት ሁሉም ክፍያዎች በቴሌብር በ24 ሰዓት ውስጥ ይፈጸማሉ።',
    },
    {
      q: 'ወርሃዊ ክፍያ አለወይ?',
      a: 'ምንም የመድረክ ክፍያ የለም። እርስዎ የሚካፈሉት ከልገሳ 40% ብቻ ነው፣ አማራጭ ማበረታቻዎች የመድረኩን ድርሻ በ5% ሊቀንሱት ይችላሉ።',
    },
  ],
};

const growthCardsByLocale = {
  en: [
    { title: 'Creator Playbooks', metric: 'Weekly launch checklist', detail: 'Review pacing, volume, and message templates' },
    { title: 'Agency Toolkit', metric: 'Multi-streamer controls', detail: 'Centralized withdrawals & reporting' },
    { title: 'Spotlight Calendar', metric: 'Monthly promos', detail: 'Co-marketing kits & shareable overlays' },
  ],
  am: [
    { title: 'የፈጣሪ መመሪያዎች', metric: 'ሳምንታዊ የማስጀመሪያ ዝርዝር', detail: 'ፍጥነትን፣ መጠንን እና የመልዕክት ቅንብሮችን ይገምግሙ' },
    { title: 'የኤጀንሲ መሣሪያዎች', metric: 'የባለብዙ-ፈጣሪ ቁጥጥር', detail: 'የተማከለ ክፍያ እና ሪፖርት' },
    { title: 'የስፖትላይት የቀን መቁጠሪያ', metric: 'ወርሃዊ ፕሮሞዎች', detail: 'የጋራ ማስታወቂያ ፓኬጆች እና የሚጋሩ ኦቨርሌይዎች' },
  ],
};

const pricingRowsByLocale = {
  en: [
    { volume: 'Br 10,000', creator: 'Br 6,000', platform: 'Br 4,000', perk: 'Baseline tier • concierge onboarding' },
    { volume: 'Br 25,000', creator: 'Br 15,000', platform: 'Br 10,000', perk: 'Priority payout lane • analytics coaching' },
    { volume: 'Br 50,000', creator: 'Br 30,000', platform: 'Br 20,000', perk: 'Performance bonus • co-marketing spotlight' },
  ],
  am: [
    { volume: 'Br 10,000', creator: 'Br 6,000', platform: 'Br 4,000', perk: 'መነሻ ደረጃ • የኮንሲየርጅ ማስጀመሪያ ድጋፍ' },
    { volume: 'Br 25,000', creator: 'Br 15,000', platform: 'Br 10,000', perk: 'የቅድሚያ ክፍያ መስመር • የትንታኔ ምክር' },
    { volume: 'Br 50,000', creator: 'Br 30,000', platform: 'Br 20,000', perk: 'የአፈጻጸም ቦነስ • የጋራ ማስታወቂያ ስፖትላይት' },
  ],
};

function LandingPage() {
  const [locale, setLocale] = useState('en');
  const t = translations[locale];
  const metrics = metricsByLocale[locale];
  const features = featuresByLocale[locale];
  const steps = stepsByLocale[locale];
  const testimonials = testimonialsByLocale[locale];
  const faqs = faqsByLocale[locale];
  const growthCards = growthCardsByLocale[locale];
  const pricingRows = pricingRowsByLocale[locale];
  const payoutSpeedValue = locale === 'en' ? '4h Avg.' : '4 ሰዓት አማካይ';

  return (
    <div className="bg-gradient-to-b from-white via-blue-50/40 to-white min-h-screen text-gray-900">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 -right-10 w-80 h-80 bg-secondary-200 opacity-40 blur-3xl" />
          <div className="absolute top-32 -left-20 w-72 h-72 bg-primary-200 opacity-30 blur-3xl" />
          <div className="absolute bottom-0 right-12 w-64 h-64 bg-success-200 opacity-30 blur-3xl" />
        </div>

        <header className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shadow-lg border border-gray-100 overflow-hidden">
                <img src={logoSrc} alt="Habesha TTS logo" className="w-full h-full object-cover transform scale-110" />
              </div>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-gray-500">Habesha TTS</p>
              <p className="text-lg font-semibold text-gray-900">{t.brandSubtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
              {navLinks.map((link) => (
                <a key={link.key} href={link.href} className="hover:text-gray-900">
                  {t[link.key]}
                </a>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              {localeOptions.map((option) => (
                <button
                  key={option.code}
                  type="button"
                  onClick={() => setLocale(option.code)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
                    locale === option.code ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'
                  }`}
                  aria-pressed={locale === option.code}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <a href="https://t.me/HabeshaTTS_bot" target="_blank" rel="noreferrer" className="btn btn-primary">
              {t.headerPrimaryCTA}
            </a>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <section className="py-16 sm:py-20 lg:py-24" id="hero">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 text-primary-700 text-xs font-semibold">
                  {t.heroBadge}
                </p>
                <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight">
                  {t.heroHeadingStart}{' '}
                  <span className="text-primary-600">{t.heroHeadingHighlight}</span>{' '}
                  {t.heroHeadingEnd}
                </h1>
                <p className="mt-6 text-lg text-gray-600">{t.heroDescription}</p>
                <div className="mt-8 flex flex-wrap gap-4">
                  <a href="#features" className="btn btn-secondary">
                    {t.heroCTASecondary}
                  </a>
                </div>
                <div className="mt-10 flex flex-wrap gap-6 text-sm text-gray-500">
                  <div>
                    <p className="text-2xl font-bold text-gray-900">60% / 40%</p>
                    <p>{t.heroStatSplit}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{payoutSpeedValue}</p>
                    <p>{t.heroStatSpeed}</p>
                  </div>
                </div>
              </div>
              <div className="relative">
                <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-secondary-200 opacity-50 blur-xl" />
                <div className="absolute bottom-0 left-6 w-32 h-32 rounded-full bg-primary-200 opacity-60 blur-2xl" />
                <div className="relative bg-white rounded-3xl shadow-2xl border border-gray-100 p-6 space-y-6">
                  <div>
                    <p className="text-sm text-gray-500">{t.heroCardQueueTitle}</p>
                    <div className="mt-3 space-y-3">
                      {[1, 2, 3].map((item) => (
                        <div
                          key={item}
                          className="p-4 rounded-2xl border border-gray-100 bg-gradient-to-r from-white to-blue-50/40 flex items-center justify-between"
                        >
                          <div>
                            <p className="font-semibold text-gray-900">{t.heroCardDonationLabel} #{item * 37}</p>
                            <p className="text-xs text-gray-500">Br {item * 150} — "መልካም ስራ!"</p>
                          </div>
                          <span className="text-sm text-primary-600 font-semibold">{t.heroCardReady}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-gray-100 p-4 bg-gradient-to-br from-primary-500/10 to-secondary-500/10">
                    <p className="text-xs text-gray-500">{t.heroCardWeekLabel}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">Br 42,560</p>
                    <p className="text-sm text-gray-500">{t.heroCardWeekChange}</p>
                    <p className="text-xs text-gray-500">{t.heroCardWeekSubtitle}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-16 grid sm:grid-cols-3 gap-6">
              {metrics.map((metric) => (
                <div key={metric.label} className="p-6 rounded-2xl border border-gray-100 bg-white/80 backdrop-blur">
                  <p className="text-sm text-gray-500 uppercase tracking-wide">{metric.label}</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">{metric.value}</p>
                  <p className="text-sm text-gray-500">{metric.detail}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="features" className="py-16">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary-600">{t.featuresOverline}</p>
                <h2 className="mt-3 text-3xl font-bold text-gray-900">{t.featuresHeading}</h2>
                <p className="mt-3 text-gray-600 max-w-2xl">{t.featuresDescription}</p>
              </div>
              <a href="#pricing" className="text-primary-600 font-semibold text-sm">
                {t.featuresLink}
              </a>
            </div>
            <div className="mt-10 grid md:grid-cols-2 gap-6">
              {features.map((feature) => (
                <div key={feature.title} className="p-6 rounded-2xl border border-gray-100 bg-white hover:shadow-lg transition-all duration-200">
                  <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center text-2xl">{feature.icon}</div>
                  <h3 className="mt-4 text-xl font-semibold text-gray-900">{feature.title}</h3>
                  <p className="mt-2 text-gray-600">{feature.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="py-16" id="growth">
            <div className="rounded-3xl border border-gray-100 bg-gradient-to-br from-white via-indigo-50 to-blue-50 p-8 lg:p-12">
              <div className="grid lg:grid-cols-2 gap-10 items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-secondary-600">{t.growthOverline}</p>
                  <h2 className="mt-4 text-3xl font-bold text-gray-900">{t.growthHeading}</h2>
                  <p className="mt-4 text-gray-700">{t.growthDescription}</p>
                  <ul className="mt-6 space-y-3 text-gray-700">
                    {[t.growthBullet1, t.growthBullet2, t.growthBullet3].map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <span className="mt-1 text-primary-600">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-8 flex flex-wrap gap-4">
                    <a href="https://t.me/HabeshaTTS_bot" target="_blank" rel="noreferrer" className="btn btn-primary">
                      {t.growthCTA}
                    </a>
                  </div>
                </div>
                <div className="space-y-6">
                  {growthCards.map((card) => (
                    <div key={card.title} className="rounded-2xl border border-white/60 bg-white/80 backdrop-blur p-6 shadow-lg">
                      <p className="text-sm text-gray-500">{card.title}</p>
                      <p className="mt-3 text-2xl font-bold text-gray-900">{card.metric}</p>
                      <p className="text-sm text-gray-500">{card.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="py-16">
            <div className="grid lg:grid-cols-3 gap-6">
              {steps.map((item) => (
                <div key={item.step} className="p-6 rounded-2xl border border-gray-100 bg-white">
                  <p className="text-sm font-semibold text-primary-600">{item.step}</p>
                  <h3 className="mt-3 text-xl font-bold text-gray-900">{item.title}</h3>
                  <p className="mt-2 text-gray-600">{item.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="py-16">
            <div className="grid md:grid-cols-2 gap-6">
              {testimonials.map((item) => (
                <div key={item.name} className="p-8 rounded-3xl border border-gray-100 bg-white shadow-sm">
                  <p className="text-4xl text-gray-300">“</p>
                  <p className="mt-4 text-lg text-gray-800">{item.quote}</p>
                  <div className="mt-6">
                    <p className="font-semibold text-gray-900">{item.name}</p>
                    <p className="text-sm text-gray-500">{item.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section id="pricing" className="py-16">
            <div className="rounded-3xl border border-gray-100 bg-white p-8 lg:p-12 shadow-xl">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary-600">{t.revenueOverline}</p>
                  <h2 className="mt-3 text-3xl font-bold text-gray-900">{t.revenueHeading}</h2>
                  <p className="mt-3 text-gray-600 max-w-2xl">{t.revenueDescription}</p>
                </div>
                <div className="text-center p-6 rounded-2xl bg-gradient-to-br from-primary-500 to-secondary-500 text-white">
                  <p className="text-sm uppercase tracking-wider">{t.revenueCardLabel}</p>
                  <p className="mt-2 text-4xl font-extrabold">Br 18,400</p>
                  <p className="text-sm">{t.revenueCardSubtitle}</p>
                </div>
              </div>
              <div className="mt-10 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-gray-500">
                      <th className="py-3 pr-6">{t.pricingHeaderVolume}</th>
                      <th className="py-3 pr-6">{t.pricingHeaderCreator}</th>
                      <th className="py-3 pr-6">{t.pricingHeaderPlatform}</th>
                      <th className="py-3">{t.pricingHeaderPerks}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pricingRows.map((row) => (
                      <tr key={row.volume}>
                        <td className="py-4 pr-6 font-semibold text-gray-900">{row.volume}</td>
                        <td className="py-4 pr-6">{row.creator}</td>
                        <td className="py-4 pr-6">{row.platform}</td>
                        <td className="py-4">{row.perk}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section id="faq" className="py-16">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-3xl font-bold text-center text-gray-900">{t.faqHeading}</h2>
              <p className="mt-3 text-center text-gray-600">{t.faqDescription}</p>
              <div className="mt-10 space-y-4">
                {faqs.map((item) => (
                  <div key={item.q} className="p-6 rounded-2xl border border-gray-100 bg-white">
                    <p className="font-semibold text-gray-900">{item.q}</p>
                    <p className="mt-2 text-gray-600">{item.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="py-16">
            <div className="rounded-3xl border border-gray-100 bg-gradient-to-br from-primary-500 to-secondary-500 text-white p-10 text-center shadow-2xl">
              <p className="text-sm uppercase tracking-[0.3em] text-white/80">{t.ctaOverline}</p>
              <h2 className="mt-4 text-4xl font-extrabold">{t.ctaHeading}</h2>
              <p className="mt-4 text-lg text-white/90 max-w-3xl mx-auto">{t.ctaDescription}</p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <a href="https://t.me/HabeshaTTS_bot" target="_blank" rel="noreferrer" className="btn bg-white text-primary-600 border-white">
                  {t.ctaPrimary}
                </a>
              </div>
            </div>
          </section>
        </main>

        <footer className="py-10 border-t border-gray-100 px-4 sm:px-6 lg:px-8 text-sm text-gray-500">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <p>© {new Date().getFullYear()} Habesha TTS. {t.footerTagline}</p>
            <div className="flex gap-4">
              <a href="tel:+251939976687" className="hover:text-gray-900">
                {t.footerContact}
              </a>
              <a href="mailto:support@habeshatts.com" className="hover:text-gray-900">
                {t.footerSupport}
              </a>
              <a href="https://t.me/HabeshaTTS_bot" target="_blank" rel="noreferrer" className="hover:text-gray-900">
                {t.footerPartner}
              </a>
              <a href="https://www.instagram.com/habeshatts/" target="_blank" rel="noreferrer" className="hover:text-gray-900">
                {t.footerSocial}
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default LandingPage;