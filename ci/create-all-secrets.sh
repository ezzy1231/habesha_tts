#!/bin/bash
set -e

echo "🔐 Creating ALL secrets in Secret Manager..."

# Get project info
PROJECT_ID=$(gcloud config get-value project)
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

echo "📦 Project: $PROJECT_ID"
echo "🔢 Project Number: $PROJECT_NUMBER"
echo ""

# # Create all secrets
# echo "✨ Creating telegram-bot-token..."
# echo -n "8428544187:AAHA7ZePfcMOqiQm2wJS1HTB75fbwZjdoOk" | \
#   gcloud secrets create telegram-bot-token \
#   --data-file=- \
#   --replication-policy="automatic"

# echo "✨ Creating jwt-secret..."
# echo -n "163551" | \
#   gcloud secrets create jwt-secret \
#   --data-file=- \
#   --replication-policy="automatic"

# echo "✨ Creating admin-token..."
# echo -n "163551" | \
#   gcloud secrets create admin-token \
#   --data-file=- \
#   --replication-policy="automatic"

# echo "✨ Creating gemini-api-key..."
# echo -n "AIzaSyBEH1VhuC46nCiW1xZ4lK-edfBBuBkcwlI" | \
#   gcloud secrets create gemini-api-key \
#   --data-file=- \
#   --replication-policy="automatic"

# echo "✨ Creating database-url..."
# echo -n "postgresql://neondb_owner:npg_9WIkAJdy2owB@ep-small-poetry-ad7tupun-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require" | \
#   gcloud secrets create database-url \
#   --data-file=- \
#   --replication-policy="automatic"

# echo "✨ Creating redis-url..."
# echo -n "redis://default:AYxWAAIncDE0YTI4MDMyZjA4MGM0MWIxYjVhOTdhNDY4MDY3MTY0MnAxMzU5MjY@summary-catfish-35926.upstash.io:6379" | \
#   gcloud secrets create redis-url \
#   --data-file=- \
#   --replication-policy="automatic"

# if [ -f "./google-credentials.json" ]; then
#   echo "✨ Creating google-credentials..."
#   gcloud secrets create google-credentials \
#     --data-file=./google-credentials.json \
#     --replication-policy="automatic"
# else
#   echo "⚠️  Warning: google-credentials.json not found!"
#   exit 1
# fi

echo ""
echo "🔑 Granting access to Cloud Run service account..."

for SECRET in telegram-bot-token jwt-secret admin-token gemini-api-key database-url redis-url google-credentials; do
  echo "   → $SECRET"
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet
done

echo ""
echo "✅ All 7 secrets created successfully!"
echo ""
echo "📋 Created Secrets:"
gcloud secrets list

echo ""
echo "🚀 Next step: Deploy to Cloud Run"
echo "   Run: gcloud run deploy habeshatts-backend ..."