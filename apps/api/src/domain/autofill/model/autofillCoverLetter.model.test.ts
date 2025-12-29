import { beforeEach, describe, expect, it } from "vitest";
import { AutofillCoverLetterModel } from "./autofillCoverLetter.model.js";

describe("AutofillCoverLetterModel", () => {
	beforeEach(async () => {
		await AutofillCoverLetterModel.deleteMany({}).setOptions({
			skipOwnershipEnforcement: true,
		});
	});

	const TEST_AUTOFILL_ID = "autofill-123";
	const TEST_USER_ID = "user-123";

	describe("findByAutofillId", () => {
		it("should return null when no cover letters exist", async () => {
			const result = await AutofillCoverLetterModel.findByAutofillId(
				TEST_AUTOFILL_ID,
				TEST_USER_ID,
			);
			expect(result).toBeNull();
		});

		it("should return single cover letter", async () => {
			await AutofillCoverLetterModel.create({
				userId: TEST_USER_ID,
				autofillId: TEST_AUTOFILL_ID,
				hash: "hash-1",
				value: "Dear Hiring Manager, I am writing to express my interest...",
				instructions: "Make it professional and concise",
				length: "medium",
				format: "paragraph",
			});

			const result = await AutofillCoverLetterModel.findByAutofillId(
				TEST_AUTOFILL_ID,
				TEST_USER_ID,
			);

			expect(result).not.toBeNull();
			expect(result?.hash).toBe("hash-1");
			expect(result?.value).toBe(
				"Dear Hiring Manager, I am writing to express my interest...",
			);
			expect(result?.length).toBe("medium");
			expect(result?.format).toBe("paragraph");
		});

		it("should return only latest cover letter when multiple exist", async () => {
			await AutofillCoverLetterModel.create({
				userId: TEST_USER_ID,
				autofillId: TEST_AUTOFILL_ID,
				hash: "hash-1",
				value: "First version of cover letter",
				instructions: "First attempt",
				length: "short",
				format: "paragraph",
			});

			await new Promise((resolve) => setTimeout(resolve, 10));

			await AutofillCoverLetterModel.create({
				userId: TEST_USER_ID,
				autofillId: TEST_AUTOFILL_ID,
				hash: "hash-1",
				value: "Second version of cover letter",
				instructions: "Second attempt",
				length: "medium",
				format: "paragraph",
			});

			await new Promise((resolve) => setTimeout(resolve, 10));

			await AutofillCoverLetterModel.create({
				userId: TEST_USER_ID,
				autofillId: TEST_AUTOFILL_ID,
				hash: "hash-1",
				value: "Third version of cover letter",
				instructions: "Third attempt",
				length: "long",
				format: "bullet",
			});

			const result = await AutofillCoverLetterModel.findByAutofillId(
				TEST_AUTOFILL_ID,
				TEST_USER_ID,
			);

			expect(result).not.toBeNull();
			expect(result?.hash).toBe("hash-1");
			expect(result?.value).toBe("Third version of cover letter");
			expect(result?.length).toBe("long");
			expect(result?.format).toBe("bullet");
		});

		it("should return latest cover letter regardless of hash changes", async () => {
			await AutofillCoverLetterModel.create({
				userId: TEST_USER_ID,
				autofillId: TEST_AUTOFILL_ID,
				hash: "hash-1",
				value: "Old cover letter 1",
				instructions: "Old instructions 1",
				length: "short",
				format: "paragraph",
			});

			await new Promise((resolve) => setTimeout(resolve, 10));

			await AutofillCoverLetterModel.create({
				userId: TEST_USER_ID,
				autofillId: TEST_AUTOFILL_ID,
				hash: "hash-2",
				value: "New cover letter with different hash",
				instructions: "New instructions",
				length: "long",
				format: "bullet",
			});

			const result = await AutofillCoverLetterModel.findByAutofillId(
				TEST_AUTOFILL_ID,
				TEST_USER_ID,
			);

			expect(result).not.toBeNull();
			expect(result?.hash).toBe("hash-2");
			expect(result?.value).toBe("New cover letter with different hash");
			expect(result?.length).toBe("long");
			expect(result?.format).toBe("bullet");
		});

		it("should only return cover letter for specified autofillId", async () => {
			await AutofillCoverLetterModel.create([
				{
					userId: TEST_USER_ID,
					autofillId: TEST_AUTOFILL_ID,
					hash: "hash-1",
					value: "Correct cover letter",
					instructions: "Instructions",
					length: "medium",
					format: "paragraph",
				},
				{
					userId: TEST_USER_ID,
					autofillId: "different-autofill-id",
					hash: "hash-1",
					value: "Wrong cover letter",
					instructions: "Instructions",
					length: "medium",
					format: "paragraph",
				},
			]);

			const result = await AutofillCoverLetterModel.findByAutofillId(
				TEST_AUTOFILL_ID,
				TEST_USER_ID,
			);

			expect(result).not.toBeNull();
			expect(result?.value).toBe("Correct cover letter");
		});

		it("should preserve createdAt and updatedAt from latest cover letter", async () => {
			await AutofillCoverLetterModel.create({
				userId: TEST_USER_ID,
				autofillId: TEST_AUTOFILL_ID,
				hash: "hash-1",
				value: "First cover letter",
				instructions: "First instructions",
				length: "short",
				format: "paragraph",
			});

			await new Promise((resolve) => setTimeout(resolve, 10));

			const secondCoverLetter = await AutofillCoverLetterModel.create({
				userId: TEST_USER_ID,
				autofillId: TEST_AUTOFILL_ID,
				hash: "hash-1",
				value: "Second cover letter",
				instructions: "Second instructions",
				length: "medium",
				format: "paragraph",
			});

			const result = await AutofillCoverLetterModel.findByAutofillId(
				TEST_AUTOFILL_ID,
				TEST_USER_ID,
			);

			expect(result).not.toBeNull();
			expect(result?.createdAt.getTime()).toBe(
				secondCoverLetter.createdAt.getTime(),
			);
			expect(result?.updatedAt.getTime()).toBe(
				secondCoverLetter.updatedAt.getTime(),
			);
		});

		it("should handle empty optional fields", async () => {
			await AutofillCoverLetterModel.create({
				userId: TEST_USER_ID,
				autofillId: TEST_AUTOFILL_ID,
				hash: "hash-1",
				value: "Cover letter with minimal context",
				instructions: "",
				length: "medium",
				format: "paragraph",
			});

			const result = await AutofillCoverLetterModel.findByAutofillId(
				TEST_AUTOFILL_ID,
				TEST_USER_ID,
			);

			expect(result).not.toBeNull();
			expect(result?.instructions).toBe("");
		});
	});
});
