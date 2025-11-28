#!/bin/bash

# Local testing script for queue consumer
# This sends a test message to your deployed API which should trigger the queue


# Example: Test CV processing
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -d '{
  "uploadId": "692a22aab84176f400b01154",
  "fileId": "bd83ec13-3416-4618-b681-c7ce4f644983",
  "processId": "f1ecdd55-2fad-4915-ac51-36ab91a969eb",
  "userId": "96f4e7a2-491c-4162-b1e4-fd3a66318b51",
  "fileType": "PDF"
  }'

echo "\n\nNote: In local dev mode, the queue handler won't actually process messages."
echo "To test the full flow:"
echo "1. Deploy: pnpm wrangler deploy"
echo "2. Send a real message through your API"
echo "3. Monitor: pnpm wrangler tail"
