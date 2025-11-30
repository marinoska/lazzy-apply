# Job Description Classifier

This module provides intelligent classification of web pages to determine if they contain job postings.

## Components

### 1. Job Description Classifier (`jobDescriptionClassifier.ts`)

Analyzes text content using semantic pattern matching to identify job description language:

- **Responsibility language**: "responsible for", "you will", "duties include"
- **Requirement language**: "must have", "required", "qualifications"
- **Candidate framing**: "ideal candidate", "we're looking for"
- **Action verbs**: "manage", "develop", "collaborate"
- **Soft skills**: "team player", "problem solving", "communication"
- **Job structure patterns**: Section headers like "Requirements:", "Responsibilities:"

### 2. Apply Button Detector (`applyButtonDetector.ts`)

**Uses compromise NLP library** for semantic matching to identify application CTAs (Call-to-Actions) on job posting pages.

#### Why Apply Button Detection?

A critical validation signal - genuine job postings **must** have an apply button/link. This helps:
- **Reduce false positives**: Pages with job-like text but no apply button are likely not actual job postings
- **Improve accuracy**: Combines text analysis with UI element detection for higher confidence
- **Validate intent**: Confirms the page is designed for job applications, not just job information

#### How It Works with NLP

The detector uses **compromise** - a lightweight NLP library for JavaScript:

1. **Phrase Recognition**
   - Exact phrase matching for high-confidence patterns
   - "Apply Now", "Submit Application", "Quick Apply", etc.

2. **NLP-Based Semantic Analysis**
   - **Verb Detection**: Uses compromise's `.verbs()` to identify action verbs
   - **Noun Detection**: Uses compromise's `.nouns()` to find job-related context
   - **Term Analysis**: Uses compromise's `.terms()` for urgency/temporal words
   
3. **Multi-Layer Scoring**
   - **Layer 1**: Exact phrase match → 1.0 confidence
   - **Layer 2**: Apply verb + job context → 0.8 confidence
   - **Layer 3**: Apply verb + urgency → 0.7 confidence
   - **Layer 4**: Apply verb alone → 0.5 confidence
   - **Layer 5**: Apply word present → 0.4 confidence

4. **Attribute Analysis**
   - Element IDs: `apply-btn`, `job-apply`, `submit-application`
   - Class names: `apply-button`, `cta-apply`, `job-apply-link`
   - ARIA labels: `aria-label="Apply for this position"`

5. **Interactive Element Validation**
   - Only considers buttons, links, and interactive elements
   - Filters out hidden/invisible elements
   - Validates href attributes on links (not `#` or empty)

#### NLP Features Used

```typescript
import nlp from 'compromise';

const doc = nlp("Apply for this job now");

// Verb detection
doc.verbs().out('array')  // ["Apply"]

// Noun detection  
doc.nouns().out('array')  // ["job"]

// All terms
doc.terms().out('array')  // ["Apply", "for", "this", "job", "now"]
```

#### Supported Patterns

**High Confidence (Exact Phrases)**:
- "apply now", "apply today", "apply online"
- "quick apply", "easy apply", "1-click apply"
- "submit application", "submit resume/cv"
- "continue to application", "start application"
- "join our team", "join us"

**NLP-Detected Patterns**:
- Apply verbs: apply, submit, continue, proceed, start, begin
- Job context: job, position, role, application, resume, cv, candidate
- Urgency words: now, today, online, quick, easy

#### Usage

```typescript
import { detectApplyButtons, hasApplyButton } from './applyButtonDetector';

// Detailed detection with NLP analysis
const result = detectApplyButtons();
console.log(result);
// {
//   hasApplyButton: true,
//   confidence: 0.95,
//   matches: [
//     {
//       element: HTMLButtonElement,
//       text: "Apply Now",
//       confidence: 1.0,
//       matchType: "text",
//       attributes: { id: "apply-btn", className: "cta-button" }
//     }
//   ],
//   totalCandidates: 15
// }

// Quick boolean check
if (hasApplyButton()) {
  console.log('This is a job posting page!');
}
```

#### Integration with Document Classifier

The apply button detector is integrated into `classifyDocument()`:

```typescript
const classification = classifyDocument(paragraphs);
// {
//   isJobDescriptionPage: true,  // Requires BOTH text signals AND apply button
//   confidence: 0.85,             // 60% text + 40% apply button confidence
//   applyButtonDetection: {
//     hasApplyButton: true,
//     confidence: 0.95,
//     matches: [...]
//   }
// }
```

**Key Decision Logic**:
- Page must have **both** job description text signals **and** an apply button
- Overall confidence is weighted: 60% text analysis + 40% apply button detection
- Without an apply button, the page is classified as NOT a job posting

### 3. Semantic Clusters (`semanticClusters.ts`)

Contains regex patterns for all semantic categories used in classification.

## Classification Flow

```
1. Extract text blocks from page
   ↓
2. Classify individual paragraphs
   ↓
3. Classify sections (groups of paragraphs)
   ↓
4. Aggregate signals across document
   ↓
5. Detect apply buttons using NLP ← compromise library
   ↓
6. Calculate final confidence score
   ↓
7. Make binary decision: Job Posting or Not
```

## Confidence Calculation

```
Text Confidence = 
  (Paragraph Ratio × 0.3) + 
  (Section Ratio × 0.5) + 
  (Signal Density × 0.4)

Final Confidence = 
  (Text Confidence × 0.6) + 
  (Apply Button Confidence × 0.4)
```

## Dependencies

- **compromise**: Lightweight NLP library (~200KB minified)
  - Fast: processes text in milliseconds
  - Browser-compatible
  - No external dependencies
  - Part-of-speech tagging, verb/noun detection

## Testing

Run tests with:
```bash
pnpm test -- applyButtonDetector.test.ts --run
```

The test suite validates:
- NLP-based pattern matching for various button texts
- Verb and noun detection
- Attribute-based detection
- Hidden element filtering
- Confidence scoring
- Multiple button ranking
- Edge cases (long text, non-interactive elements, etc.)

## Performance

- **compromise NLP**: ~1-5ms per button text analysis
- **Total detection**: <10ms for typical pages with 50+ buttons
- **Memory**: Minimal overhead, compromise is lightweight
- **Bundle size**: +200KB for compromise library
