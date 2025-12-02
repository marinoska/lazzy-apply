import type {
	AutofillResponse,
	Field,
	FormFieldRef,
	FormInput,
} from "@lazyapply/types";
import { createLogger } from "@/app/logger.js";
import {
	FormFieldModel,
	FormModel,
	type TForm,
	type TFormField,
} from "@/formFields/index.js";

import {
	classifyFieldsWithAI,
	persistNewFormAndFields,
} from "./services/index.js";

const logger = createLogger("classification.manager");

/**
 * Builds autofill response from stored fields
 */
function buildResponseFromFields(
	fields: (TFormField | FormFieldRef)[],
	inputFields: Field[],
): AutofillResponse {
	const fieldsMap = new Map(fields.map((f) => [f.hash, f]));
	const response: AutofillResponse = {};

	for (const inputField of inputFields) {
		const field = fieldsMap.get(inputField.hash);
		if (field) {
			response[inputField.hash] = {
				fieldId: inputField.field.id,
				fieldName: inputField.field.name,
				path: field.classification,
				...(field.linkType && { linkType: field.linkType }),
			};
		} else {
			logger.error({ hash: inputField.hash }, "Field hash not found");
		}
	}

	return response;
}

export interface AutofillResult {
	response: AutofillResponse;
	fromCache: boolean;
}

/**
 * Main orchestration function for autofill classification
 *
 * Flow:
 * 1. Check if form exists in DB → return cached data (update URLs if needed)
 * 2. If no form, look up fields by hash → classify only missing ones
 * 3. Merge cached + newly classified fields
 * 4. Persist new data
 */
export class ClassificationManager {
	private existingForm?: TForm;
	private inputFieldsMap: Map<string, Field>;
	private existingFields: TFormField[] = [];
	private fieldsToClassify: Field[] = [];

	constructor(
		readonly formInput: FormInput,
		inputFields: Field[],
	) {
		this.inputFieldsMap = new Map(inputFields.map((f) => [f.hash, f]));
	}

	private async loadForm() {
		// Step 1: Check if form exists
		const existingForm = await FormModel.findByHash(this.formInput.formHash);

		if (existingForm) {
			if (!existingForm.pageUrls.includes(this.formInput.pageUrl)) {
				existingForm.pageUrls.push(this.formInput.pageUrl);
			}
			if (
				this.formInput.action &&
				!existingForm.actions.includes(this.formInput.action)
			) {
				existingForm.actions.push(this.formInput.action);
			}
			if (existingForm.isModified(["pageUrls", "actions"])) {
				await existingForm.save();
			}

			this.existingForm = existingForm;
		}
	}

	private async loadFields() {
		const hashes = Array.from(this.inputFieldsMap.keys());
		this.existingFields = await FormFieldModel.findByHashes(hashes);

		const existingFieldHashes = this.existingFields.map((f) => f.hash);

		const missingHashes = hashes.filter(
			(hash) => !existingFieldHashes.includes(hash),
		);

		for (const hash of missingHashes) {
			const field = this.inputFieldsMap.get(hash);
			if (field) {
				this.fieldsToClassify.push(field);
			}
		}
	}

	public async process() {
		await this.loadForm();
		if (this.existingForm) {
			logger.info("Form found in DB, returning cached data");

			return {
				response: buildResponseFromFields(
					this.existingForm.fields,
					Array.from(this.inputFieldsMap.values()),
				),
				fromCache: true,
			};
		}

		// Step 2: No form found - look up fields by hash
		logger.debug("Form not found, looking up fields by hash");

		await this.loadFields();

		if (!this.fieldsToClassify.length) {
			logger.info("All fields found in cache");
			return {
				response: buildResponseFromFields(
					this.existingFields,
					Array.from(this.inputFieldsMap.values()),
				),
				fromCache: true,
			};
		}

		// Step 3: Classify only missing fields
		logger.debug(
			{ count: this.fieldsToClassify.length },
			"Classifying missing fields",
		);

		const { classifiedFields, usage } = await classifyFieldsWithAI(
			this.fieldsToClassify,
		);

		const result = buildResponseFromFields(
			[...this.existingFields, ...classifiedFields],
			Array.from(this.inputFieldsMap.values()),
		);

		// Persist form with all field refs, but only insert newly classified fields
		await persistNewFormAndFields(
			this.formInput,
			[...this.existingFields, ...classifiedFields],
			classifiedFields,
			usage,
		);

		return {
			response: result,
			fromCache: false,
			usage,
		};
	}
}
