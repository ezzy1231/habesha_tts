import { useCallback, useSyncExternalStore } from 'react';

/*
 * Tiny i18n helper.
 *   t('nav.live')                 → "Live" / "ቀጥታ"
 *   t('greeting', { name: 'Abebe' }) → interpolates {name}
 * Missing keys fall back to English, then to the key itself.
 * The chosen language is persisted in localStorage under "lang".
 */

export const LANGUAGES = [
  { code: 'am', label: 'አማርኛ', short: 'አማ' },
  { code: 'en', label: 'English', short: 'EN' },
];

const STORAGE_KEY = 'lang';
const DEFAULT_LANG = 'am';

export const dictionaries = {
  en: {
    'app.name': 'Habesha TTS',
    'app.tagline': 'Your viewers’ messages, read aloud live in Amharic.',
    'nav.home': 'Home',
    'nav.streamers': 'Streamers',
    'nav.pricing': 'Pricing',
    'nav.login': 'Streamer login',
    'nav.signup': 'Become a streamer',
    'nav.live': 'Live',
    'nav.donations': 'Donations',
    'nav.soundboard': 'Soundboard',
    'nav.media': 'Media queue',
    'nav.overlay': 'Overlay',
    'nav.analytics': 'Analytics',
    'nav.payouts': 'Payouts',
    'nav.settings': 'Settings',
    'nav.overview': 'Overview',
    'nav.users': 'Streamers',
    'nav.moderation': 'Moderation',
    'nav.payments': 'Payments',
    'nav.reports': 'Reports',
    'nav.logout': 'Log out',
    'nav.openMenu': 'Open menu',
    'nav.closeMenu': 'Close menu',
    'nav.collapse': 'Collapse sidebar',
    'nav.expand': 'Expand sidebar',
    'nav.mainNav': 'Main navigation',
    'nav.skip': 'Skip to content',
    'theme.toggle': 'Toggle theme',
    'theme.light': 'Light mode',
    'theme.dark': 'Dark mode',
    'lang.label': 'Language',
    'footer.rights': 'All rights reserved.',
    'footer.madeIn': 'Made in Ethiopia',
    'footer.terms': 'Terms',
    'footer.privacy': 'Privacy',
    'footer.support': 'Support',
    'admin.badge': 'Admin',
    'common.copy': 'Copy',
    'common.copied': 'Copied',
    'common.show': 'Show',
    'common.hide': 'Hide',
    'common.close': 'Close',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.save': 'Save',
    'common.loading': 'Loading…',
    'common.noData': 'Nothing here yet',
    'common.required': 'required',
    'table.sortBy': 'Sort by {column}',
    'status.live': 'Live',
    'status.offline': 'Offline',
  },
  am: {
    'app.name': 'ሀበሻ TTS',
    'app.tagline': 'የተመልካቾችዎ መልዕክቶች በቀጥታ በአማርኛ ይነበባሉ።',
    'nav.home': 'መነሻ',
    'nav.streamers': 'ስትሪመሮች',
    'nav.pricing': 'ዋጋ',
    'nav.login': 'የስትሪመር መግቢያ',
    'nav.signup': 'ስትሪመር ይሁኑ',
    'nav.live': 'ቀጥታ',
    'nav.donations': 'ስጦታዎች',
    'nav.soundboard': 'የድምፅ ሰሌዳ',
    'nav.media': 'የሚዲያ ወረፋ',
    'nav.overlay': 'ኦቨርሌይ',
    'nav.analytics': 'ትንታኔ',
    'nav.payouts': 'ክፍያዎች',
    'nav.settings': 'ቅንብሮች',
    'nav.overview': 'አጠቃላይ',
    'nav.users': 'ስትሪመሮች',
    'nav.moderation': 'ቁጥጥር',
    'nav.payments': 'ክፍያዎች',
    'nav.reports': 'ሪፖርቶች',
    'nav.logout': 'ውጣ',
    'nav.openMenu': 'ምናሌ ክፈት',
    'nav.closeMenu': 'ምናሌ ዝጋ',
    'nav.collapse': 'የጎን አሞሌ ሰብስብ',
    'nav.expand': 'የጎን አሞሌ ዘርጋ',
    'nav.mainNav': 'ዋና ማውጫ',
    'nav.skip': 'ወደ ይዘቱ ዝለል',
    'theme.toggle': 'ገጽታ ቀይር',
    'theme.light': 'ብሩህ ገጽታ',
    'theme.dark': 'ጨለማ ገጽታ',
    'lang.label': 'ቋንቋ',
    'footer.rights': 'መብቱ በህግ የተጠበቀ ነው።',
    'footer.madeIn': 'በኢትዮጵያ የተሰራ',
    'footer.terms': 'ውሎች',
    'footer.privacy': 'ግላዊነት',
    'footer.support': 'እገዛ',
    'admin.badge': 'አስተዳዳሪ',
    'common.copy': 'ቅዳ',
    'common.copied': 'ተቀድቷል',
    'common.show': 'አሳይ',
    'common.hide': 'ደብቅ',
    'common.close': 'ዝጋ',
    'common.cancel': 'ሰርዝ',
    'common.confirm': 'አረጋግጥ',
    'common.save': 'አስቀምጥ',
    'common.loading': 'በመጫን ላይ…',
    'common.noData': 'እስካሁን ምንም የለም',
    'common.required': 'የግድ',
    'table.sortBy': 'በ{column} ደርድር',
    'status.live': 'ቀጥታ',
    'status.offline': 'ከመስመር ውጭ',
  },
};

function readInitial() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && dictionaries[saved]) return saved;
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_LANG;
}

let currentLang = typeof window === 'undefined' ? DEFAULT_LANG : readInitial();
const listeners = new Set();

function applyDocumentLang(lang) {
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}
applyDocumentLang(currentLang);

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  if (!dictionaries[lang] || lang === currentLang) return;
  currentLang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* storage unavailable */
  }
  applyDocumentLang(lang);
  listeners.forEach((fn) => fn());
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Translate `key` in the current (or given) language, interpolating {vars}. */
export function t(key, vars, lang = currentLang) {
  const raw = dictionaries[lang]?.[key] ?? dictionaries.en[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m));
}

/** Add or override keys at runtime (pages can ship their own strings). */
export function extendDictionaries(extra) {
  Object.entries(extra).forEach(([lang, entries]) => {
    dictionaries[lang] = { ...(dictionaries[lang] || {}), ...entries };
  });
}

/**
 * React hook: re-renders on language change.
 * const { t, lang, setLang } = useI18n();
 */
export function useI18n() {
  const lang = useSyncExternalStore(subscribe, getLang, () => DEFAULT_LANG);
  const translate = useCallback((key, vars) => t(key, vars, lang), [lang]);
  return { t: translate, lang, setLang };
}
