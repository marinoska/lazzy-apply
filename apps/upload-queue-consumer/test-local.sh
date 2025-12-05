#!/bin/bash

# Local testing script for queue consumer
# This sends a test message to your deployed API which should trigger the queue


# Example: Test CV processing (uses /test-process endpoint for local dev)
curl -X POST http://localhost:8787/test-process \
  -H "Content-Type: application/json" \
  -d '{
  "uploadId": "6932f6675c74c6cf4387ca49",
  "fileId": "6ae491dd-5fc8-4bca-b9ee-fb140c875cfd",
  "processId": "24559771-66d5-4fec-8a0e-5dfbbf626db2",
  "userId": "96f4e7a2-491c-4162-b1e4-fd3a66318b51",
  "fileType": "PDF"
}'

echo "\n\nNote: In local dev mode, the queue handler won't actually process messages."
echo "To test the full flow:"
echo "1. Deploy: pnpm wrangler deploy"
echo "2. Send a real message through your API"
echo "3. Monitor: pnpm wrangler tail"
