#!/bin/bash

# Local testing script for queue consumer
# This sends a test message to your deployed API which should trigger the queue


# Example: Test CV processing
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -d '{
  "uploadId": "692a6acbf08f4d7a0f1eeb6d",
  "fileId": "f0c1eb74-6f2f-41a9-afb4-cf1a71c276eb",
  "processId": "19fcd2cd-b9ec-4233-89a0-3c46f1a15e9b",
  "userId": "96f4e7a2-491c-4162-b1e4-fd3a66318b51",
  "fileType": "PDF"
  }'

echo "\n\nNote: In local dev mode, the queue handler won't actually process messages."
echo "To test the full flow:"
echo "1. Deploy: pnpm wrangler deploy"
echo "2. Send a real message through your API"
echo "3. Monitor: pnpm wrangler tail"
