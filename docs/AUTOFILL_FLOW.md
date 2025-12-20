# Autofill Flow Architecture

This document explains the complete autofill flow from job description detection to form filling, including all caching layers and API nuances.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              EXTENSION (Client)                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────┐    JD_SCAN     ┌──────────────────┐                           │
│  │ Content      │ ──────────────▶│ Background       │                           │
│  │ Script       │                │ Script           │                           │
│  │ (scanner.ts) │                │ (messageHandler) │                           │
│  └──────────────┘                └────────┬─────────┘                           │
│         │                                 │                                      │
│         │ Form detected                   │ Stores JD in                         │
│         ▼                                 │ chrome.storage.local                 │
│  ┌──────────────┐                         │                                      │
│  │ Sidebar UI   │◀────────────────────────┘                                      │
│  │ (AutofillCtx)│         GET_LAST_JD                                           │
│  └──────┬───────┘                                                                │
│         │                                                                        │
│         │ POST /autofill { form, fields, uploadId, jd... }                       │
│         │ (first request - no autofillId)                                        │
│         ▼                                                                        │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                  API (Server)                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────┐                                                         │
│  │ autofill.controller │◀─────────────────────────────────────────────────┐     │
│  └──────────┬──────────┘                                                  │     │
│             │                                                             │     │
│             │ (no autofillId)                                             │     │
│             ▼                                                             │     │
│  ┌─────────────────────────────────────────────────────────────────┐      │     │
│  │              ClassificationManager.process()                     │      │     │
│  │  ┌───────────────────────────────────────────────────────────┐  │      │     │
│  │  │ 1. Load CV data + file upload                             │  │      │     │
│  │  │ 2. Check form cache (FormModel)                           │  │      │     │
│  │  │ 3. Check field cache (FormFieldModel)                     │  │      │     │
│  │  │ 4. Classify missing fields (LLM)                          │  │      │     │
│  │  │ 5. Validate JD-form match (LLM)                           │  │      │     │
│  │  │ 6. Infer text answers (LLM)                               │  │      │     │
│  │  │ 7. Persist form + fields + autofill record                │  │      │     │
│  │  │ 8. Generate NEW autofillId (UUID)                         │  │      │     │
│  │  └───────────────────────────────────────────────────────────┘  │      │     │
│  └──────────────────────────────┬──────────────────────────────────┘      │     │
│                                 │                                         │     │
│                                 │ returns { autofillId, fields }          │     │
│                                 ▼                                         │     │
│  ┌─────────────────────────────────────────────────────────────────┐      │     │
│  │                    autofill.controller                           │      │     │
│  │                                                                  │      │     │
│  │   Returns to extension: { autofillId, fields, fromCache }        │      │     │
│  └──────────────────────────────┬──────────────────────────────────┘      │     │
│                                 │                                         │     │
└─────────────────────────────────┼─────────────────────────────────────────┼─────┘
                                  │                                         │
                                  ▼                                         │
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              EXTENSION (Client)                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │ Sidebar stores autofillId from response                                  │   │
│  │                                                                          │   │
│  │ On subsequent requests (page refresh, re-open sidebar):                  │   │
│  │ POST /autofill { autofillId }  ──────────────────────────────────────────┼───┘
│  │                                                                          │
│  │ Server does direct lookup → instant cached response                      │
│  │ NO LLM calls, NO CV processing                                           │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### autofillId Flow Summary

```
┌─────────────┐                              ┌─────────────────────┐
│  Extension  │                              │        API          │
└──────┬──────┘                              └──────────┬──────────┘
       │                                                │
       │  1. POST /autofill (no autofillId)             │
       │ ─────────────────────────────────────────────▶ │
       │                                                │
       │                              Controller checks:
       │                              1. findMostRecentByUserUploadForm()
       │                                 (userId + uploadId + formId)
       │                              2. If found → return cached autofillId
       │                              3. If not → ClassificationManager.process()
       │                                 - LLM classification
       │                                 - LLM inference
       │                                 - Persist to DB
       │                                 - Generate NEW autofillId = UUID
       │                                                │
       │  2. Response { autofillId: "abc-123", fields } │
       │ ◀───────────────────────────────────────────── │
       │                                                │
       │  [Extension stores autofillId]                 │
       │                                                │
       │  3. POST /autofill { autofillId: "abc-123" }   │
       │ ─────────────────────────────────────────────▶ │
       │                                                │
       │                              AutofillModel.findByAutofillId()
       │                              - Direct DB lookup
       │                              - NO LLM calls
       │                                                │
       │  4. Response { autofillId: "abc-123", fields } │
       │ ◀───────────────────────────────────────────── │
       │                                                │
       │  [Repeat step 3-4 for instant cache hits]      │
       ▼                                                ▼
```

