# Iframe Form Detection Architecture

This document explains how the extension detects and fills application forms embedded in iframes (e.g., Greenhouse, Lever, Workday).

## Problem

Many job application forms are embedded in iframes from third-party ATS (Applicant Tracking System) providers:

- **Greenhouse** - `job-boards.greenhouse.io`
- **Lever** - `jobs.lever.co`
- **Workday** - `*.myworkdayjobs.com`

By default, Chrome extension content scripts only run in the parent page, not inside iframes. This means:

1. The form detector can't see the form (it's in a different document)
2. The sidebar UI would appear inside the iframe if we inject there
3. Cross-origin iframes have security restrictions on direct DOM access

## Solution Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Parent Page (e.g., elastic.co/careers/job-123)             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Content Script (index.ts)                          │   │
│  │  - Sidebar UI                                       │   │
│  │  - Message listener                                 │   │
│  │  - Form store (receives form data)                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                           ▲                                 │
│                           │ postMessage                     │
│                           │ (LAZYAPPLY_FORM_DETECTED)       │
│  ┌────────────────────────┴────────────────────────────┐   │
│  │  Iframe (job-boards.greenhouse.io)                  │   │
│  │                                                     │   │
│  │  ┌───────────────────────────────────────────────┐ │   │
│  │  │  Content Script (index.ts)                    │ │   │
│  │  │  - Form detector                              │ │   │
│  │  │  - Form store (broadcasts form data)          │ │   │
│  │  │  - NO sidebar UI                              │ │   │
│  │  └───────────────────────────────────────────────┘ │   │
│  │                                                     │   │
│  │  ┌───────────────────────────────────────────────┐ │   │
│  │  │  <form id="application-form">                 │ │   │
│  │  │    <input name="first_name" />                │ │   │
│  │  │    <input name="email" />                     │ │   │
│  │  │    ...                                        │ │   │
│  │  │  </form>                                      │ │   │
│  │  └───────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Manifest Configuration

```json
{
  "content_scripts": [{
    "matches": ["http://*/*", "https://*/*"],
    "js": ["src/content/index.ts"],
    "all_frames": true  // Inject into iframes too
  }]
}
```

### 2. FormStoreManager (`FormStoreManager.ts`)

Singleton class for cross-frame communication:

| Method | Context | Purpose |
|--------|---------|---------|
| `isInIframe()` | Both | Detect if running in iframe |
| `isInParent()` | Both | Detect if running in parent frame |
| `init()` | Both | Set up message listeners (call once) |
| `broadcastFormToParent()` | Iframe | Send form data to parent via postMessage |
| `requestFormFromIframes()` | Parent | Ask iframes to re-detect and send forms |
| `getStoredForm()` | Parent | Retrieve form data received from iframe |
| `setCachedIframeForm()` | Iframe | Cache detected form to avoid re-detection |
| `fillFieldInIframe()` | Parent | Send fill command to iframe |

### 3. Content Script Behavior (`index.ts`)

```typescript
import { formStore } from "./scanner/FormStoreManager.js";

const inIframe = formStore.isInIframe();

// Initialize form store in ALL frames
formStore.init();

// Only set up sidebar in parent frame
if (!inIframe) {
  chrome.runtime.onMessage.addListener(...);
}

// Scanner runs in ALL frames
new NavigationWatcher(() => scanPage());
```

### 4. Scanner Behavior (`scanner.ts`)

```typescript
import { formStore } from "./FormStoreManager.js";

const applicationForm = detectApplicationForm();

// If in iframe and found form, cache it and broadcast to parent
if (formStore.isInIframe() && applicationForm) {
  formStore.setCachedIframeForm(applicationForm);
  formStore.broadcastFormToParent(applicationForm);
}
```

## Message Flow

### Form Detection

```
1. Page loads with Greenhouse iframe
2. Content script runs in BOTH parent and iframe
3. Parent: No form found locally
4. Iframe: Form detected → broadcastFormToParent()
5. Parent: Receives LAZYAPPLY_FORM_DETECTED → stores form data
6. Sidebar: getStoredForm() returns the iframe's form
```

### Form Filling

```
1. User clicks "Autofill" in sidebar (parent frame)
2. Sidebar checks: detectApplicationForm() ?? getStoredForm()
3. If form is from iframe (isIframeForm = true):
   - For each field: fillFieldInIframe(hash, value)
   - Parent sends LAZYAPPLY_FILL_FIELD message
4. Iframe receives message → finds element → fills value
```

## Message Types

| Message | Direction | Purpose |
|---------|-----------|---------|
| `LAZYAPPLY_FORM_DETECTED` | Iframe → Parent | Form data broadcast |
| `LAZYAPPLY_FORM_REQUEST` | Parent → Iframe | Request form re-detection |
| `LAZYAPPLY_FILL_FIELD` | Parent → Iframe | Fill a specific field |

## Security Considerations

1. **postMessage with `"*"` origin**: We use `"*"` because:
   - We don't know the iframe's origin ahead of time
   - The messages only contain form field metadata, not sensitive data
   - The extension only processes messages with our specific type prefixes

2. **No sensitive data in messages**: Form data contains only:
   - Field hashes (computed identifiers)
   - Field metadata (tag, type, name, label)
   - Fill values come from user's own CV data

3. **Iframe isolation**: The sidebar UI never renders inside iframes, preventing:
   - UI confusion for users
   - Potential clickjacking vectors

## Limitations

1. **Deeply nested iframes**: Currently only handles one level of iframe nesting
2. **Same-origin policy**: Can't access iframe DOM directly for cross-origin iframes
3. **Timing**: Form must be loaded before detection runs (handled by NavigationWatcher delays)

## Testing

Tests are in `FormStoreManager.test.ts` covering:
- `isInIframe()` / `isInParent()` detection (parent, iframe, cross-origin)
- `broadcastFormToParent()` message posting
- `requestFormFromIframes()` broadcast to iframes
- `init()` idempotency (only initializes once)
- `setCachedIframeForm()` caching
- Message handling and form storage
