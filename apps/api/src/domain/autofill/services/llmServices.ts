import type { Field } from "@lazyapply/types";
import { classifyFieldsWithAI } from "../llm/classifier.llm.js";
import {
	type InferenceInput,
	type InferenceResult,
	inferFieldValues,
} from "../llm/inference.llm.js";
import {
	type JdMatchInput,
	type JdMatchResult,
	validateJdFormMatchWithAI,
} from "../llm/jdMatcher.llm.js";
import type {
	AutofillLlmServices,
	FieldClassifier,
	FieldInferencer,
	JdFormMatcher,
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
 * Real implementation of JdFormMatcher using OpenAI.
 */
class RealJdFormMatcher implements JdFormMatcher {
	async match(input: JdMatchInput): Promise<JdMatchResult> {
		return validateJdFormMatchWithAI(input);
	}
}

/**
 * Creates the default LLM services using real OpenAI implementations.
 */
export function createDefaultLlmServices(): AutofillLlmServices {
	return {
		classifier: new RealFieldClassifier(),
		inferencer: new RealFieldInferencer(),
		jdMatcher: new RealJdFormMatcher(),
	};
}
