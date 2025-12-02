import { FormFieldModel, type TFormField } from "@/formFields/index.js";

export interface FieldLookupResult {
	found: Map<string, TFormField>;
	missing: string[];
}

/**
 * Looks up fields by their hashes using model static method
 * Returns found fields and list of missing hashes
 */
export async function findFieldsByHashes(fieldHashes: string[]): Promise<FieldLookupResult> {
	const fields = await FormFieldModel.findByHashes(fieldHashes);

	const found = new Map<string, TFormField>();
	for (const field of fields) {
		found.set(field.fieldHash, field);
	}

	const missing = fieldHashes.filter((hash) => !found.has(hash));

	return { found, missing };
}
