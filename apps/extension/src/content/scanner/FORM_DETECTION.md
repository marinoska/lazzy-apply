# Job Application Form Detection

This module detects and extracts comprehensive information about job application forms on web pages.

## Overview

The form detector identifies application forms and extracts detailed metadata about all form fields, including:
- Standard input fields (text, email, tel, url, etc.)
- File upload fields (resume, cover letter, etc.)
- Select dropdowns with all options
- Textarea fields
- Labels, placeholders, and descriptions
- ARIA attributes for accessibility
- Required field indicators

## Usage

```typescript
import { detectApplicationForm } from './formDetector.js';

const formData = detectApplicationForm();

if (formData) {
  console.log(`Found form with ${formData.totalFields} fields`);
  
  // Find file upload fields
  const fileUploads = formData.fields.filter(f => f.isFileUpload);
  
  // Find required fields
  const requiredFields = formData.fields.filter(f => f.required);
}
```

## Detection Strategy

### 1. Form Element Detection

The detector uses a multi-tier approach:

1. **Primary**: Look for `<form>` elements
2. **Fallback**: Detect logical form containers (divs/sections with 3+ input fields)
3. **Filtering**: When multiple forms exist, prioritize the most likely application form

### 2. High-Confidence Signals

A form is identified as an application form if it contains ANY of:

- `input[type="file"]` elements
- Labels matching: Resume, CV, Cover Letter, First Name, Last Name, Email, Phone
- Field names: linkedin, github, portfolio, salary, visa, sponsorship
- Submit buttons with text: "Apply", "Submit Application", "Continue", "Next"

### 3. Field Information Extraction

For each field, the detector extracts:

```typescript
interface FormField {
  tag: string;                    // 'input', 'textarea', 'select'
  type: string;                   // 'text', 'email', 'file', etc.
  id: string | null;              // Element ID
  name: string | null;            // Field name attribute
  label: string | null;           // Associated label text
  placeholder: string | null;     // Placeholder text
  ariaLabel: string | null;       // ARIA label
  ariaDescribedBy: string | null; // ARIA described-by ID
  description: string | null;     // Help text from aria-describedby
  required: boolean;              // Required field indicator
  isFileUpload: boolean;          // File upload field
  accept?: string | null;         // Accepted file types (for file inputs)
  options?: Array<{               // Options (for select elements)
    label: string;
    value: string;
  }>;
}
```

## Examples

### Standard Form with Labels

```html
<form id="application-form" action="/apply" method="POST">
  <label for="email">Email Address</label>
  <input type="email" id="email" name="email" required />
  
  <label for="resume">Resume/CV</label>
  <input type="file" id="resume" name="resume" accept=".pdf,.doc,.docx" required />
  
  <button type="submit">Apply Now</button>
</form>
```

**Detected Output:**
```json
{
  "formDetected": true,
  "totalFields": 2,
  "formElement": {
    "id": "application-form",
    "action": "https://example.com/apply",
    "method": "post"
  },
  "fields": [
    {
      "tag": "input",
      "type": "email",
      "id": "email",
      "name": "email",
      "label": "Email Address",
      "required": true,
      "isFileUpload": false
    },
    {
      "tag": "input",
      "type": "file",
      "id": "resume",
      "name": "resume",
      "label": "Resume/CV",
      "accept": ".pdf,.doc,.docx",
      "required": true,
      "isFileUpload": true
    }
  ]
}
```

### React-Style Form (No Form Tag)

```html
<div class="application-container">
  <input type="text" name="firstName" placeholder="First Name" />
  <input type="email" name="email" placeholder="Email" />
  <input type="file" name="resume" />
  <button>Apply Now</button>
</div>
```

**Still Detected!** The detector falls back to container detection when no `<form>` tag exists.

### Form with ARIA Attributes

```html
<form>
  <label for="linkedin">LinkedIn Profile</label>
  <input 
    type="url" 
    id="linkedin" 
    name="linkedin" 
    aria-label="LinkedIn profile URL"
    aria-describedby="linkedin-help"
  />
  <span id="linkedin-help">Enter your full LinkedIn profile URL</span>
</form>
```

