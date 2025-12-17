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

**Uses compromise NLP library** for semantic matching to identify application CTAs on job posting pages.

A critical validation signal - genuine job postings **must** have an apply button/link. This helps:
- **Reduce false positives**: Pages with job-like text but no apply button are likely not actual job postings
- **Improve accuracy**: Combines text analysis with UI element detection for higher confidence
- **Validate intent**: Confirms the page is designed for job applications, not just job information

#### How It Works

1. **Phrase Recognition**: Exact phrase matching ("Apply Now", "Submit Application", "Quick Apply")
2. **NLP-Based Semantic Analysis**: Uses compromise's `.verbs()`, `.nouns()`, `.terms()` for detection
3. **Multi-Layer Scoring**:
   - Layer 1: Exact phrase match → 1.0 confidence
   - Layer 2: Apply verb + job context → 0.8 confidence
   - Layer 3: Apply verb + urgency → 0.7 confidence
   - Layer 4: Apply verb alone → 0.5 confidence
   - Layer 5: Apply word present → 0.4 confidence
4. **Attribute Analysis**: Element IDs, class names, ARIA labels
5. **Interactive Element Validation**: Only visible buttons/links with valid hrefs

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
5. Detect apply buttons using NLP
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

---

## Regex Pattern Strategy

All semantic clusters use **RegExp patterns** instead of strings for consistent, accurate matching with proper word boundaries.

### Word Boundary Rules

**Use `\b` for:**
- **Action verbs**: Match exact verb forms, not noun/adjective variations
  ```typescript
  /\bmanage\b/i     // ✅ "manage teams" ❌ "management", "manager"
  /\blead\b/i       // ✅ "lead projects" ❌ "leader", "leadership"
  ```
- **Obligation words**: Match exact modal verbs
  ```typescript
  /\bmust\b/i       // ✅ "must have" ❌ "musty"
  ```
- **Short common words**: Prevent false matches
  ```typescript
  /\bteam\b/i       // ✅ "team player" ❌ "steam"
  ```

**Don't use `\b` for:**
- **Multi-word phrases**: Already specific enough
  ```typescript
  /responsible for/i, /attention to detail/i
  ```
- **Pattern stems**: Match word variations
  ```typescript
  /communicat/i     // ✅ "communicate", "communication", "communicating"
  /abilit/i         // ✅ "ability", "abilities"
  /proficien/i      // ✅ "proficiency", "proficient"
  ```

### Pattern Categories Summary

| Category | Strategy | Example |
|----------|----------|---------|
| Action Verbs | Word boundaries | `/\bmanage\b/i` |
| Responsibility Expressions | No boundaries | `/responsible for/i` |
| Requirement Terminology | Pattern stems | `/requirement/i` |
| Candidate Phrases | No boundaries | `/the ideal candidate/i` |
| Skill Terminology | Mixed | `/\bskill/i`, `/abilit/i` |
| Environment Terms | Mixed | `/\bteam/i`, `/collaborat/i` |
| Obligation Words | Word boundaries | `/\bmust\b/i` |
| Structure Patterns | No boundaries | `/responsibilities:/i` |

---

## Usage Examples

### Basic Usage

```typescript
import { classifyDocument } from './jobDescriptionClassifier';
import { detectApplyButtons, hasApplyButton } from './applyButtonDetector';

// Quick boolean check
if (hasApplyButton()) {
  console.log('This is a job posting page!');
}

// Full classification
const classification = classifyDocument(paragraphs);
// {
//   isJobDescriptionPage: true,
//   confidence: 0.85,
//   applyButtonDetection: { hasApplyButton: true, confidence: 0.95, matches: [...] }
// }
```

### Real-World Detection Examples

**LinkedIn Job Posting**:
```html
<button aria-label="Apply to Software Engineer at Google">Apply</button>
```
Result: `{ hasApplyButton: true, confidence: 1.0 }`

**Indeed Quick Apply**:
```html
<button id="indeedApplyButton">Continue to Application</button>
```
Result: `{ hasApplyButton: true, confidence: 1.0 }`

**Job Blog Post (False Positive Prevention)**:
```html
<article>
  <h1>Software Engineer Job Description</h1>
  <p>Responsibilities include developing software...</p>
  <button>Share</button>
</article>
```
Result: `{ hasApplyButton: false }` → Page classified as NOT a job posting

### Edge Cases

- **Hidden buttons**: Filtered out (only visible elements considered)
- **Modal triggers**: "Apply for this job" button detected even if submit is in hidden modal
- **Non-English**: Currently only English patterns supported

---

## Testing

```bash
pnpm test -- applyButtonDetector.test.ts --run
pnpm test -- jobDescriptionClassifier.test.ts --run
```

## Performance

- **NLP analysis**: ~1-5ms per button text
- **Total detection**: <10ms for typical pages
- **Bundle size**: +200KB for compromise library

## Dependencies

- **compromise**: Lightweight NLP library (~200KB minified, browser-compatible)

## Future Enhancements

1. Multi-language support
2. Dynamic content re-scanning (MutationObserver)
3. ATS-specific patterns (Workday, Taleo, etc.)
4. Machine learning-based pattern improvement
