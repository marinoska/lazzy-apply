#!/bin/bash

# Local testing script for queue consumer
# This sends a test message to your deployed API which should trigger the queue

# Example: Test CV processing
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -d '{
      "uploadId": "692873cb1d6044a8a18580d4",
      "fileId": "3297c255-8f2b-4c05-8793-73321b821fc5",
      "logId": "8b0ff663-57ee-452a-ad36-c2c654d1feb8",
      "userId": "96f4e7a2-491c-4162-b1e4-fd3a66318b51",
      "fileType": "PDF"
  }'

echo "\n\nNote: In local dev mode, the queue handler won't actually process messages."
echo "To test the full flow:"
echo "1. Deploy: pnpm wrangler deploy"
echo "2. Send a real message through your API"
echo "3. Monitor: pnpm wrangler tail"
