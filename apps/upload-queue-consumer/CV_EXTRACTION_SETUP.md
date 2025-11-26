# CV Extraction Setup

This worker uses Vercel AI SDK with GPT-4o-mini to extract structured data from uploaded CV files.

## Environment Variables

The following secret must be configured in Cloudflare Workers:

### OPENAI_API_KEY

Your OpenAI API key for GPT-4o-mini access.

**Setup for Production:**
```bash
wrangler secret put OPENAI_API_KEY
```

**Setup for Dev Environment:**
```bash
wrangler secret put OPENAI_API_KEY --env dev
```

When prompted, paste your OpenAI API key.

## How It Works

1. **File Type Detection**: The worker detects whether the file is PDF or DOCX by examining magic bytes
2. **Text Extraction**: 
   - **PDF files**: Extracted using `pdfjs-dist`
   - **DOCX files**: Extracted using `mammoth`
3. **AI Extraction**: The extracted text is sent to GPT-4o-mini with a structured prompt
4. **Schema Validation**: The response is validated against a Zod schema to ensure data integrity
5. **Data Transformation**: The extracted data is transformed to match the `ParsedCVData` type

## Supported File Formats

- **PDF** (.pdf)
- **DOCX** (.docx) - Microsoft Word documents

## Extraction Schema

The AI extracts the following information:

- **Personal Info**: Full name, email, phone, location, nationality, right to work
- **Links**: LinkedIn, GitHub, portfolio, and other professional links
- **Summary**: Professional summary or objective
- **Experience**: Job history with roles, companies, dates, and descriptions
- **Education**: Degrees, institutions, fields of study, and dates
- **Certifications**: Professional certifications with issuers and dates
- **Languages**: Languages spoken with proficiency levels
- **Extras**: Driving license, work permit, relocation preferences, remote work preferences, notice period, availability, salary expectations

## Prompt Engineering

The extraction prompt includes strict rules to prevent hallucination:
- Only extract explicitly present information
- Return `null` for missing fields
- Never invent data
- Classify links by type
- Preserve full job descriptions

## Dependencies

- `ai` - Vercel AI SDK
- `@ai-sdk/openai` - OpenAI provider for Vercel AI
- `pdfjs-dist` - PDF text extraction
- `mammoth` - DOCX text extraction
- `zod` - Schema validation

## Node.js Compatibility

The worker uses `node_compat = true` in `wrangler.toml` to enable Node.js APIs (Buffer) required by the `mammoth` library for DOCX processing.

## Testing Locally

To test the worker locally:

1. **Configure `.dev.vars` file** (already created):
   ```bash
   # Edit .dev.vars and add your actual OpenAI API key
   OPENAI_API_KEY=sk-proj-...your-actual-key...
   WORKER_SECRET=your-worker-secret
   ```

2. **Run the worker in dev mode**:
   ```bash
   pnpm dev
   ```

The `.dev.vars` file is automatically loaded by Wrangler for local development and is already in `.gitignore` to prevent committing secrets.

## Cost Considerations

GPT-4o-mini pricing (as of 2024):
- Input: ~$0.15 per 1M tokens
- Output: ~$0.60 per 1M tokens

A typical CV extraction uses:
- Input: ~1,000-3,000 tokens (CV text + prompt)
- Output: ~500-1,500 tokens (structured JSON)

Estimated cost per CV: **$0.001 - $0.003** (less than half a cent)
