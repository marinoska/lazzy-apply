import { randomUUID } from "node:crypto";
import type {
	Field,
	FormFieldPath,
	FormInput,
	InferenceHint,
	ParsedCVData,
	TokenUsage,
} from "@lazyapply/types";
import type { Types } from "mongoose";
import mongoose from "mongoose";
import { getPresignedDownloadUrl } from "@/app/cloudflare.js";
import { getEnv } from "@/app/env.js";
import { createLogger } from "@/app/logger.js";
import { CVDataModel } from "@/domain/uploads/model/cvData.model.js";
import { FileUploadModel } from "@/domain/uploads/model/fileUpload.model.js";
import type { TFileUpload } from "@/domain/uploads/model/fileUpload.types.js";
import {
	type AutofillDataItem,
	type AutofillDataItemFile,
	type AutofillDataItemText,
	type AutofillDocument,
	AutofillModel,
} from "../index.js";
import {
	extractValueByPath,
	type InferenceField,
	type InferenceResult,
	inferFieldValues,
	isPathInCVData,
	validateJdFormMatchWithAI,
} from "../llm/index.js";
import { Form } from "./Form.js";
import { Autofill } from "./index.js";

const logger = createLogger("classification.manager");

async function buildAutofillData(params: {
	fields: Array<{
		hash: string;
		fieldRef: {
			field: {
				name: string | null;
				label: string | null;
			};
			_id: Types.ObjectId;
		};
		classification: FormFieldPath;
		linkType?: string;
		inferenceHint?: InferenceHint;
	}>;
	fieldHashToIdMap: Map<string, Types.ObjectId>;
	inferredAnswers: Record<string, string>;
	cvData: ParsedCVData | null;
	fileInfo: FileInfo | null;
}): Promise<AutofillDataItem[]> {
	const data: AutofillDataItem[] = [];

	for (const field of params.fields) {
		const fieldRef = params.fieldHashToIdMap.get(field.hash);
		if (!fieldRef) {
			continue;
		}

		const pathFound = isPathInCVData(field.classification);
		let value: string | null = null;
		let actualPathFound = pathFound;

		if (isPathInCVData(field.classification) && params.cvData) {
			value = extractValueByPath(
				params.cvData,
				field.classification,
				field.linkType,
			);
		}

		if (params.inferredAnswers[field.hash]) {
			value = params.inferredAnswers[field.hash];
			actualPathFound = true;
		}

		if (field.classification === "resume_upload" && params.fileInfo) {
			const fileItem: AutofillDataItemFile = {
				hash: field.hash,
				fieldRef,
				fieldName: field.fieldRef.field.name ?? "",
				label: field.fieldRef.field.label ?? "",
				path: field.classification,
				pathFound: actualPathFound,
				fileUrl: params.fileInfo.fileUrl,
				fileName: params.fileInfo.fileName,
				fileContentType: params.fileInfo.fileContentType,
			};
			data.push(fileItem);
			continue;
		}

		const textItem: AutofillDataItemText = {
			hash: field.hash,
			fieldRef,
			fieldName: field.fieldRef.field.name ?? "",
			label: field.fieldRef.field.label ?? "",
			path: field.classification,
			pathFound: actualPathFound,
			...(field.linkType && { linkType: field.linkType }),
			...(field.inferenceHint && { inferenceHint: field.inferenceHint }),
			value,
		};
		data.push(textItem);
	}

	return data;
}

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
	autofill: AutofillDocument;
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
	private mForm: Form;
	private cvData: ParsedCVData | null = null;
	private cvUpload: TFileUpload | null = null;
	private autofill: Autofill;

	private constructor(
		private readonly userId: string,
		formInput: FormInput,
		inputFieldsMap: Map<string, Field>,
	) {
		this.mForm = new Form(formInput, inputFieldsMap);
		this.autofill = new Autofill(userId);
	}

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
			newInstance.mForm.init(),
			newInstance.loadCVData(deps.selectedUploadId),
		]);

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

	/**
	 * Main orchestration method for the autofill classification workflow.
	 * Runs classification and JD validation in parallel, then processes inference,
	 * persists data, and builds the final autofill response.
	 */
	public async process(params: ProcessParams) {
		const [classificationResult, jdMatchResult] = await Promise.all([
			this.mForm.ensureFormPersisted(),
			this.checkJdFormMatch(params),
		]);

		const inferenceResult = await this.processInference(
			jdMatchResult.isMatch,
			params,
		);

		this.autofill.setClassificationUsage(classificationResult.usage);
		this.autofill.setJdFormMatchUsage(jdMatchResult.usage);
		this.autofill.setInferenceUsage(inferenceResult.usage);

		const fileInfo = await this.getFileInfo();
		const data = await buildAutofillData({
			fields: this.mForm.form.fields,
			fieldHashToIdMap: this.mForm.getFieldHashToIdMap() as Map<
				string,
				Types.ObjectId
			>,
			inferredAnswers: inferenceResult.answers,
			cvData: this.cvData,
			fileInfo,
		});

		const autofill = await AutofillModel.create({
			userId: this.userId,
			autofillId: randomUUID(),
			formReference: this.mForm.form._id,
			uploadReference: new mongoose.Types.ObjectId(
				this.fileUploadId.toString(),
			),
			cvDataReference: new mongoose.Types.ObjectId(this.cvDataId.toString()),
			jdRawText: params.jdRawText ?? "",
			formContext: params.formContext ?? "",
			data,
		});

		this.autofill.setAutofill(autofill);
		await this.autofill.persistAllUsage();

		return autofill;
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

		const formFields = this.mForm.getInputFields();

		const result = await validateJdFormMatchWithAI({
			jdText: jdRawText,
			formFields,
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
	 * Collects fields that require inference from classified fields
	 */
	private collectInferenceFields(): InferenceField[] {
		const result: InferenceField[] = [];
		this.mForm.ensureExists();

		if (!Array.isArray(this.mForm.form.fields)) {
			throw new Error("Form fields must be an array");
		}
		for (const field of this.mForm.form.fields) {
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
