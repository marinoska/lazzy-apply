/**
 * Apply Button/Link Detector
 * Uses NLP-based semantic matching to identify application CTAs on job posting pages
 * Validates that a page is likely a job posting by detecting apply buttons/links
 */

import nlp from 'compromise';

// High-confidence apply action phrases
const APPLY_ACTION_PHRASES = [
  'apply now',
  'apply today',
  'apply online',
  'apply here',
  'quick apply',
  'easy apply',
  '1-click apply',
  'submit application',
  'submit resume',
  'submit cv',
  'submit now',
  'continue to application',
  'continue applying',
  'next step',
  'proceed to apply',
  'start application',
  'begin application',
  'get started',
  'join our team',
  'join team',
  'join us',
  'view and apply',
  'apply for this job',
  'apply for this position',
  'apply for this role',
];

// Core apply verbs
const APPLY_VERBS = ['apply', 'submit', 'continue', 'proceed', 'start', 'begin'];

// Job context words
const JOB_CONTEXT_WORDS = [
  'job',
  'position',
  'role',
  'application',
  'resume',
  'cv',
  'candidate',
];

// Temporal/urgency words
const URGENCY_WORDS = ['now', 'today', 'online', 'quick', 'easy'];

// ID/Class/Name patterns that suggest apply buttons
const APPLY_ATTRIBUTE_PATTERNS = [
  /apply/i,
  /submit/i,
  /application/i,
  /job[-_]?apply/i,
  /apply[-_]?btn/i,
  /apply[-_]?button/i,
  /apply[-_]?link/i,
  /cta[-_]?apply/i,
  /continue[-_]?application/i,
];

export interface ApplyButtonMatch {
  element: HTMLElement;
  text: string;
  confidence: number;
  matchType: 'text' | 'attribute' | 'combined';
  attributes: {
    id?: string;
    className?: string;
    name?: string;
    href?: string;
  };
}

export interface ApplyButtonDetectionResult {
  hasApplyButton: boolean;
  confidence: number;
  matches: ApplyButtonMatch[];
  totalCandidates: number;
}

/**
 * Calculate semantic similarity score using NLP
 * Analyzes button text with compromise to detect apply-related actions
 */
function calculateTextConfidence(text: string): number {
  if (!text || text.trim().length === 0) {
    return 0;
  }
  
  const normalizedText = text.toLowerCase().trim();
  
  // Check for exact phrase matches (highest confidence)
  for (const phrase of APPLY_ACTION_PHRASES) {
    if (normalizedText.includes(phrase)) {
      return 1.0;
    }
  }
  
  // Parse text with NLP for semantic analysis
  const doc = nlp(normalizedText);
  
  // Check for apply verbs using NLP verb detection
  const verbs = doc.verbs().out('array') as string[];
  const hasApplyVerb = verbs.some((verb: string) => 
    APPLY_VERBS.some(applyVerb => verb.toLowerCase().includes(applyVerb))
  );
  
  if (hasApplyVerb) {
    let score = 0.5;
    
    // Use NLP to detect nouns and check for job context
    const nouns = doc.nouns().out('array') as string[];
    const hasJobContext = nouns.some((noun: string) =>
      JOB_CONTEXT_WORDS.some(contextWord => 
        noun.toLowerCase().includes(contextWord)
      )
    );
    
    if (hasJobContext) {
      score += 0.3;
    }
    
    // Check for urgency/temporal words
    const words = doc.terms().out('array') as string[];
    const hasUrgency = words.some((word: string) =>
      URGENCY_WORDS.some(urgencyWord => 
        word.toLowerCase().includes(urgencyWord)
      )
    );
    
    if (hasUrgency) {
      score += 0.2;
    }
    
    return Math.min(score, 1.0);
  }
  
  // Fallback: check if text contains any apply-related words
  const allWords = doc.terms().out('array') as string[];
  const hasApplyWord = allWords.some((word: string) =>
    APPLY_VERBS.some(applyVerb => word.toLowerCase() === applyVerb)
  );
  
  if (hasApplyWord) {
    return 0.4;
  }
  
  return 0;
}

/**
 * Calculate confidence based on element attributes (id, class, name)
 */
