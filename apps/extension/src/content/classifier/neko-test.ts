import { classifyJobDescription } from './jobDescriptionClassifier';

const nekoText = `Neko Health is a Swedish healthcare technology company co-founded in 2018 by Hjalmar Nilsonne and Daniel Ek. Neko's vision is to shift healthcare from reactive treatment toward preventative health and early detection. This requires completely reimagining the patient's experience and incorporating the latest advances in sensors and AI. Neko Health has developed a new medical scanning technology concept to make it possible to do broad and non-invasive health data collection that is convenient and affordable for the public. The company is based in Stockholm, offering the Neko Body Scan experience at locations in Stockholm, London and Manchester, with over 500 employees.`;

const result = classifyJobDescription(nekoText);

console.log('Neko Health Text Classification:');
console.log('Is Job Description:', result.isJobDescription);
console.log('Confidence:', result.confidence);
console.log('Signals:', result.signals);
console.log('Explanation:', result.explanation);
console.log('\nText length:', nekoText.length);