---

## Phase 1: Job Description Detection (Extension)

### 1.1 Page Scanning

When a page loads, the content script (`scanner.ts`) runs:

```typescript
// scanner.ts
const blocks = extractTextBlocks();
const jobDescriptionAnalysis = classifyDocument(paragraphs);

chrome.runtime.sendMessage({
  type: "JD_SCAN",
  url: location.href,
  jobDescriptionAnalysis,
  blocks,
});
```

### 1.2 JD Classification (Client-Side)

The `jobDescriptionClassifier.ts` uses **deterministic, role-neutral classification** based on:

| Signal Type | Examples |
|-------------|----------|
| `responsibility_language` | "responsible for", "will be expected to" |
| `requirement_language` | "must have", "required experience" |
| `candidate_framing` | "ideal candidate", "you will" |
| `action_verbs` | "develop", "manage", "implement" |
| `soft_skills` | "team player", "communication skills" |
| `job_structure_patterns` | "About the role", "What you'll do" |

**Decision criteria:**
- Minimum 350 characters of JD content
- At least 2 signals detected
- Confidence threshold ≥ 0.3
- Apply button detection as validator

### 1.3 Background Script Storage

The background script (`messageHandler.ts`) stores high-confidence JDs:

```typescript
// messageHandler.ts - JD_SCAN handler
if (jobDescriptionAnalysis.isJobDescription) {
  await saveLastDetectedJD({
    url: scanMsg.url,
    jobDescriptionAnalysis,
    blocks: scanMsg.blocks,
    detectedAt: Date.now(),
  });
}
```

**Storage key:** `LAST_JD_STORAGE_KEY` in `chrome.storage.local`

---

## Phase 2: Form Detection (Extension)

### 2.1 Application Form Detection

`formDetector.ts` identifies job application forms using:

**Signals:**
- Job-specific labels: `resume`, `cv`, `cover letter`, `sponsorship`, `salary`
- Job-specific field names: `resume`, `cv`, `coverletter`
- Submit button text: "Submit Application", "Apply Now"
- File inputs for resume/CV

**Requirements:**
- Minimum 3 input fields
- At least one job-specific signal

### 2.2 Iframe Form Handling

Forms in iframes (Greenhouse, Lever, Workday) use cross-frame communication:

```
Parent Page                          Iframe (ATS)
┌─────────────────┐                  ┌─────────────────┐
│ Sidebar UI      │◀─────────────────│ Form detected   │
│                 │  LAZYAPPLY_      │                 │
│ formStore       │  FORM_DETECTED   │ formStore       │
│ .getStoredForm()│                  │ .broadcastForm  │
└─────────────────┘                  │  ToParent()     │
        │                            └─────────────────┘
        │ LAZYAPPLY_FILL_FIELD
        └──────────────────────────────────▶
```

See `IFRAME_FORM_DETECTION.md` for details.

---

## Phase 3: Autofill Request (Extension → API)

### 3.1 Building the Request

`AutofillContext.tsx` assembles the autofill request:

```typescript
const storedJD = await getLastDetectedJD();
const jdRawText = storedJD?.blocks?.map(block => block.text).join("\n");
const formContext = extractTextBlocks(); // Current page context

const request: AutofillRequest = {
  form: {
    formHash,
    fields: [{ hash }],
    pageUrl,
    action,
  },
  fields: [{ hash, field: { tag, type, name, label, ... } }],
  selectedUploadId,
  jdRawText,
  jdUrl: storedJD?.url,
  formContext,
};
```

### 3.2 Request Fields

| Field | Description |
|-------|-------------|
| `form.formHash` | Unique hash of all field hashes (sorted) |
| `form.pageUrl` | URL where form was detected |
| `fields` | Array of field metadata with hashes |
| `selectedUploadId` | User's selected CV upload ID |
| `jdRawText` | Raw text from last detected JD |
| `jdUrl` | URL where JD was detected |
| `formContext` | Text blocks from current page (fallback) |

