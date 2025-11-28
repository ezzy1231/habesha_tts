#!/bin/bash
set -e

echo "🚀 Setting up GitHub Actions for Cloud Run Deployment"
echo "======================================================"
echo ""

# Get project ID
PROJECT_ID=$(gcloud config get-value project)
if [ -z "$PROJECT_ID" ]; then
  echo "❌ No project set. Run: gcloud config set project YOUR_PROJECT_ID"
  exit 1
fi

echo "📦 Project ID: $PROJECT_ID"
echo ""

# Step 1: Enable required APIs
echo "📡 Step 1/5: Enabling required Google Cloud APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  iamcredentials.googleapis.com

echo "✅ APIs enabled"
echo ""

# Step 2: Create service account
echo "👤 Step 2/5: Creating service account..."
if gcloud iam service-accounts describe github-actions-deployer@$PROJECT_ID.iam.gserviceaccount.com &>/dev/null; then
  echo "⚠️  Service account already exists, skipping..."
else
  gcloud iam service-accounts create github-actions-deployer \
    --display-name="GitHub Actions Deployer" \
    --description="Service account for GitHub Actions to deploy to Cloud Run"
  echo "✅ Service account created"
fi
echo ""

# Step 3: Grant IAM roles
echo "🔑 Step 3/5: Granting IAM permissions..."

ROLES=(
  "roles/run.admin"
  "roles/iam.serviceAccountUser"
  "roles/storage.admin"
  "roles/cloudbuild.builds.editor"
  "roles/artifactregistry.admin"
  "roles/secretmanager.secretAccessor"
  "roles/viewer"
)

for ROLE in "${ROLES[@]}"; do
  echo "   → Granting $ROLE"
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:github-actions-deployer@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="$ROLE" \
    --condition=None \
    --quiet
done

echo "✅ IAM permissions granted"
echo ""

# Step 4: Create service account key
echo "🔐 Step 4/5: Creating service account key..."
if [ -f "github-actions-key.json" ]; then
  echo "⚠️  Key file already exists. Deleting old key..."
  rm github-actions-key.json
fi

gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=github-actions-deployer@$PROJECT_ID.iam.gserviceaccount.com

echo "✅ Service account key created: github-actions-key.json"
echo ""

# Step 5: Add to .gitignore
echo "🛡️  Step 5/5: Adding key to .gitignore..."
if ! grep -q "github-actions-key.json" .gitignore 2>/dev/null; then
  echo "github-actions-key.json" >> .gitignore
  echo "✅ Added to .gitignore"
else
  echo "⚠️  Already in .gitignore"
fi
echo ""

# Display the key
echo "======================================================"
echo "✅ Setup Complete!"
echo "======================================================"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Go to your GitHub repository"
echo "2. Navigate to: Settings → Secrets and variables → Actions"
echo "3. Click 'New repository secret'"
echo "4. Create a secret with:"
echo "   Name: GCP_SA_KEY"
echo "   Value: (copy the contents below)"
echo ""
echo "======================================================"
echo "🔐 SERVICE ACCOUNT KEY (copy everything below):"
echo "======================================================"
echo ""
cat github-actions-key.json
echo ""
echo "======================================================"
echo ""
echo "⚠️  SECURITY WARNING:"
echo "   - Keep this key secure!"
echo "   - Don't commit github-actions-key.json to Git"
echo "   - Delete the file after adding to GitHub secrets"
echo ""
echo "🧹 To delete the key file after setup:"
echo "   rm github-actions-key.json"
echo ""
echo "📝 To create the GitHub workflow:"
echo "   Copy the workflow file to .github/workflows/deploy-cloud-run.yml"
echo ""