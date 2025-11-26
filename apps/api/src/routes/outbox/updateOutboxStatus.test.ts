import { describe, it, expect, beforeEach, vi } from "vitest";
import { OutboxModel } from "@/outbox/outbox.model.js";
import { CVDataModel } from "@/cvData/cvData.model.js";
import { updateOutboxStatus, updateOutboxBodySchema } from "@/routes/outbox/updateOutboxStatus.js";
import type { Request, Response } from "express";
import type { ParsedCVData, FileUploadContentType } from "@lazyapply/types";

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
		it("should mark outbox as completed and save CV data in transaction", async () => {
			// Create outbox entry
			const outbox = await OutboxModel.create({
				logId: "test-log-txn-1",
				type: "file_upload",
				status: "pending",
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
				summary: "Test summary",
				experience: [],
				education: [],
				certifications: [],
				languages: [],
				extras: {},
				rawText: "Test CV content",
			};

			mockReq = {
				params: { logId: "test-log-txn-1" },
				body: {
					status: "completed",
					data: parsedData,
				},
			};

			await updateOutboxStatus(mockReq, mockRes);

			// Verify outbox was updated
			const updatedOutbox = await OutboxModel.findOne({ logId: "test-log-txn-1" });
			expect(updatedOutbox?.status).toBe("completed");
			expect(updatedOutbox?.processedAt).toBeDefined();

			// Verify CV data was saved (skip ownership enforcement for test)
			const cvData = await CVDataModel.findOne(
				{ uploadId: updatedOutbox.uploadId },
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
				success: true,
				logId: "test-log-txn-1",
				status: "completed",
			});
		});

		it("should reject completed status without data", async () => {
			await OutboxModel.create({
				logId: "test-log-no-data",
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

			// Verify outbox was not updated
			const outbox = await OutboxModel.findOne({ logId: "test-log-no-data" });
			expect(outbox?.status).toBe("pending");
		});

		it("should save all ParsedCVData fields correctly", async () => {
			await OutboxModel.create({
				logId: "test-log-full-data",
				type: "file_upload",
				status: "pending",
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
				params: { logId: "test-log-full-data" },
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
		it("should mark outbox as failed with error message", async () => {
			await OutboxModel.create({
				logId: "test-log-failed",
				type: "file_upload",
				status: "pending",
				uploadId: "upload-id-failed",
				fileId: "test-file-failed",
				userId: "test-user-failed",
				fileType: "PDF",
			});

			mockReq = {
				params: { logId: "test-log-failed" },
				body: {
					status: "failed",
					error: "Processing failed due to invalid format",
				},
			};

			await updateOutboxStatus(mockReq, mockRes);

			const updatedOutbox = await OutboxModel.findOne({ logId: "test-log-failed" });
			expect(updatedOutbox?.status).toBe("failed");
			expect(updatedOutbox?.error).toBe("Processing failed due to invalid format");
			expect(updatedOutbox?.processedAt).toBeDefined();

			// Verify no CV data was created
			const cvData = await CVDataModel.findOne(
				{ uploadId: "test-file-failed" },
				null,
				{ skipOwnershipEnforcement: true },
			);
			expect(cvData).toBeNull();
		});
	});

	describe("Error Handling", () => {
		it("should throw NotFound error for non-existent logId", async () => {
			mockReq = {
				params: { logId: "non-existent-log" },
				body: {
					status: "completed",
				},
			};

			await expect(
				updateOutboxStatus(mockReq, mockRes),
			).rejects.toThrow("Outbox entry not found");
		});
	});
});
