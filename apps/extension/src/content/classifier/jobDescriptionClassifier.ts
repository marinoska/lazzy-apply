import {
  universalActionVerbs,
  responsibilityExpressions,
  requirementTerminology,
  candidatePhrases,
  skillTerminology,
  environmentTerms,
  universalSoftSkills,
  obligationWords,
  operationalVerbs,
  structurePatterns,
} from './semanticClusters';
import { detectApplyButtons, type ApplyButtonDetectionResult } from './applyButtonDetector';

// Classification thresholds
const MIN_PARAGRAPH_LENGTH = 30; // Minimum characters for a paragraph to be classified
const MIN_SECTION_LENGTH = 30; // Minimum characters for a section to be classified
const CONFIDENCE_THRESHOLD = 0.30; // Minimum confidence to classify as job description
const MIN_SIGNALS_REQUIRED = 2; // Minimum number of signals needed for classification

// Document-level thresholds
const MIN_JD_PARAGRAPHS = 2; // Minimum paragraphs needed to classify as job description page
const MIN_JD_SECTIONS = 1; // Minimum sections needed to classify as job description page
const SECTION_SIZE = 3; // Number of consecutive paragraphs to group into a section
const DOMINANT_SIGNAL_THRESHOLD = 0.3; // Minimum ratio of paragraphs to consider a signal "dominant"
const HIGH_SIGNAL_DENSITY_THRESHOLD = 0.5; // Signal density threshold for high confidence
const MIN_DOMINANT_SIGNALS = 3; // Minimum number of dominant signals for high confidence

// Signal aggregation constants
const EXPECTED_SIGNALS_PER_PARAGRAPH = 3; // Expected number of signals in a strong job description paragraph

// Confidence calculation weights
const PARAGRAPH_RATIO_WEIGHT = 0.3; // Weight for paragraph-level classification in overall confidence
const SECTION_RATIO_WEIGHT = 0.5; // Weight for section-level classification in overall confidence
const SIGNAL_DENSITY_WEIGHT = 0.4; // Weight for signal density in overall confidence

// Display constants
const PARAGRAPH_PREVIEW_LENGTH = 100; // Characters to show in console logs for paragraph preview

export interface ClassificationSignals {
  responsibility_language: boolean;
  requirement_language: boolean;
  candidate_framing: boolean;
  action_verbs: boolean;
  soft_skills: boolean;
  job_structure_patterns: boolean;
}

export interface ClassificationResult {
  isJobDescription: boolean;
  confidence?: number;
  signals?: ClassificationSignals;
  explanation: string;
  text: string;
}

// Helper function to check if text matches any pattern from array (case-insensitive)
const matchesAnyPattern = (text: string, patterns: RegExp[]): boolean => {
  return patterns.some(pattern => pattern.test(text));
};

/**
 * Deterministic, role-neutral Job Description Classifier
 * Analyzes text blocks and determines if content represents a job description
 * based on universal linguistic and structural patterns
 */
export function classifyJobDescription(text: string): ClassificationResult {
  // Signal detection using semantic clusters
  const signals: ClassificationSignals = {
    responsibility_language: matchesAnyPattern(text, [...responsibilityExpressions, ...obligationWords]),
    requirement_language: matchesAnyPattern(text, [...requirementTerminology, ...skillTerminology]),
    candidate_framing: matchesAnyPattern(text, candidatePhrases),
    action_verbs: matchesAnyPattern(text, [...universalActionVerbs, ...operationalVerbs]),
    soft_skills: matchesAnyPattern(text, [...universalSoftSkills, ...environmentTerms]),
    job_structure_patterns: matchesAnyPattern(text, structurePatterns),
  };

  // Count positive signals
  const positiveSignals = Object.values(signals).filter(Boolean).length;
  const totalSignals = Object.keys(signals).length;
  
  // Calculate confidence
  const confidence = positiveSignals / totalSignals;
  
  // Decision threshold: must meet BOTH confidence threshold AND minimum signals
  const isJobDescription = confidence >= CONFIDENCE_THRESHOLD && positiveSignals >= MIN_SIGNALS_REQUIRED;

  // Generate explanation
  const activeSignals = Object.entries(signals)
    .filter(([_, value]) => value)
    .map(([key]) => key.replace(/_/g, ' '));

  const explanation = isJobDescription
    ? `Detected job description with ${activeSignals.length} signals: ${activeSignals.join(', ')}`
    : `Not a job description. Only ${activeSignals.length} signals detected: ${activeSignals.join(', ') || 'none'}`;

  return {
    isJobDescription,
    confidence: Math.round(confidence * 100) / 100,
    signals,
    explanation,
    text,
  };
}

/**
 * Batch classifier for multiple text blocks (paragraphs)
 * Evaluates each paragraph independently
 * Returns all paragraphs but only examines those exceeding MIN_PARAGRAPH_LENGTH
 */
export function classifyParagraphs(paragraphs: string[]): ClassificationResult[] {
  const examinedCount = paragraphs.filter(p => p.trim().length > MIN_PARAGRAPH_LENGTH).length;
  console.log(`Examining ${examinedCount} paragraphs out of ${paragraphs.length} total`);
  
  return paragraphs.map(paragraph => {
    // Clean paragraph: strip newlines, normalize spaces, and trim

    
    // Only examine paragraphs that exceed minimum length
    if (paragraph.length <= MIN_PARAGRAPH_LENGTH) {
      // Return a default "not job description" result for short paragraphs
      // Note: confidence and signals are not included to avoid affecting overall calculations
      return {
        isJobDescription: false,
        explanation: `Not examined due to insufficient length (${paragraph.length} chars, minimum ${MIN_PARAGRAPH_LENGTH})`,
        text: paragraph,
      };
    }
    
    const result = classifyJobDescription(paragraph);

    return result;
  });
}

