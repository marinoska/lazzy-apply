#!/bin/bash

# Local testing script for queue consumer
# This sends a test message to your deployed API which should trigger the queue

# Example: Test CV processing
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -d '{
      "uploadId": "6929c54b1d6044a8a185a8ec",
      "fileId": "9bb49c83-b7a2-456e-8345-26200cdec890",
      "logId": "b11c721b-37c6-4d13-88cd-08aaf3ac35a2",
      "userId": "96f4e7a2-491c-4162-b1e4-fd3a66318b51",
      "fileType": "PDF"
  }'

echo "\n\nNote: In local dev mode, the queue handler won't actually process messages."
echo "To test the full flow:"
echo "1. Deploy: pnpm wrangler deploy"
echo "2. Send a real message through your API"
echo "3. Monitor: pnpm wrangler tail"
