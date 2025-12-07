import type {
	AutofillResponse,
	AutofillResponseItem,
	Field,
	FormFieldRef,
	FormInput,
	ParsedCVData,
} from "@lazyapply/types";
import { createLogger } from "@/app/logger.js";
import { CVDataModel } from "@/cvData/index.js";
import {
	FormFieldModel,
	FormModel,
	type TForm,
	type TFormField,
} from "@/formFields/index.js";
import {
	classifyFieldsWithAI,
	extractValueByPath,
	isPathInCVData,
	persistNewFormAndFields,
} from "./services/index.js";

const logger = createLogger("classification.manager");

/**
 * Builds autofill response from stored fields, enriched with CV data values
 */
function buildResponseFromFields(
	fields: (TFormField | FormFieldRef)[],
	inputFields: Field[],
	cvData: ParsedCVData | null,
): AutofillResponse {
	const fieldsMap = new Map(fields.map((f) => [f.hash, f]));
	const response: AutofillResponse = {};

	for (const inputField of inputFields) {
		const field = fieldsMap.get(inputField.hash);
		if (field) {
			const pathFound = isPathInCVData(field.classification);
			const item: AutofillResponseItem = {
				fieldName: inputField.field.name,
				path: field.classification,
				pathFound,
			};

			if (field.linkType) {
				item.linkType = field.linkType;
			}

			// Extract value from CV data if path exists in CV structure
			if (isPathInCVData(field.classification) && cvData) {
				item.value = extractValueByPath(
					cvData,
					field.classification,
					field.linkType,
				);
			}

			response[inputField.hash] = item;
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
	private cvData: ParsedCVData | null = null;

	constructor(
		readonly formInput: FormInput,
		inputFields: Field[],
		private readonly userId: string,
		private readonly selectedUploadId: string,
	) {
		this.inputFieldsMap = new Map(inputFields.map((f) => [f.hash, f]));
	}

	/**
	 * Load CV data from the provided selectedUploadId
	 */
	private async loadCVData() {
		const cvData = await CVDataModel.findByUploadId(
			this.selectedUploadId,
			this.userId,
		);
		if (!cvData) {
			logger.error(
				{ uploadId: this.selectedUploadId },
				"CV data not found for selected upload",
			);
			throw new Error("CV data not found for selected upload");
		}

		this.cvData = cvData.toObject();
		logger.info({ uploadId: this.selectedUploadId }, "CV data loaded");
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
		// Load CV data in parallel with form lookup
		await Promise.all([this.loadForm(), this.loadCVData()]);

		if (this.existingForm) {
			logger.info("Form found in DB, returning cached data");

			return {
				response: buildResponseFromFields(
					this.existingForm.fields,
					Array.from(this.inputFieldsMap.values()),
					this.cvData,
				),
				fromCache: true,
			};
		}

		// Step 2: No form found - look up fields by hash
		logger.info("Form not found, looking up fields by hash");

		await this.loadFields();

		if (!this.fieldsToClassify.length) {
			logger.info("All fields found in cache");
			return {
				response: buildResponseFromFields(
					this.existingFields,
					Array.from(this.inputFieldsMap.values()),
					this.cvData,
				),
				fromCache: true,
			};
		}

		// Step 3: Classify only missing fields
		logger.info(
			{ count: this.fieldsToClassify.length },
			"Classifying missing fields",
		);

		const { classifiedFields, usage } = await classifyFieldsWithAI(
			this.fieldsToClassify,
		);

		const result = buildResponseFromFields(
			[...this.existingFields, ...classifiedFields],
			Array.from(this.inputFieldsMap.values()),
			this.cvData,
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
