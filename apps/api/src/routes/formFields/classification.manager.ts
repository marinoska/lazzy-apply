import type {
	AutofillResponse,
	AutofillResponseItem,
	Field,
	FormFieldRef,
	FormInput,
	ParsedCVData,
	TokenUsage,
} from "@lazyapply/types";
import { getPresignedDownloadUrl } from "@/app/cloudflare.js";
import { getEnv } from "@/app/env.js";
import { createLogger } from "@/app/logger.js";
import { CVDataModel } from "@/cvData/index.js";
import type { TFormFieldRefPopulated } from "@/formFields/formField.types.js";
import {
	FormFieldModel,
	FormModel,
	type FormWithPopulatedFields,
	type TFormField,
} from "@/formFields/index.js";
import { FileUploadModel } from "@/uploads/fileUpload.model.js";
import type { TFileUpload } from "@/uploads/fileUpload.types.js";
import type { EnrichedClassifiedField } from "./services/classifier.service.js";
import {
	classifyFieldsWithAI,
	extractValueByPath,
	type InferenceField,
	type InferenceResult,
	inferFieldValues,
	isPathInCVData,
	persistCachedAutofill,
	persistNewFormAndFields,
	validateJdFormMatch,
} from "./services/index.js";

const logger = createLogger("classification.manager");

type FileInfo = {
	fileUrl: string;
	fileName: string;
	fileContentType: string;
};

function createEmptyUsage(): TokenUsage {
	return {
		promptTokens: 0,
		completionTokens: 0,
		totalTokens: 0,
		inputCost: 0,
		outputCost: 0,
		totalCost: 0,
	};
}

/**
 * Collects fields that require inference from the autofill response
 */
function collectInferenceFields(response: AutofillResponse): InferenceField[] {
	const fields: InferenceField[] = [];

	for (const [hash, item] of Object.entries(response)) {
		if (item.path === "unknown" && item.inferenceHint === "text_from_jd_cv") {
			fields.push({
				hash,
				fieldName: item.fieldName,
			});
		}
	}

	return fields;
}

/**
 * Applies inferred answers to the autofill response
 */
function applyInferredAnswers(
	response: AutofillResponse,
	answers: Record<string, string>,
): void {
	for (const [hash, value] of Object.entries(answers)) {
		if (response[hash]) {
			response[hash].value = value;
			response[hash].pathFound = true;
		}
	}
}

/**
 * Builds autofill response from stored fields, enriched with CV data values
 */