---

## Phase 4: API Processing

### 4.1 The `autofillId` - Core Caching Mechanism

The `autofillId` is a **UUID generated server-side** that uniquely identifies each autofill operation. It serves as the primary caching key and enables:

1. **Instant retrieval** of previously computed autofill results
2. **Audit trail** linking user → CV → form → filled values
3. **Cost tracking** via associated usage records

**Schema (`AutofillModel`):**
```typescript
{
  userId: string,           // User who triggered autofill
  autofillId: string,       // UUID - unique, indexed, immutable
  formReference: ObjectId,  // Reference to Form document
  uploadReference: ObjectId,// Reference to CV upload
  data: [{                  // Filled field values
    hash: string,
    fieldRef: ObjectId,
    fieldName: string,
    value?: string,         // Text value OR
    fileUrl?: string,       // File fields (mutually exclusive)
    fileName?: string,
    fileContentType?: string,
  }],
  createdAt: Date,
  updatedAt: Date,
}
```

**Key static methods:**
- `findByAutofillId(id)` - Direct lookup (Level 1 cache)
- `findMostRecentByUserUploadForm(userId, uploadId, formId)` - Combination lookup (Level 2 cache)

### 4.2 Controller Entry Point

`autofill.controller.ts` handles the request:

```typescript
// Cache check 1: Direct autofillId lookup (fastest path)
if (autofillId) {
  const autofillDoc = await AutofillModel.findByAutofillId(autofillId);
  // Returns stored response immediately - no LLM calls
  return buildResponseFromAutofillDoc(autofillDoc);
}

// Cache check 2: Recent autofill for same user/upload/form combination
const existingForm = await FormModel.findByHash(form.formHash);
if (existingForm) {
  const recentAutofill = await AutofillModel.findMostRecentByUserUploadForm(
    user.id, selectedUploadId, existingForm._id
  );
  if (recentAutofill) {
    // Same user + same CV + same form = return cached autofillId response
    return buildResponseFromAutofillDoc(recentAutofill);
  }
}

// No cache hit → process with ClassificationManager
const classificationManager = new ClassificationManager(...);
const { response, fromCache } = await classificationManager.process();
// Returns { autofillId, fields, fromCache } - autofillId is NEW UUID
```

### 4.3 ClassificationManager Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                  ClassificationManager.process()                 │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
   ┌───────────┐        ┌───────────┐        ┌───────────┐
   │ loadForm()│        │loadCVData()│       │getFileInfo│
   │           │        │           │        │           │
   │ FormModel │        │ CVDataModel│       │ Presigned │
   │ .findBy   │        │ .findBy   │        │ URL gen   │
   │ Hash()    │        │ UploadId()│        │           │
   └─────┬─────┘        └─────┬─────┘        └─────┬─────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              ▼
                    ┌─────────────────┐
                    │  Form exists?   │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │ YES                         │ NO
              ▼                             ▼
   ┌─────────────────────┐       ┌─────────────────────┐
   │ Use populated       │       │ loadFields()        │
   │ fields from form    │       │ - Find by hash      │
   │                     │       │ - Identify missing  │
   └─────────┬───────────┘       └─────────┬───────────┘
             │                             │
             └──────────────┬──────────────┘
                            ▼
              ┌─────────────────────────────┐
              │ Parallel LLM calls:         │
              │ - classifyFieldsWithAI()    │ (if missing fields)
              │ - validateJdFormMatch()     │ (if JD URL ≠ form URL)
              └─────────────┬───────────────┘
                            ▼
              ┌─────────────────────────────┐
              │ buildResponseFromFields()   │
              │ - Map fields to CV paths    │
              │ - Extract values from CV    │
              │ - Add file info for uploads │
              └─────────────┬───────────────┘
                            ▼
              ┌─────────────────────────────┐
              │ inferFieldValues()          │ (if inferenceHint fields)
              │ - Generate text answers     │
              │ - Use CV + JD/formContext   │
              └─────────────┬───────────────┘
                            ▼
              ┌─────────────────────────────┐
              │ Persist:                    │
              │ - persistNewFormAndFields() │ (new form)
              │ - persistCachedAutofill()   │ (existing form)
              └─────────────────────────────┘
