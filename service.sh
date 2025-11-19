#!/bin/bash

# Exit on any error
set -e

PROJECT_ID=$(gcloud config get-value project)
SA_NAME="sssh-1234567"
SA_EMAIL="$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"

echo "🚧 Creating Service Account: $SA_EMAIL"

# 1. Create service account
gcloud iam service-accounts create $SA_NAME \
  --display-name="SSH Service Account"

echo "✅ Service Account Created."

# 2. Add OWNER role
echo "🔐 Assigning Owner Role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/owner"

echo "✅ Owner Role Assigned."

# 3. Create service account key & print it
echo "🔑 Creating Service Account Key..."
gcloud iam service-accounts keys create key-ssh.json \
  --iam-account="$SA_EMAIL"

echo "---------------------------------------------"
echo "📘 YOUR SERVICE ACCOUNT KEY (key-ssh.json):"
echo "---------------------------------------------"
cat key-ssh.json
echo "---------------------------------------------"

# 4. Create API Key
echo "🔧 Creating API Key..."
API_KEY=$(gcloud alpha services api-keys create \
  --display-name="ssh-api-key" \
  --format="value(keyString)" \
  --project=$PROJECT_ID)

echo "---------------------------------------------"
echo "🔑 YOUR API KEY:"
echo "$API_KEY"
echo "---------------------------------------------"

echo "🎉 All tasks completed successfully!"