function buildResponseFromFields(
	fields: (TFormField | FormFieldRef)[],
	inputFields: Field[],
	cvData: ParsedCVData | null,
	fileInfo: FileInfo | null,
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

			// Include inferenceHint for fields that can be answered via JD + CV
			if ("inferenceHint" in field && field.inferenceHint) {
				item.inferenceHint = field.inferenceHint;
			}

			// Extract value from CV data if path exists in CV structure
			if (isPathInCVData(field.classification) && cvData) {
				item.value = extractValueByPath(
					cvData,
					field.classification,
					field.linkType,
				);
			}

			// Add file info for resume_upload fields
			if (field.classification === "resume_upload" && fileInfo) {
				item.fileUrl = fileInfo.fileUrl;
				item.fileName = fileInfo.fileName;
				item.fileContentType = fileInfo.fileContentType;
				item.pathFound = true;
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
	private existingForm?: FormWithPopulatedFields;
	private inputFieldsMap: Map<string, Field>;
	private existingFields: TFormField[] = [];
	private fieldsToClassify: Field[] = [];
	private cvData: ParsedCVData | null = null;
	private fileUpload: TFileUpload | null = null;

	constructor(
		readonly formInput: FormInput,
		private readonly inputFields: Field[],
		private readonly userId: string,
		private readonly selectedUploadId: string,
		private readonly jdRawText: string,
		private readonly jdUrl: string | null,
	) {
		this.inputFieldsMap = new Map(inputFields.map((f) => [f.hash, f]));
	}

	/**
	 * Load CV data and file upload info from the provided selectedUploadId
	 */
	private async loadCVData() {
		const [cvData, fileUpload] = await Promise.all([
			CVDataModel.findByUploadId(this.selectedUploadId, this.userId),
			FileUploadModel.findOne({ _id: this.selectedUploadId }).setOptions({
				userId: this.userId,
			}),
		]);

		if (!cvData) {
			logger.error(
				{ uploadId: this.selectedUploadId },
				"CV data not found for selected upload",
			);
			throw new Error("CV data not found for selected upload");
		}

		this.cvData = cvData.toObject();
		this.fileUpload = fileUpload;
		logger.info({ uploadId: this.selectedUploadId }, "CV data loaded");
	}

	private async loadForm() {
		// Step 1: Check if form exists
		const existingForm = await FormModel.findByHash(this.formInput.formHash, {
			populate: true,
		});

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

		// Generate file info for resume_upload fields
		const fileInfo = await this.getFileInfo();

		// Load fields - always needed for building response
		if (this.existingForm) {
			// Form exists - use populated fields.fieldRef from FormFieldModel
			this.existingFields = this.existingForm.fields.map(
				(field: TFormFieldRefPopulated) => field.fieldRef,
			);
		} else {
			logger.info("Form not found, looking up fields by hash");
			await this.loadFields();
		}

		// Determine if we need to classify new fields or validate JD match
		const needsClassification = this.fieldsToClassify.length > 0;
		const hasJdText = this.jdRawText.length > 0;
		const sameUrl = this.jdUrl === this.formInput.pageUrl;
		const shouldValidateJdMatch = hasJdText && !sameUrl;

		if (needsClassification) {
			logger.info(
				{ count: this.fieldsToClassify.length },
				"Classifying missing fields",
			);
		}

		if (shouldValidateJdMatch) {
			logger.info(
				{ jdUrl: this.jdUrl, formUrl: this.formInput.pageUrl },
				"Validating JD match",
			);
		}
		// Run classification and JD match in parallel (using ternaries to skip when not needed)
		const [classificationResult, jdMatchResult] = await Promise.all([
			needsClassification
				? classifyFieldsWithAI(this.fieldsToClassify)
				: Promise.resolve({
						classifiedFields: [] as EnrichedClassifiedField[],
						usage: createEmptyUsage(),
					}),
			shouldValidateJdMatch
				? validateJdFormMatch({
						jdText: this.jdRawText,
						formFields: this.inputFields,
						jdUrl: this.jdUrl,
						formUrl: this.formInput.pageUrl,
					})
				: Promise.resolve({ isMatch: sameUrl, usage: createEmptyUsage() }),
		]);

		const { classifiedFields, usage: classificationUsage } =
			classificationResult;

		// Build response from appropriate fields source
		const allFields = [...this.existingFields, ...classifiedFields];

		const response = buildResponseFromFields(
			allFields,
			Array.from(this.inputFieldsMap.values()),
			this.cvData,
			fileInfo,
		);

		// Handle inference for fields with inferenceHint
		let inferenceUsage: TokenUsage | undefined;
		const inferenceFields = collectInferenceFields(response);
		if (inferenceFields.length > 0) {
			const inferenceResult = await this.inferFields(
				inferenceFields,
				jdMatchResult.isMatch,
			);
			applyInferredAnswers(response, inferenceResult.answers);
			inferenceUsage = inferenceResult.usage;
		}

		// Persist based on whether form already exists
		if (this.existingForm) {
			logger.info("Form found in DB, saving autofill record");
			await persistCachedAutofill(
				this.existingForm._id,
				this.selectedUploadId,
				this.userId,
				response,
			);
		} else {
			logger.info("Persisting new form and fields");
			await persistNewFormAndFields(
				this.formInput,
				[...this.existingFields, ...classifiedFields],
				classifiedFields,
				this.userId,
				this.selectedUploadId,
				response,
				classificationUsage,
				inferenceUsage,
				shouldValidateJdMatch ? jdMatchResult.usage : undefined,
			);
		}

		return {
			response,
			fromCache: !!this.existingForm || !needsClassification,
		};
	}

	/**
	 * Infer field values using CV and JD text
	 */
	private async inferFields(
		fields: InferenceField[],
		jdMatches: boolean,
	): Promise<InferenceResult> {
		if (!this.cvData?.rawText) {
			logger.error("No CV raw text available for inference");
			return { answers: {}, usage: createEmptyUsage() };
		}

		logger.info(
			{ fieldCount: fields.length, jdMatches },
			"Processing inference fields",
		);

		// Only provide JD text if it matches the form
		const jdRawText = jdMatches ? this.jdRawText : "";
		logger.debug(
			{ cvRawText: this.cvData.rawText, jdRawText, fields },
			"Inference input",
		);
		const result = await inferFieldValues({
			cvRawText: this.cvData.rawText,
			jdRawText,
			fields,
		});

		logger.info(
			{ answeredCount: Object.keys(result.answers).length },
			"Inference completed",
		);

		return result;
	}

	/**
	 * Generate presigned URL and file info for resume uploads
	 */
	private async getFileInfo(): Promise<FileInfo | null> {
		if (!this.fileUpload) {
			logger.warn(
				{ uploadId: this.selectedUploadId },
				"File upload not found for presigned URL generation",
			);
			return null;
		}

		try {
			const bucket = getEnv("CLOUDFLARE_BUCKET");
			const fileUrl = await getPresignedDownloadUrl(
				bucket,
				this.fileUpload.objectKey,
			);

			return {
				fileUrl,
				fileName: this.fileUpload.originalFilename,
				fileContentType: this.fileUpload.contentType,
			};
		} catch (error) {
			logger.error(
				{ uploadId: this.selectedUploadId, error },
				"Failed to generate presigned URL",
			);
			return null;
		}
	}
}
