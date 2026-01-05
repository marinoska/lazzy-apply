import type { Field, TokenUsage } from "@lazyapply/types";
import type { EnrichedClassifiedField } from "../llm/classifier.llm.js";
import type { InferenceInput, InferenceResult } from "../llm/inference.llm.js";
import type {
	JdFactsResult,
	JdFormFactsInput,
} from "../llm/JdFactsExtractor.llm.js";

/**
 * Interface for field classification service.
 * Classifies form fields into CV data paths using AI.
 */
export interface FieldClassifier {
	classify(fields: Field[]): Promise<{
		classifiedFields: EnrichedClassifiedField[];
		usage: TokenUsage;
	}>;
}

/**
 * Interface for field inference service.
 * Infers field values from CV and JD context.
 */
export interface FieldInferencer {
	infer(input: InferenceInput): Promise<InferenceResult>;
}

/**
 * Interface for JD-form matching service.
 * Validates whether a job description matches a form.
 */
export interface JdFormFactsExtractor {
	extract(input: JdFormFactsInput): Promise<JdFactsResult>;
}

/**
 * Combined interface for all LLM services used by AutofillManager.
 * Allows for easy mocking in tests.
 */
export interface AutofillLlmServices {
	classifier: FieldClassifier;
	inferencer: FieldInferencer;
	jdExtractor: JdFormFactsExtractor;
}
