/**
 * Usage examples for the Job Description Classifier
 * Demonstrates how to use all semantic cluster arrays
 */

import {
  classifyJobDescription,
  classifyParagraphs,
  classifyDocument,
  universalCluster,
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
} from './index';

// Example 1: Basic classification
export function example1_BasicClassification() {
  const text = `
    You will be responsible for managing customer relationships and 
    ensuring satisfaction. Requirements include 3+ years experience 
    and excellent communication skills.
  `;

  const result = classifyJobDescription(text);
  console.log('Example 1 - Basic Classification:', result);
  // Expected: isJobDescription: true, confidence: 0.67+
}

// Example 2: Using semantic clusters for custom validation
export function example2_CustomValidation(text: string) {
  // Check which semantic clusters are present
  const analysis = {
    hasActionVerbs: universalActionVerbs.some(pattern => pattern.test(text)),
    hasResponsibilityLanguage: responsibilityExpressions.some(pattern => pattern.test(text)),
    hasRequirementTerms: requirementTerminology.some(pattern => pattern.test(text)),
    hasCandidatePhrases: candidatePhrases.some(pattern => pattern.test(text)),
    hasSoftSkills: universalSoftSkills.some(pattern => pattern.test(text)),
    hasOperationalVerbs: operationalVerbs.some(pattern => pattern.test(text)),
  };

  console.log('Example 2 - Custom Validation:', analysis);
  return analysis;
}

// Example 3: Batch processing multiple paragraphs
export function example3_BatchProcessing() {
  const paragraphs = [
    'About our company: We are a leading provider of innovative solutions.',
    'You will be responsible for developing software applications using modern frameworks.',
    'Our mission is to empower businesses through technology and strategic partnerships.',
    'Requirements: 5+ years experience, strong communication skills, team player.',
  ];

  const results = classifyParagraphs(paragraphs);
  console.log('Example 3 - Batch Processing:');
  results.forEach((result, index) => {
    console.log(`Paragraph ${index + 1}:`, {
      isJobDescription: result.isJobDescription,
      confidence: result.confidence,
      signals: result.signals ? Object.entries(result.signals)
        .filter(([_, value]) => value)
        .map(([key]) => key) : [],
    });
  });
}

// Example 4: Document-level classification
export function example4_DocumentClassification() {
  const paragraphs = [
    'Join our amazing team! We are a fast-growing startup in the tech industry.',
    'The ideal candidate will have experience managing cross-functional teams and coordinating with stakeholders.',
    'Responsibilities include planning projects, monitoring progress, and delivering results.',
    'Qualifications: Bachelor\'s degree, 3+ years experience, excellent problem solving skills.',
    'We offer competitive salary, health benefits, and a collaborative work environment.',
  ];

  const result = classifyDocument(paragraphs);
  console.log('Example 4 - Document Classification:', {
    confidence: result.confidence,
    totalParagraphs: result.totalParagraphs,
    jobDescriptionParagraphs: result.jobDescriptionParagraphs,
    percentage: `${((result.jobDescriptionParagraphs / result.totalParagraphs) * 100).toFixed(1)}%`,
    signalDensity: result.signalDensity,
  });
}

// Example 5: Industry-specific examples
export function example5_IndustryExamples() {
  const examples = {
    software: 'You will develop and maintain web applications using React, TypeScript, and modern frameworks.',
    warehouse: 'Duties include loading trucks, operating forklifts, and maintaining inventory accuracy.',
    healthcare: 'The role involves providing patient care, maintaining medical records, and coordinating with healthcare professionals.',
    retail: 'You will assist customers, organize merchandise, and maintain store cleanliness in a fast-paced environment.',
    construction: 'Responsibilities include operating heavy machinery, inspecting equipment, and ensuring safety protocols.',
  };

  console.log('Example 5 - Industry-Specific Examples:');
  Object.entries(examples).forEach(([industry, text]) => {
    const result = classifyJobDescription(text);
    console.log(`${industry}:`, {
      isJobDescription: result.isJobDescription,
      confidence: result.confidence,
      topSignals: result.signals ? Object.entries(result.signals)
        .filter(([_, value]) => value)
        .map(([key]) => key)
        .slice(0, 3) : [],
    });
  });
}

// Example 6: Using individual semantic clusters for filtering
export function example6_SemanticFiltering(text: string) {
  // Filter by specific cluster types
  const filters = {
    // Only white-collar jobs (office environment)
    isWhiteCollar: environmentTerms.some(pattern => pattern.test(text)) && 
                   !operationalVerbs.some(pattern => pattern.test(text)),

    // Only blue-collar jobs (operational/physical work)
    isBlueCollar: operationalVerbs.some(pattern => pattern.test(text)),

    // Management/leadership roles
    isLeadership: [/\blead\b/i, /\bmanage\b/i, /\bsupervise\b/i, /\boversee\b/i].some(pattern => 
      pattern.test(text)
    ),

    // Entry-level (no experience requirements)
    isEntryLevel: !/years/i.test(text) && !/experience required/i.test(text),
  };

  console.log('Example 6 - Semantic Filtering:', filters);
  return filters;
}

