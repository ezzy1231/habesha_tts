import 'dotenv/config'
import { GoogleAuth } from 'google-auth-library'
import axios from 'axios'

async function main() {
  try {
    const auth = new GoogleAuth({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ['https://www.googleapis.com/auth/generative-language'],
    })
    const client = await auth.getClient()
    const token = (await client.getAccessToken()).token

    const url = 'https://generativelanguage.googleapis.com/v1beta/models'
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      params: { pageSize: 200 },
      timeout: 20000,
    })

    const models = res.data?.models || []
    console.log(`Found ${models.length} models`)
    // Print TTS-relevant
    const tts = models.filter(m => /tts/i.test(m.name) || /audio/i.test(JSON.stringify(m.capabilities || m.supportedGenerationMethods || m)))
    console.log('TTS-related models:')
    for (const m of tts) {
      console.log(JSON.stringify({
        name: m.name,
        displayName: m.displayName,
        version: m.version,
        supportedGenerationMethods: m.supportedGenerationMethods,
        inputTokenLimit: m.inputTokenLimit,
        outputTokenLimit: m.outputTokenLimit,
        capabilities: m.capabilities,
      }, null, 2))
    }
  } catch (e) {
    console.error('ListModels failed:', e?.response?.status, e?.response?.data || e?.message || e)
  }
}

main()
