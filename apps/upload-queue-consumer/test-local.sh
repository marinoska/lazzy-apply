#!/bin/bash

# Local testing script for queue consumer
# This sends a test message to your deployed API which should trigger the queue


# Example: Test CV processing (uses /test-process endpoint for local dev)
curl -X POST http://localhost:8787/test-process \
  -H "Content-Type: application/json" \
  -d '{
  "uploadId": "693c41b542aded447aefe526",
  "fileId": "6632c0e3-914d-4172-8e99-b0c0e8cf9cae",
  "processId": "615cd368-30b7-4a31-a88f-4718f71262a7",
  "userId": "96f4e7a2-491c-4162-b1e4-fd3a66318b51",
  "fileType": "DOCX"
}'

echo "\n\nNote: In local dev mode, the queue handler won't actually process messages."
echo "To test the full flow:"
echo "1. Deploy: pnpm wrangler deploy"
echo "2. Send a real message through your API"
echo "3. Monitor: pnpm wrangler tail"