// Example 7: Confidence threshold tuning
export function example7_ConfidenceThresholds(text: string) {
  const result = classifyJobDescription(text);

  const confidence = result.confidence ?? 0;
  const thresholds = {
    veryConfident: confidence >= 0.67,  // 4+ signals
    confident: confidence >= 0.50,      // 3+ signals
    moderate: confidence >= 0.30,       // 2+ signals (default)
    low: confidence < 0.30,             // 0-1 signals
  };

  console.log('Example 7 - Confidence Thresholds:', {
    confidence: result.confidence,
    classification: thresholds,
    recommendation: thresholds.veryConfident ? 'Definitely a job description' :
                   thresholds.confident ? 'Likely a job description' :
                   thresholds.moderate ? 'Possibly a job description' :
                   'Not a job description',
  });

  return thresholds;
}

// Example 8: Extracting matched terms
export function example8_ExtractMatchedTerms(text: string) {
  const matchedTerms = {
    actionVerbs: [...universalActionVerbs, ...operationalVerbs].filter(pattern =>
      pattern.test(text)
    ),
    responsibilities: responsibilityExpressions.filter(pattern =>
      pattern.test(text)
    ),
    requirements: requirementTerminology.filter(pattern =>
      pattern.test(text)
    ),
    softSkills: universalSoftSkills.filter(pattern =>
      pattern.test(text)
    ),
    obligations: obligationWords.filter(pattern =>
      pattern.test(text)
    ),
  };

  console.log('Example 8 - Matched Terms:', matchedTerms);
  return matchedTerms;
}

// Example 9: Real-world job posting
export function example9_RealWorldExample() {
  const jobPosting = `
    Senior Software Engineer
    
    About the Role:
    We are looking for a talented Senior Software Engineer to join our growing team.
    In this role, you will be responsible for designing, developing, and maintaining
    scalable web applications using modern technologies.
    
    Responsibilities:
    - Lead development of new features and improvements
    - Collaborate with cross-functional teams including product, design, and QA
    - Review code and provide constructive feedback to team members
    - Ensure high-quality code through testing and documentation
    - Monitor application performance and implement optimizations
    
    Requirements:
    - 5+ years of experience in software development
    - Strong proficiency in JavaScript, TypeScript, and React
    - Experience with Node.js and RESTful APIs
    - Excellent problem solving and communication skills
    - Ability to work in a fast-paced environment
    - Bachelor's degree in Computer Science or related field
    
    Nice to Have:
    - Experience with AWS or other cloud platforms
    - Knowledge of CI/CD pipelines
    - Contributions to open-source projects
  `;

  const result = classifyJobDescription(jobPosting);
  console.log('Example 9 - Real-World Job Posting:', {
    isJobDescription: result.isJobDescription,
    confidence: result.confidence,
    signals: result.signals,
    explanation: result.explanation,
  });

  // Also classify by sections
  const sections = jobPosting.split('\n\n').filter(s => s.trim().length > 50);
  const sectionResults = classifyParagraphs(sections);
  console.log('Section-by-section analysis:', sectionResults);
}

// Example 10: Negative examples (non-job descriptions)
export function example10_NegativeExamples() {
  const nonJobTexts = [
    'Welcome to our blog where we share insights about industry trends and innovations.',
    'Click here to sign up for our newsletter and get exclusive updates delivered to your inbox.',
    'Our company was founded in 2010 with a mission to revolutionize the industry through technology.',
    'Join thousands of professionals who trust our platform for their career development needs.',
  ];

  console.log('Example 10 - Negative Examples (should NOT be job descriptions):');
  nonJobTexts.forEach((text, index) => {
    const result = classifyJobDescription(text);
    console.log(`Text ${index + 1}:`, {
      isJobDescription: result.isJobDescription,
      confidence: result.confidence,
      shouldBeFalse: !result.isJobDescription ? '✅' : '❌',
    });
  });
}

// Run all examples
export function runAllExamples() {
  console.log('=== Job Description Classifier Examples ===\n');
  
  example1_BasicClassification();
  console.log('\n---\n');
  
  example2_CustomValidation('You will manage teams and coordinate projects with stakeholders.');
  console.log('\n---\n');
  
  example3_BatchProcessing();
  console.log('\n---\n');
  
  example4_DocumentClassification();
  console.log('\n---\n');
  
  example5_IndustryExamples();
  console.log('\n---\n');
  
  example6_SemanticFiltering('Responsibilities include operating forklifts and loading trucks.');
  console.log('\n---\n');
  
  example7_ConfidenceThresholds('The ideal candidate will have strong communication skills.');
  console.log('\n---\n');
  
  example8_ExtractMatchedTerms('You will lead, manage, and coordinate cross-functional teams.');
  console.log('\n---\n');
  
  example9_RealWorldExample();
  console.log('\n---\n');
  
  example10_NegativeExamples();
}