```

---

## Phase 5: Caching Layers

### 5.1 Cache Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                        CACHE LEVELS                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Level 1: autofillId Lookup (FASTEST)                            │
│  ────────────────────────────────────                            │
│  • Client sends autofillId from previous response                │
│  • Direct DB lookup: AutofillModel.findByAutofillId()            │
│  • Returns complete stored response (values + file URLs)         │
│  • ZERO LLM calls, ZERO CV processing                            │
│  • Use case: Re-opening sidebar, page refresh                    │
│                                                                  │
│  Level 2: User/Upload/Form Combination                           │
│  ─────────────────────────────────────                           │
│  • Same user + same CV + same form = cached                      │
│  • Lookup: AutofillModel.findMostRecentByUserUploadForm()        │
│  • Returns most recent autofill for this combination             │
│  • ZERO LLM calls                                                │
│  • Use case: User re-applies to same form with same CV           │
│                                                                  │
│  Level 3: Form Hash Cache                                        │
│  ────────────────────────                                        │
│  • Form exists in DB → use stored field classifications          │
│  • Only need to extract values from current CV                   │
│  • May still need inference for text fields                      │
│  • Saves classification LLM call                                 │
│                                                                  │
│  Level 4: Field Hash Cache                                       │
│  ─────────────────────────                                       │
│  • Individual fields cached by hash                              │
│  • Only classify fields not seen before                          │
│  • Merge cached + new classifications                            │
│  • Partial LLM savings                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 What Gets Cached

| Entity | Key | Cached Data | Lookup Method |
|--------|-----|-------------|---------------|
| **Autofill** | `autofillId` | Full response (values + file URLs) | `findByAutofillId()` |
| **Autofill** | `userId+uploadId+formId` | Most recent autofill | `findMostRecentByUserUploadForm()` |
| **Form** | `formHash` | Field references, page URLs, actions | `findByHash()` |
| **FormField** | `hash` | Classification path, linkType, inferenceHint | `find({ hash: { $in } })` |

### 5.3 autofillId Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                    autofillId LIFECYCLE                          │
└─────────────────────────────────────────────────────────────────┘

1. GENERATION (Server)
   └─▶ ClassificationManager.process() completes
   └─▶ persistNewFormAndFields() or persistCachedAutofill()
   └─▶ autofillId = randomUUID()
   └─▶ Stored in AutofillModel with all field values

2. RESPONSE (Server → Client)
   └─▶ API returns { autofillId, fields, fromCache }
   └─▶ Client receives and can store autofillId

3. RE-USE (Client → Server)
   └─▶ Client sends autofillId in subsequent request
   └─▶ Server does direct lookup - instant response
   └─▶ No re-computation needed

4. AUDIT & TRACKING
   └─▶ UsageModel links to autofillId for cost tracking
   └─▶ Each LLM call (classification, inference, jd-match)
       creates UsageRecord with autofillId reference
```

### 5.4 Hash Calculation

**Field hash** (stable identifier):
```typescript
const FIELD_HASH_PROPERTIES = [
  "tag", "type", "name", "label", 
  "placeholder", "description", "isFileUpload"
];
// Hash = domain:hash:ohash(properties)
```

**Form hash** (derived from fields):
```typescript
const formHash = hash(fields.map(f => f.hash).sort());
```

---

## Phase 6: LLM Services

### 6.1 Field Classification (`classifier.llm.ts`)

**Purpose:** Map form fields to CV data paths

**Input:**
```json
[
  {
    "hash": "abc123",
    "tag": "input",
    "type": "text",
    "name": "first_name",
    "label": "First Name"
  }
]
```

**Output:**
```json
[
  { "hash": "abc123", "path": "basics.firstName" }
]
```

**Special cases:**
- `resume_upload` → triggers file URL generation
- `links` → includes `linkType` (linkedin, github, portfolio)
- `unknown` with `inferenceHint: "text_from_jd_cv"` → triggers inference

### 6.2 JD-Form Matching (`jdMatcher.llm.ts`)

**Purpose:** Verify JD and form refer to same job

**When called:** `jdUrl !== formUrl` (different pages)

**Matching criteria:**
- Job title/role consistency
- Company/employer consistency
- URL relationship (same domain, ATS flow)
- Form questions align with JD responsibilities

