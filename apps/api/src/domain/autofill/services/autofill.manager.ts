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
import { createLogger } from "@/app/logger.js";
import {
	type AutofillDataItem,
	type AutofillDataItemFile,
	type AutofillDataItemText,
	type AutofillDocument,
	AutofillModel,
	type CreateFormFieldParams,
	type CreateFormParams,
	FormFieldModel,
	FormModel,
	type TFormField,
} from "../index.js";
import { createEmptyUsage } from "../llm/base/baseLlmService.js";
import type { EnrichedClassifiedField } from "../llm/classifier.llm.js";
import {
	extractValueByPath,
	type InferenceField,
	type InferenceResult,
	isPathInCVData,
} from "../llm/index.js";
import type {
	FormDocumentPopulated,
	TFormFieldRef,
} from "../model/formField.types.js";
import type { AutofillLlmServices } from "./autofill.manager.types.js";
import { CVContextVO, type FileInfo } from "./cvContextVO.js";
import { Form } from "./Form.js";
import { Autofill } from "./index.js";
import { createDefaultLlmServices } from "./llmServices.js";

const logger = createLogger("autofill.manager");

function buildFormFieldRefs(
	classifiedFields: (EnrichedClassifiedField | TFormField)[],
	fieldHashToIdMap: Map<string, Types.ObjectId>,
): TFormFieldRef[] {
	return classifiedFields
		.map(({ hash, classification, linkType, inferenceHint }) => {
			const fieldRef = fieldHashToIdMap.get(hash);
			if (!fieldRef) return null;
			return {
				hash,
				classification,
				fieldRef,
				...(linkType && { linkType }),
				...(inferenceHint && { inferenceHint }),
			};
		})
		.filter((f): f is TFormFieldRef => f !== null);
}

function buildFormFieldDocuments(
	classifiedFields: EnrichedClassifiedField[],
): CreateFormFieldParams[] {
	const fieldDocs: CreateFormFieldParams[] = [];

	for (const {
		hash,
		classification,
		linkType,
		inferenceHint,
		field,
	} of classifiedFields) {
		fieldDocs.push({
			hash: hash,
			field: {
				tag: field.tag,
				type: field.type,
				name: field.name,
				label: field.label,
				placeholder: field.placeholder,
				description: field.description,
				isFileUpload: field.isFileUpload,
				accept: field.accept,
			},
			classification,
			linkType,
			inferenceHint,
		});
	}

	return fieldDocs;
}

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
export class AutofillManager {
	private mForm: Form;
	private cvContext!: CVContextVO;
	private autofillUsageTracker: Autofill;

	private constructor(
		private readonly userId: string,
		formInput: FormInput,
		inputFieldsMap: Map<string, Field>,
		private readonly llmServices: AutofillLlmServices,
	) {
		this.mForm = new Form(formInput, inputFieldsMap);
		this.autofillUsageTracker = new Autofill(userId);
	}

	/**
	 * Creates an AutofillManager with default (real) LLM services.
	 */
	static async create(deps: ClassificationManagerDeps) {
		return AutofillManager.createWithServices(deps, createDefaultLlmServices());
	}

