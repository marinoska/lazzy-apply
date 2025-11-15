#!/bin/bash
set -e

echo "🚀 Deploying upload-queue-consumer to Cloudflare..."

# Check if CLOUDFLARE_API_TOKEN is set
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  echo "❌ Error: CLOUDFLARE_API_TOKEN environment variable is not set"
  exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile

# Deploy using wrangler
echo "☁️  Deploying to Cloudflare Workers..."
pnpm wrangler deploy

echo "✅ Deployment complete!"