### 6.3 Field Inference (`inference.llm.ts`)

**Purpose:** Generate text answers for open-ended fields

**When called:** Fields with `inferenceHint: "text_from_jd_cv"`

**Input context:**
- CV raw text (required)
- JD raw text (if JD matches form)
- Form context (fallback if JD doesn't match)

**Rules:**
- Base answers strictly on CV content
- Use JD only to adjust wording/emphasis
- Never invent experience not in CV
- Conservative, factual responses

---

## Phase 7: Response & Form Filling

### 7.1 API Response Format

```typescript
interface AutofillResponse {
  autofillId: string;
  fields: {
    [hash: string]: {
      fieldName: string;
      path: string;           // CV path or "unknown"
      pathFound: boolean;
      value?: string;         // Extracted or inferred value
      fileUrl?: string;       // Presigned download URL
      fileName?: string;
      fileContentType?: string;
      linkType?: string;      // For links path
      inferenceHint?: string;
    }
  };
  fromCache: boolean;
}
```

### 7.2 Form Filling (Extension)

`formFiller.ts` fills the form:

```typescript
const { filled, skipped } = await fillFormFields(
  applicationForm,
  classifications,
  isIframeForm
);
```

**For iframe forms:**
- Uses `formStore.fillFieldInIframe(hash, value)`
- Posts message to iframe with field hash and value
- Iframe finds element and fills using native setters

**For local forms:**
- Direct DOM manipulation
- Uses native value setters for React compatibility
- Dispatches input/change events

---

## Data Flow Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              COMPLETE FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────┘

1. USER BROWSES JOB POSTING
   └─▶ scanner.ts extracts text blocks
   └─▶ jobDescriptionClassifier.ts analyzes content
   └─▶ Background script stores JD if high confidence

2. USER NAVIGATES TO APPLICATION FORM
   └─▶ formDetector.ts identifies application form
   └─▶ Sidebar auto-shows (parent or iframe callback)
   └─▶ User selects CV and clicks "Autofill"

3. EXTENSION BUILDS REQUEST
   └─▶ AutofillContext fetches stored JD from background
   └─▶ Extracts form context from current page
   └─▶ Sends POST /autofill with form + fields + JD + CV ID

4. API CHECKS CACHES
   └─▶ Level 1: autofillId lookup (if provided)
   └─▶ Level 2: user/upload/form combination
   └─▶ Level 3: form hash lookup
   └─▶ Level 4: individual field hash lookup

5. API PROCESSES (if cache miss)
   └─▶ Load CV data and file upload info
   └─▶ Classify missing fields (LLM)
   └─▶ Validate JD-form match (LLM, if different URLs)
   └─▶ Build response with CV values
   └─▶ Infer text answers (LLM, if inferenceHint fields)
   └─▶ Persist form, fields, autofill record

6. EXTENSION FILLS FORM
   └─▶ Receives classification response
   └─▶ Fills each field (local or iframe)
   └─▶ Handles file uploads via presigned URLs
   └─▶ Shows cover letter option if detected
```

---

## Key Files Reference

### Extension
| File | Purpose |
|------|---------|
| `content/scanner/scanner.ts` | Page scanning, JD detection trigger |
| `content/classifier/jobDescriptionClassifier.ts` | Client-side JD classification |
| `content/scanner/formDetector.ts` | Application form detection |
| `content/scanner/FormStoreManager.ts` | Cross-frame form communication |
| `content/sidebar/context/AutofillContext.tsx` | Autofill orchestration |
| `background/messageHandler.ts` | JD storage, API proxy |
| `background/storage.ts` | Chrome storage helpers |

### API
| File | Purpose |
|------|---------|
| `routes/formFields/autofill.controller.ts` | Request handling, cache checks |
| `routes/formFields/classification.manager.ts` | Main orchestration |
| `routes/formFields/llm/classifier.llm.ts` | Field classification LLM |
| `routes/formFields/llm/jdMatcher.llm.ts` | JD-form matching LLM |
| `routes/formFields/llm/inference.llm.ts` | Text answer generation LLM |
| `routes/formFields/services/persistence.service.ts` | Database persistence |
| `formFields/form.model.ts` | Form schema and queries |
| `formFields/formField.model.ts` | Field schema and queries |
| `formFields/autofill.model.ts` | Autofill record schema |
