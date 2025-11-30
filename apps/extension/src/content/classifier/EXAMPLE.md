# Apply Button Detection - Examples

## Real-World Scenarios

### ✅ Scenario 1: LinkedIn Job Posting
```html
<div class="jobs-apply-button">
  <button aria-label="Apply to Software Engineer at Google">
    Apply
  </button>
</div>
```

**Detection Result**:
```javascript
{
  hasApplyButton: true,
  confidence: 1.0,
  matches: [{
    text: "Apply to Software Engineer at Google",
    confidence: 1.0,
    matchType: "combined",
    attributes: {
      className: "jobs-apply-button"
    }
  }]
}
```

---

### ✅ Scenario 2: Indeed Quick Apply
```html
<button id="indeedApplyButton" class="ia-continueButton">
  Continue to Application
</button>
```

**Detection Result**:
```javascript
{
  hasApplyButton: true,
  confidence: 1.0,
  matches: [{
    text: "Continue to Application",
    confidence: 1.0,
    matchType: "combined"
  }]
}
```

---

### ✅ Scenario 3: Company Career Page
```html
<a href="/careers/apply/12345" class="apply-link">
  <span>Apply Now</span>
</a>
```

**Detection Result**:
```javascript
{
  hasApplyButton: true,
  confidence: 1.0,
  matches: [{
    text: "Apply Now",
    confidence: 1.0,
    matchType: "combined",
    attributes: {
      href: "/careers/apply/12345",
      className: "apply-link"
    }
  }]
}
```

---

### ✅ Scenario 4: Greenhouse ATS
```html
<input type="submit" 
       id="submit_app" 
       value="Submit Application" 
       class="button" />
```

**Detection Result**:
```javascript
{
  hasApplyButton: true,
  confidence: 1.0,
  matches: [{
    text: "Submit Application",
    confidence: 1.0,
    matchType: "combined"
  }]
}
```

---

### ✅ Scenario 5: Lever Jobs
```html
<div role="button" 
     class="template-btn-submit" 
     onclick="submitApplication()">
  Submit your application
</div>
```

**Detection Result**:
```javascript
{
  hasApplyButton: true,
  confidence: 1.0,
  matches: [{
    text: "Submit your application",
    confidence: 1.0,
    matchType: "combined"
  }]
}
```

---

### ❌ Scenario 6: Job Description Blog Post (False Positive Prevention)
```html
<article>
  <h1>Software Engineer Job Description</h1>
  <p>Responsibilities include developing software...</p>
  <p>Requirements: 5+ years experience...</p>
  <button>Share</button>
  <button>Save</button>
</article>
```

**Detection Result**:
```javascript
{
  hasApplyButton: false,
  confidence: 0,
  matches: []
}
```

**Classification Result**:
```javascript
{
  isJobDescriptionPage: false,  // ❌ No apply button = not a job posting
  confidence: 0.45,              // Text signals present but apply button missing
  applyButtonDetection: {
    hasApplyButton: false
  }
}
```

---

### ❌ Scenario 7: Job Search Results Page
```html
<div class="job-card">
  <h3>Software Engineer</h3>
  <p>Google • Mountain View, CA</p>
  <button>View Details</button>
</div>
<div class="job-card">
  <h3>Product Manager</h3>
  <p>Meta • Menlo Park, CA</p>
  <button>View Details</button>
</div>
```

**Detection Result**:
```javascript
{
  hasApplyButton: false,
  confidence: 0,
  matches: []
}
```

**Why**: "View Details" buttons don't match apply patterns. This is a search results page, not an individual job posting.

---

### ✅ Scenario 8: Multi-Step Application (Step 1)
```html
<form>
  <h2>Step 1 of 3: Basic Information</h2>
  <input type="text" name="name" />
  <input type="email" name="email" />
  <button type="submit" id="continue-btn">
    Continue to Next Step
  </button>
</form>
```

**Detection Result**:
```javascript
{
  hasApplyButton: true,
  confidence: 0.8,
  matches: [{
    text: "Continue to Next Step",
    confidence: 0.8,
    matchType: "combined"
  }]
}
```

---

## Edge Cases

### Hidden Apply Button (Lazy Loading)
```html
<button id="apply-btn" style="display: none;">Apply Now</button>
```

**Detection Result**: `hasApplyButton: false`

**Why**: Hidden elements are filtered out. The detector only considers visible, interactive elements.

---

### Apply Button in Modal (Not Yet Opened)
```html
<!-- Modal hidden by default -->
<div id="apply-modal" style="display: none;">
  <button>Submit Application</button>
</div>

<!-- Trigger button visible -->
<button onclick="openModal()">Apply for this job</button>
```

**Detection Result**: `hasApplyButton: true`

**Why**: The trigger button "Apply for this job" matches the pattern, even though the actual submit button is hidden in a modal.

---

### Non-English Apply Button
```html
<button>Postuler maintenant</button>  <!-- French: Apply now -->
```

**Detection Result**: `hasApplyButton: false`

**Current Limitation**: The detector currently only supports English patterns. Multi-language support could be added in the future.

---

## Integration Example

```typescript
import { classifyDocument } from './jobDescriptionClassifier';
import { extractTextBlocks } from '../scanner/textBlocksExtractor';

// Extract and classify page
const paragraphs = extractTextBlocks();
const result = classifyDocument(paragraphs);

if (result.isJobDescriptionPage) {
  console.log('✅ Job posting detected!');
  console.log(`Confidence: ${result.confidence}`);
  console.log(`Apply button: ${result.applyButtonDetection?.matches[0]?.text}`);
  
  // Proceed with job application automation
  chrome.runtime.sendMessage({
    type: 'JOB_FOUND',
    url: window.location.href,
    applyButton: result.applyButtonDetection?.matches[0]
  });
} else {
  console.log('❌ Not a job posting');
  
  if (!result.applyButtonDetection?.hasApplyButton) {
    console.log('Reason: No apply button found');
  }
}
```

## Performance Considerations

- **DOM Queries**: Single `querySelectorAll` call for all interactive elements
- **Filtering**: Early returns for hidden/non-interactive elements
- **Caching**: Results can be cached if page doesn't change
- **Typical Runtime**: < 10ms for most pages (tested on pages with 100+ buttons)

## Future Enhancements

1. **Multi-language Support**: Detect apply buttons in other languages
2. **Dynamic Content**: Re-scan when DOM changes (MutationObserver)
3. **Machine Learning**: Train on real job posting data to improve patterns
4. **ATS-Specific Patterns**: Add patterns for popular ATS systems (Workday, Taleo, etc.)
5. **Confidence Tuning**: A/B test different confidence thresholds
