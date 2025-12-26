import type {
	AutofillResponseData,
	AutofillResponseItem,
	Field,
	FormInput,
	ParsedCVData,
	TokenUsage,
} from "@lazyapply/types";
import type { Types } from "mongoose";
import { getPresignedDownloadUrl } from "@/app/cloudflare.js";
import { getEnv } from "@/app/env.js";
import { createLogger } from "@/app/logger.js";
import {
	AUTOFILL_MODEL_NAME,
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
import { UsageModel } from "@/domain/usage/index.js";
import type { EnrichedClassifiedField } from "../llm/classifier.llm.js";
import {
	classifyFieldsWithAI,
	extractValueByPath,
	type InferenceField,
	type InferenceResult,
	inferFieldValues,
	isPathInCVData,
	validateJdFormMatch as validateJdFormMatchWithAI,
} from "../llm/index.js";
import { persistAutofill, persistNewFormAndFields } from "../services/index.js";

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
	autofill: Awaited<ReturnType<typeof persistAutofill>>;
	fromCache: boolean;
}

export interface ClassificationManagerDeps {
	/** Form metadata including hash and URL */
	formInput: FormInput;
	/** Array of form fields to be classified */
	fieldsInput: Field[];
	/** ID of the user requesting autofill */
	userId: string;
	/** ID of the selected CV/resume upload */
	selectedUploadId: string;
}

export interface ProcessParams {
	/** Raw text content extracted from the job description */
	jdRawText: string;
	/** URL of the job description page, null if not available */
	jdUrl: string | null;
	/** URL of the form being filled */
	formUrl: string;
	/** Contextual text extracted from the form page */
	formContext: string;
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

