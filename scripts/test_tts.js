import 'dotenv/config'
import { generateTTS } from '../src/utils/tts.js'

async function testTTS() {
  const engine = process.argv[2] || 'cloud'
  const voice = process.argv[3]
  console.log(`🧪 Testing TTS engine: ${engine}`)
  console.log('GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS)

  const plainText = 'Selam! This is a test donation message for TTS.'
  const ssml = '<speak>Selam! <break time="500ms"/> This is a test donation message for TTS.</speak>'
  const input = engine === 'gemini' ? plainText : ssml

  try {
    const file = await generateTTS(`test_${engine}`, input, engine, voice || (engine==='cloud' ? 'am-ET-Wavenet-A' : process.env.GEMINI_TTS_VOICE || 'Puck'))
    console.log('✅ TTS successful:', file)
  } catch (e) {
    console.error('❌ TTS failed:', e?.message || e)
  }
}

testTTS()
