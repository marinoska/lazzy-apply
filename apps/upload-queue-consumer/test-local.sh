#!/bin/bash

# Local testing script for queue consumer
# This sends a test message to your deployed API which should trigger the queue


# Example: Test CV processing
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -d '{
  "uploadId": "692a48d311fd479cff8fc182",
  "fileId": "0e50e1cf-bb37-4bb7-b2fc-e1c8d7924008",
  "processId": "4f6f4872-47c2-4c76-9768-b5537392f34a",
  "userId": "96f4e7a2-491c-4162-b1e4-fd3a66318b51",
  "fileType": "PDF"
  }'

echo "\n\nNote: In local dev mode, the queue handler won't actually process messages."
echo "To test the full flow:"
echo "1. Deploy: pnpm wrangler deploy"
echo "2. Send a real message through your API"
echo "3. Monitor: pnpm wrangler tail"
