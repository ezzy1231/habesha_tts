#!/bin/bash
set -e

echo "🚀 Deploying Habesha TTS Backend to Cloud Run..."

# Get project info
PROJECT_ID=$(gcloud config get-value project)
FRONTEND_URL=${FRONTEND_URL:-https://habeshatts.com}
echo "📦 Project: $PROJECT_ID"
echo "🌍 Frontend URL: $FRONTEND_URL"

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
  --max-instances 1 \
  --min-instances 1 \
  --set-env-vars "NODE_ENV=production,FRONTEND_URL=${FRONTEND_URL},TTS_OUTPUT_PATH=./public/audios,JWT_EXPIRES_IN=3d,BOT_STATE_DUAL_WRITE=false,BOT_STATE_ENABLED_REDIS=true,ADMIN_ALLOW_UNPROTECTED=false,COOKIE_SAMESITE=none,COOKIE_SECURE=true,CROSS_SITE_COOKIES=true,ENABLE_STREAMER_OTP=true,LEDGER_READ_FALLBACK=true,ENABLE_GEMINI_TTS=true,GEMINI_TTS_MODEL=gemini-2.5-pro-tts,GEMINI_TTS_AUDIO_ENCODING=MP3,GEMINI_TTS_VOICE=Puck,GCS_AUDIO_BUCKET=habeshatts-audio-1049480160920" \
  --update-secrets="TELEGRAM_BOT_TOKEN=telegram-bot-token:latest,JWT_SECRET=jwt-secret:latest,ADMIN_TOKEN=admin-token:latest,DATABASE_URL=database-url:latest,REDIS_URL=redis-url:latest"

# Get service URL
SERVICE_URL=$(gcloud run services describe habeshatts-backend \
  --region us-central1 \
  --format="value(status.url)")

gcloud run services update habeshatts-backend \
  --region us-central1 \
  --update-env-vars "BASE_URL=${SERVICE_URL},FRONTEND_URL=${FRONTEND_URL}"

echo ""
echo "✅ Deployment complete!"
echo "🌐 Service URL: $SERVICE_URL"
echo ""

echo "📊 View logs:"
echo "   gcloud run services logs read habeshatts-backend --region us-central1"
echo ""
echo "ℹ️  Bot runtime uses polling. Do not set a Telegram webhook unless you convert the bot to webhook mode."
echo "🎉 Deployment complete!"