/**
 * Section-level classifier: Groups consecutive paragraphs into sections
 * and classifies them as a unit to capture distributed signals
 */
function classifySections(paragraphs: string[], sectionSize = SECTION_SIZE): ClassificationResult[] {
  const results: ClassificationResult[] = [];
  
  for (let i = 0; i < paragraphs.length; i += sectionSize) {
    const section = paragraphs.slice(i, i + sectionSize);
    const combinedText = section.join(' ');
    
    if (combinedText.trim().length > MIN_SECTION_LENGTH) {
      results.push(classifyJobDescription(combinedText));
    }
  }
  
  return results;
}

/**
 * Aggregate all signals across all paragraphs to get document-level signal density
 */
function aggregateSignals(results: ClassificationResult[]): {
  totalSignals: Record<keyof ClassificationSignals, number>;
  signalDensity: number;
} {
  const totalSignals: Record<keyof ClassificationSignals, number> = {
    responsibility_language: 0,
    requirement_language: 0,
    candidate_framing: 0,
    action_verbs: 0,
    soft_skills: 0,
    job_structure_patterns: 0,
  };

  for (const result of results) {
    if (result.signals) {
      for (const [key, value] of Object.entries(result.signals)) {
        if (value) {
          totalSignals[key as keyof ClassificationSignals]++;
        }
      }
    }
  }

  // Calculate signal density: how many paragraphs have each signal type
  const signalCounts = Object.values(totalSignals);
  const totalParagraphs = results.length || 1;
  const avgSignalsPerParagraph = signalCounts.reduce((a, b) => a + b, 0) / totalParagraphs;
  
  // Normalize to 0-1 range (assuming EXPECTED_SIGNALS_PER_PARAGRAPH+ signals per paragraph is very strong)
  const signalDensity = Math.min(avgSignalsPerParagraph / EXPECTED_SIGNALS_PER_PARAGRAPH, 1);

  return { totalSignals, signalDensity };
}

/**
 * Aggregate classification for entire page/document
 * Uses multi-level analysis:
 * 1. Paragraph-level classification
 * 2. Section-level classification (groups of paragraphs)
 * 3. Document-level signal aggregation
 * 4. Apply button detection (validates job posting)
 */
export function classifyDocument(rawParagraphs: string[]): {
  totalParagraphs: number;
  jobDescriptionParagraphs: number;
  paragraphRatio: number;
  sectionRatio: number;
  confidence: number;
  signalDensity: number;
  dominantSignals: string[];
  results: ClassificationResult[];
  applyButtonDetection: ApplyButtonDetectionResult;
} {
    // Clean paragraphs: remove newlines, extra spaces, trim
    const paragraphs = rawParagraphs.map(p => p.replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim());

  const results = classifyParagraphs(paragraphs);
  const jobDescriptionParagraphs = results.filter(r => r.isJobDescription).length;

  // Section-level analysis for better context
  const sectionResults = classifySections(paragraphs.filter(p => p.length > MIN_PARAGRAPH_LENGTH), SECTION_SIZE);
  const jobDescriptionSections = sectionResults.filter(r => r.isJobDescription).length;

  // Document-level signal aggregation
  const { totalSignals, signalDensity } = aggregateSignals(results);
  
  // Find dominant signals (present in >DOMINANT_SIGNAL_THRESHOLD of paragraphs)
  const dominantSignals = Object.entries(totalSignals)
    .filter(([_, count]) => count / results.length > DOMINANT_SIGNAL_THRESHOLD)
    .map(([key]) => key.replace(/_/g, ' '))
    .sort((a, b) => totalSignals[b.replace(/ /g, '_') as keyof ClassificationSignals] - 
                     totalSignals[a.replace(/ /g, '_') as keyof ClassificationSignals]);

  // Apply button detection - critical validation for job postings
  const applyButtonDetection = detectApplyButtons();
  
  // Multi-level decision:
  // - High confidence: Multiple paragraphs OR multiple sections classified as JD
  // - Medium confidence: High signal density across document
  // - Low confidence: At least one paragraph with strong signals
  // - Apply button is a strong validator when available
  const paragraphRatio = jobDescriptionParagraphs / Math.max(results.length, 1);
  const sectionRatio = jobDescriptionSections / Math.max(sectionResults.length, 1);
  
  // Calculate overall confidence based on multiple factors
  const textConfidence = 
    (paragraphRatio * PARAGRAPH_RATIO_WEIGHT) + 
    (sectionRatio * SECTION_RATIO_WEIGHT) + 
    (signalDensity * SIGNAL_DENSITY_WEIGHT);
  
  // Combine text confidence with apply button confidence
  // Both are required, so use weighted average
  const confidence = Math.min(
    (textConfidence * 0.6) + (applyButtonDetection.confidence * 0.4),
    1.0
  );

  return {
    totalParagraphs: results.length,
    jobDescriptionParagraphs,
    paragraphRatio: Math.round(paragraphRatio * 100) / 100,
    sectionRatio: Math.round(sectionRatio * 100) / 100,
    confidence: Math.round(confidence * 100) / 100,
    signalDensity: Math.round(signalDensity * 100) / 100,
    dominantSignals,
    results,
    applyButtonDetection,
  };
}
