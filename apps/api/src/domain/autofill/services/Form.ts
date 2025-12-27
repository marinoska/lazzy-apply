import type { Field, FormInput } from "@lazyapply/types";
import type { Types } from "mongoose";
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

const logger = createLogger("form");

/**
 * Domain entity representing a form with its fields.
 * Handles state management and DB lookups via static model methods.
 * Classification orchestration is handled by AutofillManager.
 */
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

	async init() {
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

	getKnownFields(): TFormField[] {
		return this.knownFields;
	}

	getFormInput(): FormInput {
		return this.formInput;
	}

	isPersisted(): boolean {
		return this.mForm !== undefined;
	}

	ensureExists(): void {
		if (!this.mForm) {
			throw new Error("Form must be persisted before this operation");
		}
	}

	getFieldHashToIdMap(): Map<string, Types.ObjectId> {
		return new Map(
			this.form.fields.map((field) => [field.hash, field.fieldRef._id]),
		);
	}

	/**
	 * Sets the form state after persistence.
	 * Called by AutofillManager after form is persisted.
	 */
	setPersistedForm(form: FormDocumentPopulated): void {
		this.setFormState(form);
	}
}
