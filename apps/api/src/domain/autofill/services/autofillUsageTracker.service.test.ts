import type { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UsageTracker } from "@/domain/usage/index.js";
import { AutofillUsageTracker } from "./autofillUsageTracker.service.js";

const mockSetReference = vi.fn();
const mockSetAutofillId = vi.fn();
const mockSetUsage = vi.fn();
const mockPersist = vi.fn();

vi.mock("@/domain/usage/index.js", () => ({
	UsageTracker: vi.fn().mockImplementation(() => ({
		setReference: mockSetReference,
		setAutofillId: mockSetAutofillId,
		setUsage: mockSetUsage,
		persist: mockPersist,
	})),
}));

describe("AutofillUsageTracker", () => {
	const userId = "test-user-id";
	const mockAutofillId =
		"507f1f77bcf86cd799439011" as unknown as Types.ObjectId;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("constructor", () => {
		it("should create UsageTracker with autofill reference table", () => {
			new AutofillUsageTracker(userId);

			expect(UsageTracker).toHaveBeenCalledWith(userId, {
				referenceTable: "autofill",
			});
		});
	});

	describe("setAutofill", () => {
		it("should set reference and autofillId on the underlying tracker", () => {
			const tracker = new AutofillUsageTracker(userId);
			const mockAutofillDoc = { _id: mockAutofillId };

			tracker.setAutofill(mockAutofillDoc as never);

			expect(mockSetReference).toHaveBeenCalledWith(mockAutofillId);
			expect(mockSetAutofillId).toHaveBeenCalledWith(mockAutofillId);
		});
	});

	describe("setClassificationUsage", () => {
		it("should set form_fields_classification usage", () => {
			const tracker = new AutofillUsageTracker(userId);
			const usage = {
				promptTokens: 100,
				completionTokens: 50,
				totalTokens: 150,
				inputCost: 0.01,
				outputCost: 0.02,
				totalCost: 0.03,
			};

			tracker.setClassificationUsage(usage);

			expect(mockSetUsage).toHaveBeenCalledWith(
				"form_fields_classification",
				usage,
			);
		});
	});

	describe("setJdFormExtractorRouterUsage", () => {
		it("should set jd_form_extractor:router usage", () => {
			const tracker = new AutofillUsageTracker(userId);
			const usage = {
				promptTokens: 200,
				completionTokens: 100,
				totalTokens: 300,
				inputCost: 0.02,
				outputCost: 0.04,
				totalCost: 0.06,
			};

			tracker.setJdFormExtractorRouterUsage(usage);

			expect(mockSetUsage).toHaveBeenCalledWith(
				"jd_form_extractor:router",
				usage,
			);
		});

		it("should handle null usage", () => {
			const tracker = new AutofillUsageTracker(userId);

			tracker.setJdFormExtractorRouterUsage(null);

			expect(mockSetUsage).not.toHaveBeenCalled();
		});
	});

	describe("setJdFormExtractorWriterUsage", () => {
		it("should set jd_form_extractor:writer usage", () => {
			const tracker = new AutofillUsageTracker(userId);
			const usage = {
				promptTokens: 150,
				completionTokens: 75,
				totalTokens: 225,
				inputCost: 0.015,
				outputCost: 0.03,
				totalCost: 0.045,
			};

			tracker.setJdFormExtractorWriterUsage(usage);

			expect(mockSetUsage).toHaveBeenCalledWith(
				"jd_form_extractor:writer",
				usage,
			);
		});

		it("should handle null usage", () => {
			const tracker = new AutofillUsageTracker(userId);

			tracker.setJdFormExtractorWriterUsage(null);

			expect(mockSetUsage).not.toHaveBeenCalled();
		});
	});

	describe("setInferenceUsage", () => {
		it("should set form_fields_inference usage", () => {
			const tracker = new AutofillUsageTracker(userId);
			const usage = {
				promptTokens: 300,
				completionTokens: 150,
				totalTokens: 450,
				inputCost: 0.03,
				outputCost: 0.06,
				totalCost: 0.09,
			};

			tracker.setInferenceUsage(usage);

			expect(mockSetUsage).toHaveBeenCalledWith("form_fields_inference", usage);
		});
	});

	describe("persistUsage", () => {
		it("should delegate to underlying tracker", async () => {
			const tracker = new AutofillUsageTracker(userId);
			const mockSession = {} as any;

			await tracker.persistUsage(mockSession);

			expect(mockPersist).toHaveBeenCalledWith(mockSession);
		});
	});
});
