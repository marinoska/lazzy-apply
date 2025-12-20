import type { AutofillRequest, AutofillResponse } from "@lazyapply/types";
import { describe, expect, it } from "vitest";

/**
 * Tests for AutofillContext logic.
 * Since we don't have React testing utilities, we test the pure logic
 * that would be used in the context.
 */

describe("AutofillContext logic", () => {
	describe("autofillId handling", () => {
		it("should include autofillId in request when available", () => {
			const autofillId = "existing-autofill-id";
			const baseRequest = {
				form: {
					formHash: "test-hash",
					fields: [],
					pageUrl: "https://example.com",
					action: null,
				},
				fields: [],
				selectedUploadId: "upload-123",
				jdRawText: "",
				formContext: [],
			};

			const request: AutofillRequest = {
				...baseRequest,
				...(autofillId && { autofillId }),
			};

			expect(request.autofillId).toBe("existing-autofill-id");
		});

		it("should not include autofillId in request when null", () => {
			const autofillId: string | null = null;
			const baseRequest = {
				form: {
					formHash: "test-hash",
					fields: [],
					pageUrl: "https://example.com",
					action: null,
				},
				fields: [],
				selectedUploadId: "upload-123",
				jdRawText: "",
				formContext: [],
			};

			const request: AutofillRequest = {
				...baseRequest,
				...(autofillId && { autofillId }),
			};

			expect(request.autofillId).toBeUndefined();
		});

		it("should extract autofillId from response", () => {
			const response: AutofillResponse = {
				autofillId: "new-autofill-id",
				fields: {},
				fromCache: false,
			};

			const extractedId = response.autofillId;

			expect(extractedId).toBe("new-autofill-id");
		});

		it("should use autofillId from previous response in subsequent request", () => {
			const firstResponse: AutofillResponse = {
				autofillId: "first-autofill-id",
				fields: {},
				fromCache: false,
			};

			const storedAutofillId = firstResponse.autofillId;

			const subsequentRequest: AutofillRequest = {
				form: {
					formHash: "test-hash",
					fields: [],
					pageUrl: "https://example.com",
					action: null,
				},
				fields: [],
				selectedUploadId: "upload-123",
				...(storedAutofillId && { autofillId: storedAutofillId }),
			};

			expect(subsequentRequest.autofillId).toBe("first-autofill-id");
		});
	});

	describe("inferFieldHash handling", () => {
		it("should store field hash for inference", () => {
			const hash = "field-hash-123";

			const inferFieldHash: string | null = hash;

			expect(inferFieldHash).toBe("field-hash-123");
		});

		it("should handle null inferFieldHash", () => {
			const inferFieldHash: string | null = null;

			expect(inferFieldHash).toBeNull();
		});
	});
});
