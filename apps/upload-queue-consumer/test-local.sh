#!/bin/bash

# Local testing script for queue consumer
# This sends a test message to your deployed API which should trigger the queue


# Example: Test CV processing (uses /test-process endpoint for local dev)
curl -X POST http://localhost:8787/test-process \
  -H "Content-Type: application/json" \
  -d '{
  "uploadId": "69373b144989b4cb99b0178d",
  "fileId": "c291c914-c6de-4894-95a5-bcfdd96c87ab",
  "processId": "5c44c279-19a0-4ad9-be6d-e3d1bcfd83df",
  "userId": "96f4e7a2-491c-4162-b1e4-fd3a66318b51",
  "fileType": "DOCX"
}'

echo "\n\nNote: In local dev mode, the queue handler won't actually process messages."
echo "To test the full flow:"
echo "1. Deploy: pnpm wrangler deploy"
echo "2. Send a real message through your API"
echo "3. Monitor: pnpm wrangler tail"
