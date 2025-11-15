#!/bin/bash

# Local testing script for queue consumer
# This sends a test message to your deployed API which should trigger the queue

# Example: Test CV processing
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -d '{
    "fileId": "423d6cc6-0142-4904-87e4-e5d101a617aa",
    "logId": "155663b4-2a4a-4398-ad9d-129c6898c183",
    "userId": "96f4e7a2-491c-4162-b1e4-fd3a66318b51"
  }'

echo "\n\nNote: In local dev mode, the queue handler won't actually process messages."
echo "To test the full flow:"
echo "1. Deploy: pnpm wrangler deploy"
echo "2. Send a real message through your API"
echo "3. Monitor: pnpm wrangler tail"
