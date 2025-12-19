import type {
	AutofillResponse,
	AutofillResponseData,
	AutofillResponseItem,
	Field,
	FormContextBlock,
	FormInput,
	ParsedCVData,
	TokenUsage,
} from "@lazyapply/types";
import { getPresignedDownloadUrl } from "@/app/cloudflare.js";
import { getEnv } from "@/app/env.js";
import { createLogger } from "@/app/logger.js";
import {
	FormFieldModel,
	FormModel,
	type TFormField,
} from "@/domain/autofill/index.js";
import type {
	FormDocumentPopulated,
	TFormFieldPopulated,
} from "@/domain/autofill/model/formField.types.js";
import { CVDataModel } from "@/domain/uploads/model/cvData.model.js";
import { FileUploadModel } from "@/domain/uploads/model/fileUpload.model.js";
import type { TFileUpload } from "@/domain/uploads/model/fileUpload.types.js";
import type { EnrichedClassifiedField } from "../services/classifier.service.js";
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
} from "../services/index.js";

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

export interface AutofillResult {
	response: AutofillResponse;
	fromCache: boolean;
	autofillId: string;
}

export interface ClassificationManagerDeps {
	formInput: FormInput;
	fieldsInput: Field[];
	userId: string;
	selectedUploadId: string;
}

export interface ProcessParams {
	jdRawText: string;
	jdUrl: string | null;
	formUrl: string;
	formContext: FormContextBlock[];
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
	private existingForm?: FormDocumentPopulated;
	private cvData: ParsedCVData | null = null;
	private cvUpload: TFileUpload | null = null;

	private existingFields: TFormField[] = [];
	private fieldsToClassify: Field[] = [];

	private constructor(
		private readonly userId: string,
		private readonly formInput: FormInput,
		private inputFieldsMap: Map<string, Field>,
	) {}

	private get fileUploadId() {
		if (!this.cvUpload) {
			throw new Error("File upload not found for selected upload ID");
		}
		return this.cvUpload._id;
	}

	static async create(deps: ClassificationManagerDeps) {
		const inputFieldsMap = new Map(
			deps.fieldsInput.map((field) => [field.hash, field]),
		);

		const newInstance = new ClassificationManager(
			deps.userId,
			deps.formInput,
			inputFieldsMap,
		);

		await Promise.all([
			newInstance.loadForm(deps.formInput),
			newInstance.loadCVData(deps.selectedUploadId),
		]);

		// Load fields - always needed for building response
		if (newInstance.existingForm) {
			// Form exists - use populated fields.fieldRef from FormFieldModel
			newInstance.existingFields = newInstance.existingForm.fields.map(
				(field: TFormFieldPopulated) => field.fieldRef,
			);
		} else {
			logger.info("Form not found, looking up fields by hash");
			await newInstance.loadFields();
		}

		return newInstance;
	}
	/**
	 * Load CV data and file upload info from the provided selectedUploadId
	 */
	private async loadCVData(selectedUploadId: string) {
		const [cvData, fileUpload] = await Promise.all([
			CVDataModel.findByUploadId(selectedUploadId, this.userId),
			FileUploadModel.findOne({ _id: selectedUploadId }).setOptions({
				userId: this.userId,
			}),
		]);

		if (!cvData || !fileUpload) {
			logger.error(
				{ uploadId: selectedUploadId },
				!cvData
					? "CV data not found for selected upload"
					: "Upload not found for selected upload id",
			);
			throw new Error("CV data not found for selected upload");
		}

		this.cvData = cvData.toObject();
		this.cvUpload = fileUpload.toObject();
		logger.debug({ uploadId: selectedUploadId }, "CV data loaded");
	}

	private async loadForm(formInput: FormInput) {
		// Step 1: Check if form exists
		const existingForm = await FormModel.findByHash(formInput.formHash, {
			populate: true,
		});

		if (existingForm) {
			if (!existingForm.pageUrls.includes(formInput.pageUrl)) {
				// the same form found on different urls (maybe used for different roles)
				existingForm.pageUrls.push(formInput.pageUrl);
			}
			if (
				formInput.action &&
				!existingForm.actions.includes(formInput.action)
			) {
				existingForm.actions.push(formInput.action);
			}
			if (existingForm.isModified(["pageUrls", "actions"])) {
				await existingForm.save();
			}

			this.existingForm = existingForm.toObject();
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

	public async process({
		jdRawText,
		jdUrl,
		formUrl,
		formContext,
	}: ProcessParams) {
		// Generate file info for resume_upload fields
		const fileInfo = await this.getFileInfo();

		// Determine if we need to classify new fields or validate JD match
		const needsClassification = this.fieldsToClassify.length;
		const hasJdText = jdRawText.length;
		const sameUrl = jdUrl === formUrl;
		const shouldValidateJdMatch = hasJdText && !sameUrl;

		if (needsClassification) {
			logger.info(
				{ count: this.fieldsToClassify.length },
				"Classifying missing fields",
			);
		}

		if (shouldValidateJdMatch) {
			logger.info({ jdUrl, formUrl: formUrl }, "Validating JD match");
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
						jdText: jdRawText,
						formFields: Array.from(this.inputFieldsMap.values()),
						jdUrl,
						formUrl,
					})
				: Promise.resolve({ isMatch: sameUrl, usage: createEmptyUsage() }),
		]);
		// TODO !!!!!!!
		const { classifiedFields, usage: classificationUsage } =
			classificationResult;

