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

- **Greenhouse**: Handles custom drag-drop file upload zones
- **Lever**: Detects React-based forms without form tags
- **Workday**: Handles complex nested structures
- **Taleo**: Works with traditional form elements
- **SmartRecruiters**: Detects dynamic field loading
- **Custom ATS**: Falls back to generic detection patterns

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

## Future Enhancements

Potential improvements:
- [ ] Detect custom file upload widgets (drag-drop zones)
- [ ] Extract validation rules (regex patterns, min/max length)
- [ ] Detect multi-step forms
- [ ] Extract field grouping/sections
- [ ] Detect conditional fields (show/hide logic)
- [ ] Support for custom web components