function calculateAttributeConfidence(element: HTMLElement): number {
  const id = element.id || '';
  const className = element.className || '';
  const name = element.getAttribute('name') || '';
  
  const attributeText = `${id} ${className} ${name}`.toLowerCase();
  
  for (const pattern of APPLY_ATTRIBUTE_PATTERNS) {
    if (pattern.test(attributeText)) {
      return 0.7; // Attributes are strong signals but not as definitive as text
    }
  }
  
  return 0;
}

/**
 * Check if element is a valid interactive element (button, link, input)
 */
function isInteractiveElement(element: HTMLElement): boolean {
  const tagName = element.tagName.toLowerCase();
  
  if (tagName === 'button' || tagName === 'input') {
    return true;
  }
  
  if (tagName === 'a') {
    const href = element.getAttribute('href');
    return href !== null && href !== '#' && href !== '';
  }
  
  // Check for clickable divs/spans with role="button"
  const role = element.getAttribute('role');
  if (role === 'button' || role === 'link') {
    return true;
  }
  
  // Check for elements with click handlers
  const hasClickHandler = element.onclick !== null || 
                         element.hasAttribute('onclick') ||
                         element.style.cursor === 'pointer';
  
  return hasClickHandler;
}

/**
 * Extract visible text from element, including aria-label
 */
function getElementText(element: HTMLElement): string {
  // Check aria-label first
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) {
    return ariaLabel;
  }
  
  // Get text content, but limit to direct text (not deep children)
  const text = element.textContent?.trim() || '';
  
  // For inputs, check value attribute
  if (element.tagName.toLowerCase() === 'input') {
    const value = element.getAttribute('value');
    if (value) {
      return value;
    }
  }
  
  return text;
}

/**
 * Detect apply buttons/links on the page
 * Returns all matches with confidence scores
 */
export function detectApplyButtons(): ApplyButtonDetectionResult {
  const matches: ApplyButtonMatch[] = [];
  
  // Query all potential interactive elements
  const selectors = [
    'button',
    'a[href]',
    'input[type="button"]',
    'input[type="submit"]',
    '[role="button"]',
    '[role="link"]',
  ];
  
  const candidates = Array.from(document.querySelectorAll(selectors.join(', ')));
  
  for (const element of candidates) {
    if (!(element instanceof HTMLElement)) continue;
    
    // Skip hidden elements
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      continue;
    }
    
    // Verify it's interactive
    if (!isInteractiveElement(element)) {
      continue;
    }
    
    const text = getElementText(element);
    
    // Skip if text is too long (likely not a button)
    if (text.length > 100) {
      continue;
    }
    
    const textConfidence = calculateTextConfidence(text);
    const attributeConfidence = calculateAttributeConfidence(element);
    
    // Combined confidence (weighted average, text is more important)
    const confidence = Math.max(
      textConfidence,
      attributeConfidence,
      (textConfidence * 0.7 + attributeConfidence * 0.3)
    );
    
    // Only include if confidence is above threshold
    if (confidence >= 0.4) {
      const matchType = 
        textConfidence > 0 && attributeConfidence > 0 ? 'combined' :
        textConfidence > 0 ? 'text' :
        'attribute';
      
      matches.push({
        element,
        text,
        confidence,
        matchType,
        attributes: {
          id: element.id || undefined,
          className: typeof element.className === 'string' ? element.className : undefined,
          name: element.getAttribute('name') || undefined,
          href: element.getAttribute('href') || undefined,
        },
      });
    }
  }
  
  // Sort by confidence (highest first)
  matches.sort((a, b) => b.confidence - a.confidence);
  
  // Calculate overall confidence
  const hasApplyButton = matches.length > 0;
  const overallConfidence = hasApplyButton 
    ? Math.min(matches[0].confidence + (matches.length - 1) * 0.1, 1.0)
    : 0;
  
  return {
    hasApplyButton,
    confidence: Math.round(overallConfidence * 100) / 100,
    matches: matches.slice(0, 5), // Return top 5 matches
    totalCandidates: candidates.length,
  };
}

/**
 * Quick check if page has an apply button (for use in classification)
 */
export function hasApplyButton(): boolean {
  const result = detectApplyButtons();
  return result.hasApplyButton && result.confidence >= 0.5;
}
