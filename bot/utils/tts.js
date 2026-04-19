import { GoogleAuth } from 'google-auth-library';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { Storage } from '@google-cloud/storage';

const ttsClient = new TextToSpeechClient();
const storage = new Storage();
const GCS_BUCKET = process.env.GCS_AUDIO_BUCKET || 'habeshatts-audio';
let voiceCache = null;

// Custom error for content moderation failures
export class ContentModerationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ContentModerationError';
  }
}

// --------------------
// Text Sanitization
// --------------------
function sanitizeText(text) {
  if (!text) return '';
  // Remove invisible characters, control characters, and non-readable content
  // This helps prevent moderation errors with TTS services
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-width spaces
    .replace(/[\p{C}]/gu, '') // Control characters
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim();
}


// --------------------
// Voice Discovery
// --------------------
export async function getAvailableVoices() {
  if (voiceCache) {
    return voiceCache;
  }

  console.log('Fetching voices from Google Cloud TTS...');
  try {
    const [result] = await ttsClient.listVoices({ languageCode: 'am-ET' });
    const voices = result.voices;

    const amharicVoices = {
      cloud: [],
      gemini: [],
    };

    voices.forEach(voice => {
      const voiceInfo = {
        name: voice.name,
        gender: voice.ssmlGender,
        engine: 'cloud', // Default engine
      };
      // Simple heuristic to distinguish Gemini voices
      if (voice.name.toLowerCase().includes('gemini')) {
        voiceInfo.engine = 'gemini';
        amharicVoices.gemini.push(voiceInfo);
      } else if (voice.name.includes('Wavenet') || voice.name.includes('Standard')) {
        amharicVoices.cloud.push(voiceInfo);
      }
    });

    voiceCache = amharicVoices;
    return amharicVoices;
  } catch (error) {
    console.error('❌ Error fetching voices:', error.message);
    // Return empty lists on error
    return { cloud: [], gemini: [] };
  }
}


// --------------------
// GCS Upload Helper
// --------------------
async function uploadToGCS(localPath, fileName) {
  const bucket = storage.bucket(GCS_BUCKET);
  await bucket.upload(localPath, {
    destination: `audios/${fileName}`,
    metadata: { contentType: 'audio/mpeg', cacheControl: 'public, max-age=86400' },
  });
  // Clean up local file
  await fs.unlink(localPath).catch(() => {});
  return `https://storage.googleapis.com/${GCS_BUCKET}/audios/${fileName}`;
}


// --------------------
// Cloud TTS (Standard)
// --------------------
async function getCloudClient() {
  const authOptions = {
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  };

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    authOptions.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }

  const auth = new GoogleAuth(authOptions);
  return await auth.getClient();
}

async function generateCloudTTS(donationId, text, voice = 'am-ET-Wavenet-A') {
  const client = await getCloudClient();
  const accessToken = (await client.getAccessToken()).token;

  const response = await axios.post(
    'https://texttospeech.googleapis.com/v1/text:synthesize',
    {
      input: { ssml: text },
      voice: { languageCode: 'am-ET', name: voice },
      audioConfig: { audioEncoding: 'MP3' },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const outputDir = process.env.TTS_OUTPUT_PATH || './public/audios';
  await fs.mkdir(outputDir, { recursive: true });
  const fileName = `donation_${donationId}_cloud.mp3`;
  const filePath = path.join(outputDir, fileName);
  await fs.writeFile(filePath, response.data.audioContent, 'base64');
  return await uploadToGCS(filePath, fileName);
}

// --------------------
// Gemini TTS (Experimental)
// --------------------
async function generateGeminiTTS(donationId, text, prompt, voice) {
  const outputDir = process.env.TTS_OUTPUT_PATH || './public/audios';
  await fs.mkdir(outputDir, { recursive: true });
  const fileName = `donation_${donationId}_gemini.mp3`;
  const filePath = path.join(outputDir, fileName);

  const request = {
    input: {
      text: text,
      prompt: prompt
    },
    voice: {
      languageCode: 'am-ET',
      name: voice,
      modelName: 'gemini-2.5-pro-tts'
    },
    audioConfig: {
      audioEncoding: 'MP3'
    }
  };

  try {
    const [response] = await ttsClient.synthesizeSpeech(request);
    await fs.writeFile(filePath, response.audioContent, 'binary');
    console.log(`✅ Audio content written to file: ${fileName}`);
    return await uploadToGCS(filePath, fileName);
  } catch (error) {
    console.error('ERROR during Gemini speech synthesis:', error);
    if (error.code === 3) { // 3 = INVALID_ARGUMENT
      // Log the exact text and prompt for debugging moderation issues
      console.error(`[ContentModerationError] Text: "${text}", Prompt: "${prompt}"`);
      throw new ContentModerationError(error.details || 'Content moderation failure');
    }
    throw error;
  }
}


// --------------------
// Unified Dispatcher
// --------------------
export async function generateTTS(donationId, text, engine = 'cloud', voice, prompt = '') {
  // Sanitize text for invisible characters, etc., but keep SSML tags
  const sanitizedSsml = sanitizeText(text);
  if (!sanitizedSsml) {
    throw new Error('Sanitized text is empty, skipping TTS.');
  }

  try {
    const enableGemini = String(process.env.ENABLE_GEMINI_TTS || 'false').toLowerCase() === 'true'
    if (engine === 'gemini' && enableGemini) {
      // Gemini API works better with plain text, so we strip SSML tags here
      const plainText = sanitizedSsml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      return await generateGeminiTTS(donationId, plainText, prompt, voice)
    }
    // For standard cloud TTS, we pass the sanitized SSML
    return await generateCloudTTS(donationId, sanitizedSsml, voice)
  } catch (err) {
    console.error('❌ TTS error:', err)
    // Re-throw custom error to be caught by payment logic
    if (err instanceof ContentModerationError) {
      throw err;
    }
    // For any other error, re-throw it to be handled by the worker
    throw err;
  }
}