	private get cvDataId() {
		if (!this.cvData) {
			throw new Error("CV data not loaded");
		}
		return this.cvData._id;
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

	/**
	 * Main orchestration method for the autofill classification workflow.
	 * Runs classification and JD validation in parallel, then processes inference,
	 * persists data, and builds the final autofill response.
	 */
	public async process(params: ProcessParams) {
		const [classificationResult, jdMatchResult] = await Promise.all([
			this.ensureFormPersisted(),
			this.checkJdFormMatch(params),
		]);

		const inferenceResult = await this.processInference(
			jdMatchResult.isMatch,
			params,
		);

		const response = await this.buildResponseFromFields(
			inferenceResult.answers,
		);

		const autofill = await this.persistAutofillRecord(
			response,
			params.jdRawText,
			params.formContext,
		);
		await this.persistClassificationUsage(
			classificationResult.usage,
			autofill._id,
		);
		await this.persistJdFormMatchUsage(jdMatchResult.usage, autofill._id);
		await this.persistInferenceUsage(inferenceResult.usage, autofill._id);

		return { autofill };
	}

	/**
	 * Classifies fields that are not yet in the database using AI.
	 * Persists form with all fields and returns usage data.
	 */
	private async ensureFormPersisted() {
		let classifiedFields: EnrichedClassifiedField[] = [];
		let usage = createEmptyUsage();

		if (this.existingForm) {
			return { usage: createEmptyUsage() };
		}

		if (this.fieldsToClassify.length) {
			logger.info(
				{ count: this.fieldsToClassify.length },
				"Classifying missing fields",
			);

			const result = await classifyFieldsWithAI(this.fieldsToClassify);
			classifiedFields = result.classifiedFields;
			usage = result.usage;
		}

		const allFields = [...this.existingFields, ...classifiedFields];

		const newForm = await this.persistForm(allFields, classifiedFields);
		this.existingForm = newForm;
		this.existingFields = newForm.fields.map(
			(field: TFormFieldPopulated) => field.fieldRef,
		);
		this.fieldsToClassify = [];

		return { usage };
	}

	/**
	 * Validates whether the job description matches the form.
	 * Skips validation if JD and form URLs are the same or if no JD text is provided.
	 * Returns usage to be persisted later after form is ensured to exist.
	 */
	private async checkJdFormMatch(params: ProcessParams) {
		const { jdRawText, jdUrl, formUrl } = params;
		const sameUrl = jdUrl === formUrl;
		const shouldValidate = jdRawText.length > 0 && !sameUrl;

		if (!shouldValidate) {
			return { isMatch: sameUrl, usage: null };
		}

		logger.info({ jdUrl, formUrl }, "Validating JD match");

		const result = await validateJdFormMatchWithAI({
			jdText: jdRawText,
			formFields: Array.from(this.inputFieldsMap.values()),
			jdUrl,
			formUrl,
		});

		return {
			isMatch: result.isMatch,
			usage: result.usage.totalTokens > 0 ? result.usage : null,
		};
	}

	/**
	 * Processes field inference for fields that require JD/CV context.
	 * Collects fields with inference hints and delegates to inference logic.
	 */
	private async processInference(
		useJDText: boolean,
		params: ProcessParams,
	): Promise<InferenceResult> {
		const inferenceFields = this.collectInferenceFields();

		if (inferenceFields.length === 0) {
			return { answers: {}, usage: createEmptyUsage() };
		}

		return this.inferFields(
			inferenceFields,
			useJDText,
			params.jdRawText,
			params.formContext,
		);
	}

	/**
	 * Ensures the form and its fields are persisted to the database.
	 * Only persists if the form doesn't already exist.
	 */
	private async persistForm(
		allFields: (TFormField | EnrichedClassifiedField)[],
		classifiedFields: EnrichedClassifiedField[],
	) {
		logger.info("Persisting new form and fields");
		const form = await persistNewFormAndFields(
			this.formInput,
			allFields,
			classifiedFields,
		);

		if (!form) {
			throw new Error("Form not found after persistence");
		}

		return form;
	}

	/**
	 * Persists classification usage if it was generated.
	 * Must be called after form is persisted.
	 */
	private async persistClassificationUsage(
		usage: TokenUsage,
		autofillId: Types.ObjectId,
	) {
		if (usage.totalTokens === 0) {
			return;
		}

		if (!this.existingForm) {
			throw new Error(
				"Form must be persisted before saving classification usage",
			);
		}

		await UsageModel.create({
			referenceTable: AUTOFILL_MODEL_NAME,
			reference: autofillId,
			userId: this.userId,
			type: "form_fields_classification",
			promptTokens: usage.promptTokens,
			completionTokens: usage.completionTokens,
			totalTokens: usage.totalTokens,
			inputCost: usage.inputCost ?? 0,
			outputCost: usage.outputCost ?? 0,
			totalCost: usage.totalCost ?? 0,
		});
	}

	/**
	 * Persists inference usage if it was generated.
	 * Must be called after autofill record is persisted.
	 */
	private async persistInferenceUsage(
		usage: TokenUsage | undefined,
		autofillId: Types.ObjectId,
	) {
		if (!usage || usage.totalTokens === 0) {
			return;
		}

		await UsageModel.create({
			referenceTable: AUTOFILL_MODEL_NAME,
			reference: autofillId,
			userId: this.userId,
			type: "form_fields_inference",
			promptTokens: usage.promptTokens,
			completionTokens: usage.completionTokens,
			totalTokens: usage.totalTokens,
			inputCost: usage.inputCost ?? 0,
			outputCost: usage.outputCost ?? 0,
			totalCost: usage.totalCost ?? 0,
		});
	}

	/**
	 * Persists JD match usage if it was generated.
	 * Must be called after ensureFormPersisted.
	 */
	private async persistJdFormMatchUsage(
		usage: TokenUsage | null,
		autofillId: Types.ObjectId,
	) {
		if (!usage) {
			return;
		}

		if (!this.existingForm) {
			throw new Error("Form must be persisted before saving JD match usage");
		}

		await UsageModel.create({
			referenceTable: AUTOFILL_MODEL_NAME,
			reference: autofillId,
			userId: this.userId,
			type: "jd_form_match",
			promptTokens: usage.promptTokens,
			completionTokens: usage.completionTokens,
			totalTokens: usage.totalTokens,
			inputCost: usage.inputCost ?? 0,
			outputCost: usage.outputCost ?? 0,
			totalCost: usage.totalCost ?? 0,
		});
	}

	/**
	 * Persists the autofill record with response data.
	 * Requires the form to be persisted before calling this method.
	 */
	private async persistAutofillRecord(
		response: AutofillResponseData,
		jdRawText: string,
		formContext: string,
	) {
		if (!this.existingForm) {
			throw new Error("Form must be persisted before saving autofill record");
		}

		logger.info("Saving autofill record");

		const fieldHashToIdMap = new Map(
			this.existingForm.fields.map((field) => [field.hash, field.fieldRef._id]),
		);

		return persistAutofill(
			this.existingForm._id,
			this.fileUploadId,
			this.cvDataId,
			this.userId,
			response,
			fieldHashToIdMap,
			jdRawText,
			formContext,
		);
	}

	/**
	 * Infer field values using CV and JD/form context text
	 */
	private async inferFields(
		fields: InferenceField[],
		useJDText: boolean,
		jdRawText: string,
		formContext: string,
	): Promise<InferenceResult> {
		if (!this.cvData?.rawText) {
			logger.error("No CV raw text available for inference");
			return { answers: {}, usage: createEmptyUsage() };
		}

		if (!fields.length) {
			logger.info("No fields to infer, skipping inference");
			return { answers: {}, usage: createEmptyUsage() };
		}

		// Use JD text if it matches, otherwise fall back to form context
		let contextText = "";
		if (useJDText && jdRawText.length) {
			contextText = jdRawText;
		} else if (formContext) {
			contextText = formContext;
			logger.debug("Using form context as fallback for inference");
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

		logger.debug(
			{ answeredCount: Object.keys(result.answers).length },
			"Inference completed",
		);

		return result;
	}

	/**
	 * Builds autofill response from stored fields, enriched with CV data values
	 */
	private async buildResponseFromFields(
		inferredAnswers: Record<string, string> = {},
	): Promise<AutofillResponseData> {
		const response: AutofillResponseData = {};

		if (!this.existingForm) {
			throw new Error(
				"Form must be persisted before building autofill response",
			);
		}
		// Generate file info for resume_upload fields
		const fileInfo = await this.getFileInfo();

		for (const field of this.existingForm.fields) {
			const pathFound = isPathInCVData(field.classification);
			const item: AutofillResponseItem = {
				fieldName: field.fieldRef.field.name,
				label: field.fieldRef.field.label,
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
	private collectInferenceFields(): InferenceField[] {
		const result: InferenceField[] = [];
		if (!this.existingForm) {
			throw new Error(
				"Form must be persisted before collecting inference fields",
			);
		}
		if (!Array.isArray(this.existingForm.fields)) {
			throw new Error("Form fields must be an array");
		}
		for (const field of this.existingForm.fields) {
			if (
				field.classification === "unknown" &&
				"inferenceHint" in field &&
				field.inferenceHint === "text_from_jd_cv"
			) {
				result.push({
					hash: field.fieldRef.hash,
					fieldName: field.fieldRef.field.name,
					label: field.fieldRef.field.label ?? null,
					description: field.fieldRef.field.description ?? null,
					placeholder: field.fieldRef.field.placeholder ?? null,
					tag: field.fieldRef.field.tag ?? null,
					type: field.fieldRef.field.type ?? null,
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
