import type { FileUploadContentType, ParsedCVData } from "@lazyapply/types";
import mongoose from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CVDataModel } from "@/domain/uploads/model/cvData.model.js";
import { OutboxModel } from "@/domain/uploads/model/outbox.model.js";
import {
	updateOutboxBodySchema,
	updateOutboxStatus,
} from "./updateOutboxStatus.controller.js";

vi.mock("@/domain/usage/index.js", async (importOriginal) => {
	const original =
		await importOriginal<typeof import("@/domain/usage/index.js")>();
	return {
		...original,
		UsageTracker: vi.fn().mockImplementation(() => ({
			setReference: vi.fn(),
			setAutofillId: vi.fn(),
			setUsage: vi.fn(),
			persistAllUsage: vi.fn().mockResolvedValue(undefined),
		})),
	};
});

describe("Update Outbox Status", () => {
	let mockReq: any;
	let mockRes: any;
	let jsonMock: ReturnType<typeof vi.fn>;
	let statusMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		jsonMock = vi.fn();
		statusMock = vi.fn().mockReturnValue({ json: jsonMock });
		mockRes = {
			status: statusMock,
		};
	});

	describe("Completed Status with Transaction", () => {
		it("should create completed outbox entry and save CV data in transaction", async () => {
			const uploadId = new mongoose.Types.ObjectId();
			// Create outbox entry
			const _outbox = await OutboxModel.create({
				processId: "test-process-txn-1",
				type: "file_upload",
				status: "processing",
				uploadId,
				fileId: "test-file-txn-1",
				userId: "test-user-txn-1",
				fileType: "PDF" as FileUploadContentType,
			});

			const parsedData: Omit<ParsedCVData, "_id"> = {
				personal: {
					fullName: "Transaction Test",
					email: "txn@test.com",
					phone: null,
					location: null,
				},
				links: [],
				headline: null,
				summary: "Test summary",
				experience: [],
				education: [],
				certifications: [],
				languages: [],
				extras: {},
				rawText: "Test CV content",
			};

			mockReq = {
				params: { processId: "test-process-txn-1" },
				body: {
					status: "completed",
					data: parsedData,
				},
			};

			await updateOutboxStatus(mockReq, mockRes);

			// Verify new completed entry was created
			const allEntries = await OutboxModel.find({
				processId: "test-process-txn-1",
			}).sort({ createdAt: -1 });
			expect(allEntries).toHaveLength(2); // Original + completed
			const latestEntry = allEntries[0];
			expect(latestEntry.status).toBe("completed");
			expect(latestEntry.error).toBeUndefined();

			// Verify CV data was saved (skip ownership enforcement for test)
			const cvData = await CVDataModel.findOne({
				uploadId: latestEntry.uploadId,
			}).setOptions({ skipOwnershipEnforcement: true });
			expect(cvData).toBeDefined();
			expect(cvData?.userId).toBe("test-user-txn-1");
			expect(cvData?.personal.fullName).toBe("Transaction Test");
			expect(cvData?.personal.email).toBe("txn@test.com");
			expect(cvData?.summary).toBe("Test summary");

			// Verify response
			expect(statusMock).toHaveBeenCalledWith(200);
			expect(jsonMock).toHaveBeenCalledWith({
				processId: "test-process-txn-1",
				status: "completed",
			});
		});

		it("should reject completed status without data", async () => {
			const uploadId = new mongoose.Types.ObjectId();
			await OutboxModel.create({
				processId: "test-process-no-data",
				type: "file_upload",
				status: "pending",
				uploadId,
				fileId: "test-file-no-data",
				userId: "test-user-no-data",
				fileType: "DOCX" as FileUploadContentType,
			});

			const invalidBody = {
				status: "completed",
				data: null,
			};

			// Validate that the schema rejects this
			const validationResult = updateOutboxBodySchema.safeParse(invalidBody);
			expect(validationResult.success).toBe(false);
			if (!validationResult.success) {
				expect(validationResult.error.errors[0].message).toBe(
					"data is required when status is completed",
				);
			}

			// Verify no new entry was created
			const entries = await OutboxModel.find({
				processId: "test-process-no-data",
			});
			expect(entries).toHaveLength(1); // Only original entry
			expect(entries[0].status).toBe("pending");
		});

		it("should save all ParsedCVData fields correctly", async () => {
			const uploadId = new mongoose.Types.ObjectId();
			await OutboxModel.create({
				processId: "test-process-full-data",
				type: "file_upload",
				status: "processing",
				uploadId,
				fileId: "test-file-full",
				userId: "test-user-full",
				fileType: "PDF" as FileUploadContentType,
			});

			const fullParsedData: Omit<ParsedCVData, "_id"> = {
				personal: {
					fullName: "Full Name Test",
					email: "full@test.com",
					phone: "+1234567890",
					location: "Test City",
					nationality: "US",
					rightToWork: "US Citizen",
				},
				links: [
					{ type: "linkedin", url: "https://linkedin.com/test" },
					{ type: "github", url: "https://github.com/test" },
				],
				headline: "Senior Software Engineer",
				summary: "Comprehensive test summary",
				experience: [
					{
						role: "Test Role",
						company: "Test Company",
						startDate: "2020-01",
						endDate: "2023-12",
						description: "Test description",
					},
				],
				education: [
					{
						degree: "Test Degree",
						field: "Test Field",
						institution: "Test University",
						startDate: "2016",
						endDate: "2020",
					},
				],
				certifications: [
					{
						name: "Test Cert",
						issuer: "Test Issuer",
						date: "2022",
					},
				],
				languages: [
					{ language: "English", level: "native" },
					{ language: "Spanish", level: "fluent" },
				],
				extras: {
					drivingLicense: "Yes",
					workPermit: "US",
					willingToRelocate: true,
					remotePreference: "remote",
					noticePeriod: "1 month",
					availability: "Immediate",
					salaryExpectation: "$100k",
				},
				rawText: "Full raw CV text content",
			};

			mockReq = {
				params: { processId: "test-process-full-data" },
				body: {
					status: "completed",
					data: fullParsedData,
				},
			};

			await updateOutboxStatus(mockReq, mockRes);

			const cvData = await CVDataModel.findOne({
				uploadId: uploadId,
			}).setOptions({ skipOwnershipEnforcement: true });
			expect(cvData).toBeDefined();
			expect(cvData?.personal.fullName).toBe("Full Name Test");
			expect(cvData?.personal.nationality).toBe("US");
			expect(cvData?.links).toHaveLength(2);
			expect(cvData?.experience).toHaveLength(1);
			expect(cvData?.education).toHaveLength(1);
			expect(cvData?.certifications).toHaveLength(1);
			expect(cvData?.languages).toHaveLength(2);
			expect(cvData?.extras.remotePreference).toBe("remote");
			expect(cvData?.rawText).toBe("Full raw CV text content");
		});
	});

	describe("Failed Status", () => {
		it("should create failed outbox entry with error message", async () => {
			const uploadId = new mongoose.Types.ObjectId();
			await OutboxModel.create({
				processId: "test-process-failed",
				type: "file_upload",
				status: "processing",
				uploadId,
				fileId: "test-file-failed",
				userId: "test-user-failed",
				fileType: "PDF",
			});

			mockReq = {
				params: { processId: "test-process-failed" },
				body: {
					status: "failed",
					error: "Processing failed due to invalid format",
				},
			};

			await updateOutboxStatus(mockReq, mockRes);

			// Verify new failed entry was created
			const allEntries = await OutboxModel.find({
				processId: "test-process-failed",
			}).sort({ createdAt: -1 });
			expect(allEntries).toHaveLength(2); // Original + failed
			const latestEntry = allEntries[0];
			expect(latestEntry.status).toBe("failed");
			expect(latestEntry.error).toBe("Processing failed due to invalid format");

			// Verify no CV data was created
			const cvData = await CVDataModel.findOne({
				uploadId: latestEntry.uploadId,
			}).setOptions({ skipOwnershipEnforcement: true });
			expect(cvData).toBeNull();
		});
	});

	describe("Not-a-CV Status", () => {
		it("should create not-a-cv outbox entry", async () => {
			const uploadId = new mongoose.Types.ObjectId();
			await OutboxModel.create({
				processId: "test-process-not-a-cv",
				type: "file_upload",
				status: "processing",
				uploadId,
				fileId: "test-file-not-a-cv",
				userId: "test-user-not-a-cv",
				fileType: "PDF",
			});

			mockReq = {
				params: { processId: "test-process-not-a-cv" },
				body: {
					status: "not-a-cv",
					usage: {
						promptTokens: 100,
						completionTokens: 50,
						totalTokens: 150,
					},
				},
			};

			await updateOutboxStatus(mockReq, mockRes);

			// Verify new not-a-cv entry was created
			const allEntries = await OutboxModel.find({
				processId: "test-process-not-a-cv",
			}).sort({ createdAt: -1 });
			expect(allEntries).toHaveLength(2); // Original + not-a-cv
			const latestEntry = allEntries[0];
			expect(latestEntry.status).toBe("not-a-cv");

			// Verify no CV data was created
			const cvData = await CVDataModel.findOne({
				uploadId: uploadId,
			}).setOptions({ skipOwnershipEnforcement: true });
			expect(cvData).toBeNull();

			// Verify response
			expect(statusMock).toHaveBeenCalledWith(200);
			expect(jsonMock).toHaveBeenCalledWith({
				processId: "test-process-not-a-cv",
				status: "not-a-cv",
			});
		});
	});

	describe("Error Handling", () => {
		it("should throw NotFound error for non-existent processId", async () => {
			mockReq = {
				params: { processId: "non-existent-process" },
				body: {
					status: "completed",
				},
			};

			await expect(updateOutboxStatus(mockReq, mockRes)).rejects.toThrow(
				"Outbox entry not found",
			);
		});
	});

	describe("Transaction Session Handling", () => {
		it("should pass session to all database operations in completed flow", async () => {
			const uploadId = new mongoose.Types.ObjectId();
			const markAsCompletedSpy = vi.spyOn(OutboxModel, "markAsCompleted");
			const createCVDataSpy = vi.spyOn(CVDataModel, "createCVData");

			await OutboxModel.create({
				processId: "test-session-completed",
				type: "file_upload",
				status: "processing",
				uploadId,
				fileId: "test-file-session",
				userId: "test-user-session",
				fileType: "PDF" as FileUploadContentType,
			});

			const parsedData: Omit<ParsedCVData, "_id"> = {
				personal: {
					fullName: "Session Test",
					email: "session@test.com",
					phone: null,
					location: null,
				},
				links: [],
				headline: null,
				summary: "Test",
				experience: [],
				education: [],
				certifications: [],
				languages: [],
				extras: {},
				rawText: "Test",
			};

			mockReq = {
				params: { processId: "test-session-completed" },
				body: {
					status: "completed",
					data: parsedData,
					usage: {
						promptTokens: 100,
						completionTokens: 50,
						totalTokens: 150,
					},
				},
			};

			await updateOutboxStatus(mockReq, mockRes);

			expect(markAsCompletedSpy).toHaveBeenCalled();
			const markAsCompletedCall = markAsCompletedSpy.mock.calls[0];
			expect(markAsCompletedCall[1]).toBeDefined();
			expect(markAsCompletedCall[1]).toHaveProperty("withTransaction");

			expect(createCVDataSpy).toHaveBeenCalled();
			const createCVDataCall = createCVDataSpy.mock.calls[0];
			expect(createCVDataCall[1]).toBeDefined();
			expect(createCVDataCall[1]).toHaveProperty("withTransaction");

			markAsCompletedSpy.mockRestore();
			createCVDataSpy.mockRestore();
		});

		it("should pass session to markAsFailed in failed flow", async () => {
			const uploadId = new mongoose.Types.ObjectId();
			const markAsFailedSpy = vi.spyOn(OutboxModel, "markAsFailed");

			await OutboxModel.create({
				processId: "test-session-failed",
				type: "file_upload",
				status: "processing",
				uploadId,
				fileId: "test-file-failed-session",
				userId: "test-user-failed-session",
				fileType: "PDF" as FileUploadContentType,
			});

			mockReq = {
				params: { processId: "test-session-failed" },
				body: {
					status: "failed",
					error: "Test error",
				},
			};

			await updateOutboxStatus(mockReq, mockRes);

			expect(markAsFailedSpy).toHaveBeenCalled();
			const markAsFailedCall = markAsFailedSpy.mock.calls[0];
			expect(markAsFailedCall[2]).toBeDefined();
			expect(markAsFailedCall[2]).toHaveProperty("withTransaction");

			markAsFailedSpy.mockRestore();
		});

		it("should pass session to markAsNotACV in not-a-cv flow", async () => {
			const uploadId = new mongoose.Types.ObjectId();
			const markAsNotACVSpy = vi.spyOn(OutboxModel, "markAsNotACV");

			await OutboxModel.create({
				processId: "test-session-not-a-cv",
				type: "file_upload",
				status: "processing",
				uploadId,
				fileId: "test-file-not-a-cv-session",
				userId: "test-user-not-a-cv-session",
				fileType: "PDF" as FileUploadContentType,
			});

			mockReq = {
				params: { processId: "test-session-not-a-cv" },
				body: {
					status: "not-a-cv",
				},
			};

			await updateOutboxStatus(mockReq, mockRes);

			expect(markAsNotACVSpy).toHaveBeenCalled();
			const markAsNotACVCall = markAsNotACVSpy.mock.calls[0];
			expect(markAsNotACVCall[1]).toBeDefined();
			expect(markAsNotACVCall[1]).toHaveProperty("withTransaction");

			markAsNotACVSpy.mockRestore();
		});

		it("should rollback transaction if CVData creation fails", async () => {
			const uploadId = new mongoose.Types.ObjectId();
			const createCVDataSpy = vi
				.spyOn(CVDataModel, "createCVData")
				.mockRejectedValueOnce(new Error("CV Data creation failed"));

			await OutboxModel.create({
				processId: "test-rollback",
				type: "file_upload",
				status: "processing",
				uploadId,
				fileId: "test-file-rollback",
				userId: "test-user-rollback",
				fileType: "PDF" as FileUploadContentType,
			});

			const parsedData: Omit<ParsedCVData, "_id"> = {
				personal: {
					fullName: "Rollback Test",
					email: "rollback@test.com",
					phone: null,
					location: null,
				},
				links: [],
				headline: null,
				summary: "Test",
				experience: [],
				education: [],
				certifications: [],
				languages: [],
				extras: {},
				rawText: "Test",
			};

			mockReq = {
				params: { processId: "test-rollback" },
				body: {
					status: "completed",
					data: parsedData,
				},
			};

			await expect(updateOutboxStatus(mockReq, mockRes)).rejects.toThrow(
				"CV Data creation failed",
			);

			const allEntries = await OutboxModel.find({
				processId: "test-rollback",
			}).sort({ createdAt: -1 });
			expect(allEntries).toHaveLength(1);
			expect(allEntries[0].status).toBe("processing");

			const cvData = await CVDataModel.findOne({
				uploadId: uploadId,
			}).setOptions({ skipOwnershipEnforcement: true });
			expect(cvData).toBeNull();

			createCVDataSpy.mockRestore();
		});
	});
});
