// Voices offered to donors, shared by the Telegram bot and the web donation page.

export const CLOUD_VOICES = [
  { engine: 'cloud', voice: 'am-ET-Wavenet-A', label: 'ሴት (Wavenet)', labelEn: 'Female (Wavenet)', gender: 'female' },
  { engine: 'cloud', voice: 'am-ET-Wavenet-B', label: 'ወንድ (Wavenet)', labelEn: 'Male (Wavenet)', gender: 'male' },
];

export const GEMINI_VOICES = [
  { voice: 'Kore', label: 'የተቆጣች ሴት', labelEn: 'Annoyed (F)', gender: 'female', style: 'A high-pitched and sharply annoyed tone, with rising volume and clipped delivery.' },
  { voice: 'Charon', label: 'የተነሳሳ ወንድ', labelEn: 'Excited (M)', gender: 'male', style: 'An upbeat and enthusiastic tone, like a thrilled news anchor.' },
  { voice: 'Sulafat', label: 'የተደሰተች ሴት', labelEn: 'Happy (F)', gender: 'female', style: 'A sincere, contented, and friendly tone, sounding genuinely pleased and warm.' },
  { voice: 'Zubenelgenubi', label: 'የተማረረ ወንድ', labelEn: 'Heartbroken (M)', gender: 'male', style: 'A hollow, heartbroken, and desolate tone, with a very slow, heavy, and resigned pace.' },
  { voice: 'Aoede', label: 'የተናደደች ሴት', labelEn: 'Angry (F)', gender: 'female', style: 'A commanding, irritated tone, with a deliberate, firm, and slightly harsh cadence.' },
  { voice: 'Enceladus', label: 'የፈነደቀ ወንድ', labelEn: 'Proud (M)', gender: 'male', style: 'A deep, confident, and satisfied tone, conveying professional pride and pleasure.' },
  { voice: 'Vindemiatrix', label: 'የተከፋች ሴት', labelEn: 'Sad (F)', gender: 'female', style: 'A soft, somber, and weary tone, conveying exhaustion and grief.' },
  { voice: 'Achird', label: 'የተበሳጨ ወንድ', labelEn: 'Frustrated (M)', gender: 'male', style: 'A frustrated, slightly defensive tone, with a slightly strained pace.' },
  { voice: 'Despina', label: 'የጓጓች ሴት', labelEn: 'Eager (F)', gender: 'female', style: 'An energetic and highly inviting tone, expressing eagerness and anticipation.' },
  { voice: 'Iapetus', label: 'የተዝናና ወንድ', labelEn: 'Amused (M)', gender: 'male', style: 'A lighthearted, warm, and amused tone, with a casual, approachable quality.' },
].map((v) => ({ ...v, engine: 'gemini' }));

export const isGeminiEnabled = () => String(process.env.ENABLE_GEMINI_TTS).toLowerCase() === 'true';

/** Voices currently available, in display order. */
export function availableVoices() {
  return [...(isGeminiEnabled() ? GEMINI_VOICES : []), ...CLOUD_VOICES];
}

/** The voice entry for engine + voice, or null if it isn't offered. */
export function findVoice(engine, voice) {
  return availableVoices().find((v) => v.engine === engine && v.voice === voice) || null;
}

export function stylePromptFor(engine, voice) {
  if (engine !== 'gemini') return '';
  return GEMINI_VOICES.find((v) => v.voice === voice)?.style || '';
}

/** Escape text for SSML so donor input can't inject tags (e.g. <audio src=...>) or break the request. */
export function escapeSsml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** The SSML read on stream. Masked words (***) are dropped from speech. */
export function buildSpokenText(donorName, message) {
  const say = (s) => escapeSsml(String(s ?? '').replace(/\*{3,}/g, ' ').replace(/\s{2,}/g, ' ').trim());
  return `<speak>ልገሳ ከ <break time="0.4s"/> ${say(donorName) || 'ስም የሌለው'} <break time="0.4s"/> መልዕክት <break time="1s"/> ${say(message)}</speak>`;
}