		// Build response from appropriate fields source
		const allFields = [...this.existingFields, ...classifiedFields];

		// Handle inference for fields with inferenceHint
		let inferenceUsage: TokenUsage | undefined;
		let inferredAnswers: Record<string, string> = {};
		const inferenceFields = this.collectInferenceFields(allFields);
		if (inferenceFields.length) {
			const inferenceResult = await this.inferFields(
				inferenceFields,
				jdMatchResult.isMatch,
				jdRawText,
				formContext,
			);
			inferredAnswers = inferenceResult.answers;
			inferenceUsage = inferenceResult.usage;
		}

		// Build final response with all data including inferred answers
		const response = this.buildResponseFromFields(
			allFields,
			fileInfo,
			inferredAnswers,
		);

		// Persist based on whether form already exists
		let autofillId: string;
		if (this.existingForm) {
			logger.info("Form found in DB, saving autofill record");
			autofillId = await persistCachedAutofill(
				this.existingForm._id,
				this.fileUploadId,
				this.userId,
				response,
			);
		} else {
			logger.info("Persisting new form and fields");
			autofillId = await persistNewFormAndFields(
				this.formInput,
				allFields,
				classifiedFields,
				this.userId,
				this.fileUploadId,
				response,
				classificationUsage,
				inferenceUsage,
				shouldValidateJdMatch ? jdMatchResult.usage : undefined,
			);
		}

		const fromCache = !!this.existingForm || !needsClassification;

		return {
			response: {
				autofillId,
				fields: response,
				fromCache,
			},
			fromCache,
			autofillId,
		};
	}

	/**
	 * Infer field values using CV and JD/form context text
	 */
	private async inferFields(
		fields: InferenceField[],
		jdMatches: boolean,
		jdRawText: string,
		formContext: FormContextBlock[],
	): Promise<InferenceResult> {
		if (!this.cvData?.rawText) {
			logger.error("No CV raw text available for inference");
			return { answers: {}, usage: createEmptyUsage() };
		}

		logger.info(
			{ fieldCount: fields.length, jdMatches },
			"Processing inference fields",
		);

		// Use JD text if it matches, otherwise fall back to form context
		let contextText = "";
		if (jdMatches && jdRawText.length) {
			contextText = jdRawText;
		} else if (formContext.length) {
			contextText = formContext.map((block) => block.text).join("\n");
			logger.info("Using form context as fallback for inference");
		}

		logger.debug(
			{ cvRawText: this.cvData.rawText, contextText, fields },
			"Inference input",
		);
		const result = await inferFieldValues({
			cvRawText: this.cvData.rawText,
			jdRawText: contextText,
			fields,
		});

		logger.info(
			{ answeredCount: Object.keys(result.answers).length },
			"Inference completed",
		);

		return result;
	}

	/**
	 * Builds autofill response from stored fields, enriched with CV data values
	 */
	private buildResponseFromFields(
		fields: (TFormField | EnrichedClassifiedField)[],
		fileInfo: FileInfo | null,
		inferredAnswers: Record<string, string> = {},
	): AutofillResponseData {
		const response: AutofillResponseData = {};

		for (const field of fields) {
			const pathFound = isPathInCVData(field.classification);
			const item: AutofillResponseItem = {
				fieldName: field.field.name,
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
			if (isPathInCVData(field.classification) && this.cvData) {
				item.value = extractValueByPath(
					this.cvData,
					field.classification,
					field.linkType,
				);
			}

			// Apply inferred answer if available
			if (inferredAnswers[field.hash]) {
				item.value = inferredAnswers[field.hash];
				item.pathFound = true;
			}

			// Add file info for resume_upload fields
			if (field.classification === "resume_upload" && fileInfo) {
				item.fileUrl = fileInfo.fileUrl;
				item.fileName = fileInfo.fileName;
				item.fileContentType = fileInfo.fileContentType;
				item.pathFound = true;
			}

			response[field.hash] = item;
		}

		return response;
	}

	/**
	 * Collects fields that require inference from classified fields
	 */
	private collectInferenceFields(
		fields: (TFormField | EnrichedClassifiedField)[],
	): InferenceField[] {
		const result: InferenceField[] = [];

		for (const field of fields) {
			if (
				field.classification === "unknown" &&
				"inferenceHint" in field &&
				field.inferenceHint === "text_from_jd_cv"
			) {
				result.push({
					hash: field.hash,
					fieldName: field.field.name,
					label: field.field.label ?? null,
					description: field.field.description ?? null,
					placeholder: field.field.placeholder ?? null,
					tag: field.field.tag ?? null,
					type: field.field.type ?? null,
				});
			}
		}

		return result;
	}

	/**
	 * Generate presigned URL and file info for resume uploads
	 */
	private async getFileInfo(): Promise<FileInfo | null> {
		if (!this.cvUpload) {
			logger.warn(
				{ uploadId: this.fileUploadId },
				"File upload not found for presigned URL generation",
			);
			return null;
		}

		try {
			const bucket = getEnv("CLOUDFLARE_BUCKET");
			const fileUrl = await getPresignedDownloadUrl(
				bucket,
				this.cvUpload.objectKey,
			);

			return {
				fileUrl,
				fileName: this.cvUpload.originalFilename,
				fileContentType: this.cvUpload.contentType,
			};
		} catch (error) {
			logger.error(
				{ uploadId: this.fileUploadId, error },
				"Failed to generate presigned URL",
			);
			return null;
		}
	}
}
