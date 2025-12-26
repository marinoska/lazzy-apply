import type { Field, FormInput } from "@lazyapply/types";
import type { Types } from "mongoose";
import mongoose from "mongoose";
import { createLogger } from "@/app/logger.js";
import {
	type CreateFormFieldParams,
	type CreateFormParams,
	FormFieldModel,
	FormModel,
	type TFormField,
} from "@/domain/autofill/index.js";
import type {
	FormDocumentPopulated,
	TFormFieldPopulated,
	TFormFieldRef,
} from "@/domain/autofill/model/formField.types.js";
import type { EnrichedClassifiedField } from "../llm/classifier.llm.js";

const logger = createLogger("form");

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

export class Form {
	private mForm?: FormDocumentPopulated;
	private knownFields: TFormField[] = [];
	private fieldsToClassify: Field[] = [];

	constructor(
		private readonly formInput: FormInput,
		private readonly inputFieldsMap: Map<string, Field>,
	) {}

	get form(): FormDocumentPopulated {
		if (!this.mForm) {
			throw new Error("Form must be persisted before this operation");
		}
		return this.mForm;
	}

	get formOrUndefined(): FormDocumentPopulated | undefined {
		return this.mForm;
	}

	get fields(): TFormField[] {
		return this.knownFields;
	}

	getInputFields(): Field[] {
		return Array.from(this.inputFieldsMap.values());
	}

	async load() {
		const existingForm = await FormModel.findByHash(this.formInput.formHash, {
			populate: true,
		});

		if (existingForm) {
			this.setFormState(existingForm);
		} else {
			logger.info("Form not found, looking up fields by hash");
			await this.loadKnownFieldsFromDB();
		}
	}

	private setFormState(form: FormDocumentPopulated) {
		this.mForm = form;
		this.knownFields = form.fields.map(
			(field: TFormFieldPopulated) => field.fieldRef,
		);
		this.fieldsToClassify = [];
	}

	private async loadKnownFieldsFromDB() {
		const hashes = Array.from(this.inputFieldsMap.keys());
		this.knownFields = await FormFieldModel.findByHashes(hashes);

		const existingFieldHashes = this.knownFields.map((f) => f.hash);

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

	hasFieldsToClassify(): boolean {
		return this.fieldsToClassify.length > 0;
	}

	getFieldsToClassify(): Field[] {
		return this.fieldsToClassify;
	}

	async persist(
		allFields: (TFormField | EnrichedClassifiedField)[],
		classifiedFields: EnrichedClassifiedField[],
	) {
		logger.info("Persisting new form and fields");
		const session = await mongoose.startSession();

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
					formHash: this.formInput.formHash,
					fields: formFieldRefs,
					pageUrl: this.formInput.pageUrl,
					action: this.formInput.action,
				};

				await FormModel.create([formData], { session });
			});

			const createdForm = await FormModel.findByHash(this.formInput.formHash, {
				populate: true,
			});

			if (!createdForm) {
				throw new Error("Failed to create form: transaction aborted");
			}

			this.setFormState(createdForm);

			return createdForm;
		} finally {
			await session.endSession();
		}
	}

	ensureExists() {
		if (!this.mForm) {
			throw new Error("Form must be persisted before this operation");
		}
	}

	getFieldHashToIdMap(): Map<string, unknown> {
		return new Map(
			this.form.fields.map((field) => [field.hash, field.fieldRef._id]),
		);
	}
}
