import type { FileUploadContentType, ParsedCVData } from "@lazyapply/types";
import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CVDataModel } from "@/cvData/cvData.model.js";
import { OutboxModel } from "@/outbox/outbox.model.js";
import {
	updateOutboxBodySchema,
	updateOutboxStatus,
} from "@/routes/outbox/updateOutboxStatus.controller.js";

describe("Update Outbox Status", () => {
	let mockReq: Partial<Request>;
	let mockRes: Partial<Response>;
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
			// Create outbox entry
			const _outbox = await OutboxModel.create({
				processId: "test-process-txn-1",
				type: "file_upload",
				status: "processing",
				uploadId: "upload-id-txn-1",
				fileId: "test-file-txn-1",
				userId: "test-user-txn-1",
				fileType: "PDF" as FileUploadContentType,
			});

			const parsedData: ParsedCVData = {
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
			const cvData = await CVDataModel.findOne(
				{ uploadId: latestEntry.uploadId },
				null,
				{ skipOwnershipEnforcement: true },
			);
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
			await OutboxModel.create({
				processId: "test-process-no-data",
				type: "file_upload",
				status: "pending",
				uploadId: "upload-id-no-data",
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
			await OutboxModel.create({
				processId: "test-process-full-data",
				type: "file_upload",
				status: "processing",
				uploadId: "upload-id-full",
				fileId: "test-file-full",
				userId: "test-user-full",
				fileType: "PDF" as FileUploadContentType,
			});

			const fullParsedData: ParsedCVData = {
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

			const cvData = await CVDataModel.findOne(
				{ uploadId: "upload-id-full" },
				null,
				{ skipOwnershipEnforcement: true },
			);
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
			await OutboxModel.create({
				processId: "test-process-failed",
				type: "file_upload",
				status: "processing",
				uploadId: "upload-id-failed",
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
			const cvData = await CVDataModel.findOne(
				{ uploadId: "test-file-failed" },
				null,
				{ skipOwnershipEnforcement: true },
			);
			expect(cvData).toBeNull();
		});
	});

	describe("Not-a-CV Status", () => {
		it("should create not-a-cv outbox entry", async () => {
			await OutboxModel.create({
				processId: "test-process-not-a-cv",
				type: "file_upload",
				status: "processing",
				uploadId: "upload-id-not-a-cv",
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
			expect(latestEntry.promptTokens).toBe(100);
			expect(latestEntry.completionTokens).toBe(50);
			expect(latestEntry.totalTokens).toBe(150);

			// Verify no CV data was created
			const cvData = await CVDataModel.findOne(
				{ uploadId: "upload-id-not-a-cv" },
				null,
				{ skipOwnershipEnforcement: true },
			);
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
});
