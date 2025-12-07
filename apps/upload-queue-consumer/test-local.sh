#!/bin/bash

# Local testing script for queue consumer
# This sends a test message to your deployed API which should trigger the queue


# Example: Test CV processing (uses /test-process endpoint for local dev)
curl -X POST http://localhost:8787/test-process \
  -H "Content-Type: application/json" \
  -d '{
  "uploadId": "6935b6f8abbb161b69cceb35",
  "fileId": "da82cf78-dceb-414f-9f10-2a0dec31e9f3",
  "processId": "bb8329a7-9d04-4925-af1b-ff96c74f1889",
  "userId": "96f4e7a2-491c-4162-b1e4-fd3a66318b51",
  "fileType": "DOCX"
}'

echo "\n\nNote: In local dev mode, the queue handler won't actually process messages."
echo "To test the full flow:"
echo "1. Deploy: pnpm wrangler deploy"
echo "2. Send a real message through your API"
echo "3. Monitor: pnpm wrangler tail"
