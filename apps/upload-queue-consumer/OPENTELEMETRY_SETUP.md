# OpenTelemetry Setup for Upload Queue Consumer

This worker is instrumented with OpenTelemetry to send traces to Axiom for observability.

## Setup Instructions

### 1. Create Axiom Dataset

1. Go to [Axiom](https://app.axiom.co)
2. Create a new dataset with type **"OpenTelemetry Metrics (Preview)"**
3. Use these dataset names:
   - Production: `upload-queue-consumer`
   - Development: `upload-queue-consumer-dev`

### 2. Get Axiom API Token

1. Go to [Axiom Settings > Tokens](https://app.axiom.co/settings/tokens)
2. Create a new API token with permissions to ingest data
3. Copy the token

### 3. Configure Environment Variables

#### For Local Development

Add to your `.dev.vars` file:
```
AXIOM_API_TOKEN=your-axiom-api-token-here
```

The dataset name is already configured in `wrangler.toml` for dev environment.

#### For Production

Set the secret using Wrangler CLI:
```bash
wrangler secret put AXIOM_API_TOKEN --env prod
```

The dataset name is already configured in `wrangler.toml` for production.

### 4. Deploy

```bash
# Deploy to production
pnpm deploy

# Or deploy to dev
pnpm deploy --env dev
```

## What's Being Traced

The worker automatically traces:
- HTTP requests to the worker
- Queue message processing
- Custom spans for:
  - **processMessage**: Overall message processing with attributes (uploadId, fileId, logId, userId, fileType)
  - **downloadFile**: R2 file download with file size
  - **parseCV**: CV parsing with file type
  - **updateOutboxStatus**: API callback with status

## Viewing Traces in Axiom

1. Go to your Axiom dashboard
2. Select the `upload-queue-consumer` (or `-dev`) dataset
3. View traces in the OpenTelemetry traces dashboard
4. Filter by attributes like `fileId`, `logId`, `userId`, etc.

## Troubleshooting

If traces aren't appearing:
1. Verify `AXIOM_API_TOKEN` is set correctly
2. Check the dataset name matches in `wrangler.toml`
3. Ensure the API token has ingest permissions
4. Check worker logs for any errors: `wrangler tail`
