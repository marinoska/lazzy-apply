import type { Field } from "@lazyapply/types";
import { classifyFieldsWithAI } from "../llm/classifier.llm.js";
import {
	type InferenceInput,
	type InferenceResult,
	inferFieldValues,
} from "../llm/inference.llm.js";
import {
	extractJdFormFactsWithAI,
	type JdFactsResult,
	type JdFormFactsInput,
} from "../llm/JdFactsExtractor.llm.js";
import type {
	AutofillLlmServices,
	FieldClassifier,
	FieldInferencer,
	JdFormFactsExtractor,
} from "./autofill.manager.types.js";

/**
 * Real implementation of FieldClassifier using OpenAI.
 */
class RealFieldClassifier implements FieldClassifier {
	async classify(fields: Field[]) {
		return classifyFieldsWithAI(fields);
	}
}

/**
 * Real implementation of FieldInferencer using OpenAI.
 */
class RealFieldInferencer implements FieldInferencer {
	async infer(input: InferenceInput): Promise<InferenceResult> {
		return inferFieldValues(input);
	}
}

/**
 * Real implementation of JdFormFactsExtractor using OpenAI.
 */
class RealJdFormFactsExtractor implements JdFormFactsExtractor {
	async extract(input: JdFormFactsInput): Promise<JdFactsResult> {
		return extractJdFormFactsWithAI(input);
	}
}

/**
 * Creates the default LLM services using real OpenAI implementations.
 */
export function createDefaultLlmServices(): AutofillLlmServices {
	return {
		classifier: new RealFieldClassifier(),
		inferencer: new RealFieldInferencer(),
		jdExtractor: new RealJdFormFactsExtractor(),
	};
}
