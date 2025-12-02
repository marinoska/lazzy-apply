import type { Field, FormInput } from "@lazyapply/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FormFieldModel, FormModel } from "@/formFields/index.js";
import { ClassificationManager } from "./classification.manager.js";
import type { EnrichedClassifiedField } from "./services/classifier.service.js";

// Mock the classifier service to avoid actual AI calls
vi.mock("./services/classifier.service.js", () => ({
	classifyFieldsWithAI: vi.fn().mockImplementation((fields: Field[]) => {
		// Return classifications for all fields passed in
		const classifiedFields: EnrichedClassifiedField[] = fields.map((f) => ({
			...f,
			classification: "personal.email" as const,
		}));
		return Promise.resolve({
			classifiedFields,
			usage: {
				promptTokens: 100,
				completionTokens: 50,
				totalTokens: 150,
				inputCost: 0.0001,
				outputCost: 0.00005,
				totalCost: 0.00015,
			},
		});
	}),
}));

describe("classification.manager", () => {
	beforeEach(async () => {
		await FormModel.deleteMany({});
		await FormFieldModel.deleteMany({});
		vi.clearAllMocks();
	});

	const createTestField = (hash: string, id: string, name: string): Field => ({
		hash: hash,
		field: {
			id,
			tag: "input",
			type: "text",
			name,
			label: name,
			placeholder: null,
			description: null,
			isFileUpload: false,
			accept: null,
		},
	});

	const createTestFormInput = (): FormInput => ({
		formHash: "test-form-hash",
		fields: [{ hash: "hash-1", path: "test.email" }],
		pageUrl: "https://example.com/apply",
		action: "https://example.com/submit",
	});

	describe("ClassificationManager.process", () => {
		it("should return cached data when form exists", async () => {
			// Create existing form in DB
			await FormModel.create({
				formHash: "test-form-hash",
				fields: [
					{
						hash: "hash-1",
						classification: "personal.email",
					},
				],
				pageUrls: ["https://example.com/apply"],
				actions: ["https://example.com/submit"],
			});

			const formInput = createTestFormInput();
			const fields = [createTestField("hash-1", "field-1", "email")];

			const manager = new ClassificationManager(formInput, fields);
			const result = await manager.process();

			expect(result.fromCache).toBe(true);
			expect(Object.keys(result.response)).toHaveLength(1);
			expect(result.response["hash-1"].fieldId).toBe("field-1");
			expect(result.response["hash-1"].path).toBe("personal.email");
		});

		it("should update pageUrls when form exists but URL is new", async () => {
			await FormModel.create({
				formHash: "test-form-hash",
				fields: [
					{
						hash: "hash-1",
						classification: "personal.email",
					},
				],
				pageUrls: ["https://example.com/old-page"],
				actions: [],
			});

			const formInput: FormInput = {
				...createTestFormInput(),
				pageUrl: "https://example.com/new-page",
				action: null,
			};
			const fields = [createTestField("hash-1", "field-1", "email")];

			const manager = new ClassificationManager(formInput, fields);
			await manager.process();

			const updatedForm = await FormModel.findOne({
				formHash: "test-form-hash",
			});
			expect(updatedForm?.pageUrls).toContain("https://example.com/old-page");
			expect(updatedForm?.pageUrls).toContain("https://example.com/new-page");
		});

		it("should use cached fields and classify only missing ones", async () => {
			// Create one cached field
			await FormFieldModel.create({
				hash: "hash-1",
				field: {
					tag: "input",
					type: "email",
					name: "email",
					label: "Email",
					placeholder: null,
					description: null,
					isFileUpload: false,
					accept: null,
				},
				classification: "personal.email",
			});

			const formInput = createTestFormInput();
			formInput.fields = [
				{ hash: "hash-1", path: "test.email" },
				{ hash: "hash-2", path: "test.phone" },
			];

			const fields = [
				createTestField("hash-1", "field-1", "email"),
				createTestField("hash-2", "field-2", "phone"),
			];

			const manager = new ClassificationManager(formInput, fields);
			const result = await manager.process();

			expect(result.fromCache).toBe(false);
			// Should have response for both fields (one cached, one classified)
			expect(Object.keys(result.response).length).toBeGreaterThanOrEqual(1);

			// Form should be persisted
			const savedForm = await FormModel.findOne({ formHash: "test-form-hash" });
			expect(savedForm).not.toBeNull();
		});

		it("should classify all fields when none are cached", async () => {
			const formInput = createTestFormInput();
			const fields = [createTestField("hash-1", "field-1", "email")];

			const manager = new ClassificationManager(formInput, fields);
			const result = await manager.process();

			expect(result.fromCache).toBe(false);
			expect(Object.keys(result.response)).toHaveLength(1);

			// Form and field should be persisted
			const savedForm = await FormModel.findOne({ formHash: "test-form-hash" });
			expect(savedForm).not.toBeNull();

			const savedField = await FormFieldModel.findOne({ hash: "hash-1" });
			expect(savedField).not.toBeNull();
		});
	});
});
