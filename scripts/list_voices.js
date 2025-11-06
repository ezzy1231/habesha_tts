import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const ttsClient = new TextToSpeechClient();

async function listAllVoices() {
  console.log('Fetching voices from Google Cloud TTS...');
  try {
    const [result] = await ttsClient.listVoices({});
    const voices = result.voices;

    const amharicVoices = {
      cloud: [],
      gemini: [],
    };

    voices.forEach(voice => {
      if (voice.languageCodes[0] === 'am-ET') {
        const voiceInfo = {
          name: voice.name,
          gender: voice.ssmlGender,
        };
        // A simple heuristic to distinguish Gemini voices
        if (voice.name.toLowerCase().includes('gemini')) {
          amharicVoices.gemini.push(voiceInfo);
        } else if (voice.name.includes('Wavenet') || voice.name.includes('Standard')) {
          amharicVoices.cloud.push(voiceInfo);
        }
      }
    });

    console.log('\n--- Amharic Voices ---');
    console.log('Cloud TTS (Standard & Wavenet):');
    if (amharicVoices.cloud.length > 0) {
      console.table(amharicVoices.cloud);
    } else {
      console.log('No standard Amharic voices found.');
    }

    console.log('\nGemini TTS (Experimental):');
    if (amharicVoices.gemini.length > 0) {
      console.table(amharicVoices.gemini);
    } else {
      console.warn('⚠️ No Amharic Gemini voices found. This might be a permission issue or they may not be available in your region.');
      console.log('To enable Gemini voices, ensure your Google Cloud project has the "Cloud Text-to-Speech API" enabled and that your service account has the "Vertex AI User" role.');
    }

  } catch (error) {
    console.error('❌ Error fetching voices:', error.message);
  }
}

listAllVoices();
