#!/bin/bash

# Local testing script for queue consumer
# This sends a test message to your deployed API which should trigger the queue


# Example: Test CV processing (uses /test-process endpoint for local dev)
curl -X POST http://localhost:8787/test-process \
  -H "Content-Type: application/json" \
  -d '{
  "uploadId": "69323167eaf20170a8e40576",
  "fileId": "3c0d83db-48cd-497b-8b11-85dd39803c99",
  "processId": "618978f5-3a14-47c9-9b32-84db14c7cc6b",
  "userId": "96f4e7a2-491c-4162-b1e4-fd3a66318b51",
  "fileType": "PDF"
}'

echo "\n\nNote: In local dev mode, the queue handler won't actually process messages."
echo "To test the full flow:"
echo "1. Deploy: pnpm wrangler deploy"
echo "2. Send a real message through your API"
echo "3. Monitor: pnpm wrangler tail"