**Detected Output:**
```json
{
  "fields": [
    {
      "id": "linkedin",
      "name": "linkedin",
      "label": "LinkedIn Profile",
      "ariaLabel": "LinkedIn profile URL",
      "ariaDescribedBy": "linkedin-help",
      "description": "Enter your full LinkedIn profile URL"
    }
  ]
}
```

## ATS Compatibility

The detector is designed to work with common Applicant Tracking Systems:

- **Greenhouse**: Handles custom file upload widgets with dynamic file input creation
- **Lever**: Detects React-based forms without form tags
- **Workday**: Handles complex nested structures
- **Taleo**: Works with traditional form elements
- **SmartRecruiters**: Detects dynamic field loading
- **Custom ATS**: Falls back to generic detection patterns

## Custom File Upload Widgets

Some ATS platforms (notably Greenhouse) use custom file upload widgets instead of standard `<input type="file">` elements. These widgets:

1. Use `<div>` containers with `data-field` attributes (e.g., `data-field="resume"`)
2. Have `data-file-types` attributes specifying accepted formats
3. Create the actual file input **dynamically** when the user clicks an "Attach" button

### Detection

Custom widgets are detected in `customFileUpload.ts` by looking for:
- Elements with `data-field` attribute containing file-related keywords (resume, cv, cover_letter)
- Elements with `data-file-types` attribute

### Filling Strategy

The filling logic in `fileUploadFilling.ts` handles these widgets:

1. **Find existing input**: Look for hidden `<input type="file">` inside the widget
2. **Click attach button**: If no input exists, click the attach button to create one dynamically
3. **Wait and fill**: Wait 100ms for the input to appear, then set the file
4. **Fallback**: Simulate drag-and-drop if no input can be created

```typescript
// Platform-specific attach button selectors (fileUploadDetection.ts)
const ATTACH_BUTTON_SELECTORS = [
  '[data-source="attach"]',  // Greenhouse
  '[data-qa="upload-button"]', // Lever
  '[data-automation-id="file-upload-input-ref"]', // Workday
  // ... generic patterns
];
```

## Integration

The form detector is integrated into the main scanner:

```typescript
// In scanner.ts
import { detectApplicationForm } from './formDetector.js';

export function scanPage() {
  // ... existing text extraction ...
  
  const applicationForm = detectApplicationForm();
  
  chrome.runtime.sendMessage({
    type: "JD_SCAN",
    url: location.href,
    classification,
    blocks,
    applicationForm, // Form data included
  });
}
```

## Testing

Comprehensive tests cover:
- ✅ Standard forms with various field types
- ✅ File upload detection with accept attributes
- ✅ Select dropdowns with options extraction
- ✅ Textarea fields
- ✅ ARIA labels and descriptions
- ✅ Forms without form tags (React-style)
- ✅ Wrapped labels
- ✅ Multiple forms (prioritization)
- ✅ Complex nested structures
- ✅ Missing labels/placeholders

Run tests:
```bash
pnpm test formDetector
```

## Module Structure

The form detection and filling logic is organized into focused modules:

| Module | Purpose |
|--------|--------|
| `formDetector.ts` | Detect forms and extract field metadata |
| `customFileUpload.ts` | Detect custom file upload widgets |
| `elementFilling.ts` | Fill individual elements (input, select, textarea, contenteditable) |
| `fileUploadDetection.ts` | Find/create file inputs in custom widgets |
| `fileUploadFilling.ts` | Fetch files and fill file upload elements |
| `sidebar/services/formFiller.ts` | High-level form filling orchestration |

## Future Enhancements

Potential improvements:
- [x] ~~Detect custom file upload widgets (drag-drop zones)~~ ✅ Implemented
- [ ] Extract validation rules (regex patterns, min/max length)
- [ ] Detect multi-step forms
- [ ] Extract field grouping/sections
- [ ] Detect conditional fields (show/hide logic)
- [ ] Support for custom web components