	/**
	 * Creates an AutofillManager with custom LLM services.
	 * Use this for testing with mock services.
	 */
	static async createWithServices(
		deps: ClassificationManagerDeps,
		llmServices: AutofillLlmServices,
	) {
		const inputFieldsMap = new Map(
			deps.fieldsInput.map((field) => [field.hash, field]),
		);

		const newInstance = new AutofillManager(
			deps.userId,
			deps.formInput,
			inputFieldsMap,
			llmServices,
		);

		const [, cvContext] = await Promise.all([
			newInstance.mForm.init(),
			CVContextVO.load(deps.selectedUploadId, deps.userId),
		]);

		newInstance.cvContext = cvContext;

		return newInstance;
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

		this.autofillUsageTracker.setClassificationUsage(
			classificationResult.usage,
		);
		this.autofillUsageTracker.setJdFormMatchUsage(jdMatchResult.usage);
		this.autofillUsageTracker.setInferenceUsage(inferenceResult.usage);

		const fileInfo = await this.cvContext.getFileInfo();
		const data = await buildAutofillData({
			fields: this.mForm.form.fields,
			fieldHashToIdMap: this.mForm.getFieldHashToIdMap(),
			inferredAnswers: inferenceResult.answers,
			cvData: this.cvContext.cvData,
			fileInfo,
		});

		const autofill = await AutofillModel.create({
			userId: this.userId,
			autofillId: randomUUID(),
			formReference: this.mForm.form._id,
			uploadReference: new mongoose.Types.ObjectId(
				this.cvContext.fileUploadId.toString(),
			),
			cvDataReference: new mongoose.Types.ObjectId(
				this.cvContext.cvDataId.toString(),
			),
			jdRawText: params.jdRawText ?? "",
			formContext: params.formContext ?? "",
			data,
		});

		this.autofillUsageTracker.setAutofill(autofill);
		await this.autofillUsageTracker.persistAllUsage();

		return autofill;
	}

	/**
	 * Classifies fields that are not yet in the database using AI.
	 * Persists form with all fields and returns usage data.
	 */
	private async ensureFormPersisted(): Promise<{ usage: TokenUsage }> {
		if (this.mForm.isPersisted()) {
			return { usage: createEmptyUsage() };
		}

		let classifiedFields: EnrichedClassifiedField[] = [];
		let usage = createEmptyUsage();

		if (this.mForm.hasFieldsToClassify()) {
			const fieldsToClassify = this.mForm.getFieldsToClassify();
			logger.debug(
				{ count: fieldsToClassify.length },
				"Classifying missing fields",
			);

			const result =
				await this.llmServices.classifier.classify(fieldsToClassify);
			classifiedFields = result.classifiedFields;
			usage = result.usage;
		}

		const allFields = [...this.mForm.getKnownFields(), ...classifiedFields];

		await this.persistForm(allFields, classifiedFields);

		return { usage };
	}

	/**
	 * Persists form and fields to the database within a transaction.
	 */
	private async persistForm(
		allFields: (TFormField | EnrichedClassifiedField)[],
		classifiedFields: EnrichedClassifiedField[],
	): Promise<void> {
		logger.info("Persisting new form and fields");
		const session = await mongoose.startSession();
		const formInput = this.mForm.getFormInput();

		try {
			await session.withTransaction(async () => {
				const fieldDocs = buildFormFieldDocuments(classifiedFields);
				if (fieldDocs.length) {
					await FormFieldModel.insertMany(fieldDocs, {
						session,
						ordered: false,
					});
				}

				const hashes = allFields.map((f) => f.hash);
				const existingFields = await FormFieldModel.find(
					{ hash: { $in: hashes } },
					{ hash: 1, _id: 1 },
				).session(session);
				const fieldHashToIdMap = new Map(
					existingFields.map((f) => [f.hash, f._id as Types.ObjectId]),
				);

				const formFieldRefs = buildFormFieldRefs(allFields, fieldHashToIdMap);

				const formData: CreateFormParams = {
					formHash: formInput.formHash,
					fields: formFieldRefs,
					pageUrl: formInput.pageUrl,
					action: formInput.action,
				};

				const [created] = await FormModel.create([formData], { session });
				const populated = await created.populate<{
					fields: FormDocumentPopulated["fields"];
				}>("fields.fieldRef");
				this.mForm.setPersistedForm(
					populated as unknown as FormDocumentPopulated,
				);
			});
		} finally {
			await session.endSession();
		}
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

		const result = await this.llmServices.jdMatcher.match({
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
		if (!this.cvContext.rawText) {
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
			{ cvRawText: this.cvContext.rawText, contextText, fields },
			"Inference input",
		);
		const result = await this.llmServices.inferencer.infer({
			cvRawText: this.cvContext.rawText,
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
}
