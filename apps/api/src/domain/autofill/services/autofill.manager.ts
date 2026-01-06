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
import { createEmptyUsage } from "@/domain/usage/index.js";
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
import { AutofillUsageTracker } from "./index.js";
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
	private autofillUsageTracker: AutofillUsageTracker;

	private constructor(
		private readonly userId: string,
		formInput: FormInput,
		inputFieldsMap: Map<string, Field>,
		private readonly llmServices: AutofillLlmServices,
	) {
		this.mForm = new Form(formInput, inputFieldsMap);
		this.autofillUsageTracker = new AutofillUsageTracker(userId);
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
		const [classificationResult, jdFormFactsResult] = await Promise.all([
			this.ensureFormPersisted(),
			this.extactJdFormFacts(params),
		]);

		const inferenceFields = this.collectInferenceFields();
		const inferenceResult = await this.processInference(
			inferenceFields,
			jdFormFactsResult.jdFacts,
		);

		this.autofillUsageTracker.setClassificationUsage(
			classificationResult.usage,
		);
		this.autofillUsageTracker.setJdFormExtractorRouterUsage(
			jdFormFactsResult.routerUsage,
		);
		this.autofillUsageTracker.setJdFormExtractorWriterUsage(
			jdFormFactsResult.writerUsage,
		);
		this.autofillUsageTracker.setInferenceUsage(inferenceResult.usage);

		const fileInfo = await this.cvContext.getFileInfo();
		const data = await buildAutofillData({
			fields: this.mForm.form.fields,
			fieldHashToIdMap: this.mForm.getFieldHashToIdMap(),
			inferredAnswers: inferenceResult.answers,
			cvData: this.cvContext.cvData,
			fileInfo,
		});
		const session = await mongoose.startSession();
		let autofill: AutofillDocument | null = null;

		try {
			await session.withTransaction(async () => {
				const [createdAutofill] = await AutofillModel.create(
					[
						{
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
							jdUrl: params.jdUrl ?? "",
							jdMatchesForm: jdFormFactsResult.isMatch,
							jdFacts: jdFormFactsResult.jdFacts,
							formContext: params.formContext ?? "",
							data,
						},
					],
					{ session },
				);
				autofill = createdAutofill;

				this.autofillUsageTracker.setAutofill(autofill);
				await this.autofillUsageTracker.persistAllUsage(session);
			});
		} finally {
			await session.endSession();
		}

		if (!autofill) {
			throw new Error("Failed to create autofill record");
		}

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
	 * Matches whether the job description is a match for the application form
	 * and extracts JD facts.
	 * Returns usage to be persisted later after form is ensured to exist.
	 */
	private async extactJdFormFacts(params: ProcessParams) {
		const { jdUrl, formUrl } = params;
		logger.debug(
			{ jdUrl, formUrl },
			"Validating JD match and extracting JD facts",
		);

		const formFields = this.mForm.getInputFields();

		const result = await this.llmServices.jdExtractor.extract({
			...params,
			formFields,
		});

		if (!result.isMatch) {
			logger.warn(
				{ jdUrl, formUrl },
				"JD does not match form - inference will use form context instead",
			);
		}

		return {
			isMatch: result.isMatch,
			routerUsage: result.routerUsage,
			writerUsage: result.writerUsage,
			jdFacts: result.jdFacts,
		};
	}

	/**
	 * Processes field inference for fields that require JD/CV context.
	 */
	private async processInference(
		inferenceFields: InferenceField[],
		jdFacts: Array<{ key: string; value: string; source: string }>,
	): Promise<InferenceResult> {
		if (inferenceFields.length === 0) {
			return { answers: {}, usage: createEmptyUsage() };
		}

		return this.inferFields(inferenceFields, jdFacts);
	}

	/**
	 * Infer field values using structured CV facts and JD facts
	 */
	private async inferFields(
		fields: InferenceField[],
		jdFacts: Array<{ key: string; value: string; source: string }>,
	): Promise<InferenceResult> {
		if (!fields.length) {
			logger.info("No fields to infer, skipping inference");
			return { answers: {}, usage: createEmptyUsage() };
		}

		const { summaryFacts, experienceFacts, profileSignals } = this.cvContext;

		logger.debug(
			{
				summaryFactsCount: summaryFacts.length,
				experienceFactsCount: experienceFacts.length,
				profileSignalsCount: Object.keys(profileSignals).length,
				jdFactsCount: jdFacts.length,
				fieldsCount: fields.length,
			},
			"Inference input",
		);

		const result = await this.llmServices.inferencer.infer({
			summaryFacts,
			experienceFacts,
			profileSignals,
			jdFacts,
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

		logger.debug(
			{
				totalFields: this.mForm.form.fields.length,
				fieldsWithInferenceHint: this.mForm.form.fields.filter(
					(f) => f.inferenceHint,
				).length,
			},
			"Collecting inference fields",
		);

		for (const field of this.mForm.form.fields) {
			if (
				field.classification === "unknown" &&
				field.inferenceHint === "text_from_jd_cv"
			) {
				logger.debug(
					{ hash: field.hash, label: field.fieldRef.field.label },
					"Found field requiring inference",
				);
				result.push({
					hash: field.hash,
					fieldName: field.fieldRef.field.name,
					label: field.fieldRef.field.label ?? null,
					description: field.fieldRef.field.description ?? null,
					placeholder: field.fieldRef.field.placeholder ?? null,
					tag: field.fieldRef.field.tag ?? null,
					type: field.fieldRef.field.type ?? null,
				});
			}
		}

		logger.debug({ count: result.length }, "Collected inference fields");
		return result;
	}
}
