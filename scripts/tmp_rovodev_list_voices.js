import 'dotenv/config'
import { GoogleAuth } from 'google-auth-library'
import axios from 'axios'

async function main() {
  try {
    const auth = new GoogleAuth({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    })
    const client = await auth.getClient()
    const token = (await client.getAccessToken()).token

    const url = 'https://texttospeech.googleapis.com/v1/voices'
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      params: { languageCode: 'am-ET' },
      timeout: 20000,
    })

    const voices = res.data?.voices || []
    console.log(`Found ${voices.length} voices for am-ET`)
    for (const v of voices) {
      console.log(JSON.stringify({
        name: v.name,
        languageCodes: v.languageCodes,
        ssmlGender: v.ssmlGender,
        naturalSampleRateHertz: v.naturalSampleRateHertz,
      }))
    }
  } catch (e) {
    console.error('List voices failed:', e?.response?.status, e?.response?.data || e?.message || e)
  }
}

main()
