#!/bin/bash
set -e

echo "🚀 Deploying Habesha TTS Backend to Cloud Run..."

# Get project info
PROJECT_ID=$(gcloud config get-value project)
echo "📦 Project: $PROJECT_ID"

# Deploy to Cloud Run
echo "🔨 Building and deploying..."
gcloud run deploy habeshatts-backend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 10 \
  --min-instances 1 \
  --set-env-vars "NODE_ENV=production,BASE_URL=https://habeshatts-backend-62326829300.us-central1.run.app,FRONTEND_URL=https://habeshatts.com,TTS_OUTPUT_PATH=./public/audios,JWT_EXPIRES_IN=3d,BOT_STATE_DUAL_WRITE=false,BOT_STATE_ENABLED_REDIS=true,ADMIN_ALLOW_UNPROTECTED=false,COOKIE_SAMESITE=none,COOKIE_SECURE=true,CROSS_SITE_COOKIES=true,ENABLE_STREAMER_OTP=true,LEDGER_READ_FALLBACK=true,ENABLE_GEMINI_TTS=true,GEMINI_TTS_MODEL=gemini-2.5-pro-tts,GEMINI_TTS_AUDIO_ENCODING=MP3,GEMINI_TTS_VOICE=Puck,GOOGLE_APPLICATION_CREDENTIALS=/secrets/google-credentials.json" \
  --update-secrets="TELEGRAM_BOT_TOKEN=telegram-bot-token:latest,JWT_SECRET=jwt-secret:latest,ADMIN_TOKEN=admin-token:latest,GEMINI_API_KEY=gemini-api-key:latest,DATABASE_URL=database-url:latest,REDIS_URL=redis-url:latest,/secrets/google-credentials.json=google-credentials:latest"

# Get service URL
SERVICE_URL=$(gcloud run services describe habeshatts-backend \
  --region us-central1 \
  --format="value(status.url)")

echo ""
echo "✅ Deployment complete!"
echo "🌐 Service URL: $SERVICE_URL"
echo ""

# Test health endpoint
echo "🏥 Testing health endpoint..."
sleep 5
curl -s $SERVICE_URL/health | jq '.' || echo "Health check response received"

echo ""
echo "📱 Setting Telegram webhook..."
curl -s -X POST "https://api.telegram.org/bot8428544187:AAHA7ZePfcMOqiQm2wJS1HTB75fbwZjdoOk/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"$SERVICE_URL/webhook\"}" | jq '.'

echo ""
echo "✅ Telegram webhook set!"
echo ""
echo "🔍 Verifying webhook..."
curl -s "https://api.telegram.org/bot8428544187:AAHA7ZePfcMOqiQm2wJS1HTB75fbwZjdoOk/getWebhookInfo" | jq '.'

echo ""
echo "📊 View logs:"
echo "   gcloud run services logs read habeshatts-backend --region us-central1"
echo ""
echo "🎉 Deployment complete! Test your bot in Telegram."