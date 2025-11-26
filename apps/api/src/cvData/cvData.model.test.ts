import { describe, it, expect } from "vitest";
import { CVDataModel } from "@/cvData/cvData.model.js";
import type { ParsedCVData } from "@lazyapply/types";

describe("CVData Model", () => {
	describe("Create CV Data", () => {
		it("should create CV data from ParsedCVData structure", async () => {
			const mockParsedData: Omit<ParsedCVData, "fileId"> = {
				personal: {
					fullName: "John Doe",
					email: "john@example.com",
					phone: "+1234567890",
					location: "New York, USA",
					nationality: "US",
					rightToWork: "US Citizen",
				},
				links: [
					{ type: "linkedin", url: "https://linkedin.com/in/johndoe" },
					{ type: "github", url: "https://github.com/johndoe" },
				],
				summary: "Experienced software engineer",
				experience: [
					{
						role: "Senior Developer",
						company: "Tech Corp",
						startDate: "2020-01",
						endDate: "2023-12",
						description: "Led development team",
					},
				],
				education: [
					{
						degree: "BS Computer Science",
						field: "Computer Science",
						institution: "MIT",
						startDate: "2016",
						endDate: "2020",
					},
				],
				certifications: [
					{
						name: "AWS Certified",
						issuer: "Amazon",
						date: "2022-06",
					},
				],
				languages: [
					{ language: "English", level: "native" },
					{ language: "Spanish", level: "intermediate" },
				],
				extras: {
					drivingLicense: "Yes",
					workPermit: "US",
					willingToRelocate: true,
					remotePreference: "hybrid",
					noticePeriod: "2 weeks",
					availability: "Immediate",
					salaryExpectation: "$120k",
				},
				rawText: "Full CV text here...",
			};

			const cvData = await CVDataModel.createCVData({
				uploadId: "test-upload-1",
				userId: "test-user-1",
				...mockParsedData,
			});

			expect(cvData.uploadId).toBe("test-upload-1");
			expect(cvData.userId).toBe("test-user-1");
			expect(cvData.personal.fullName).toBe("John Doe");
			expect(cvData.personal.email).toBe("john@example.com");
			expect(cvData.links).toHaveLength(2);
			expect(cvData.experience).toHaveLength(1);
			expect(cvData.education).toHaveLength(1);
			expect(cvData.certifications).toHaveLength(1);
			expect(cvData.languages).toHaveLength(2);
			expect(cvData.extras.remotePreference).toBe("hybrid");
		});

		it("should handle minimal CV data", async () => {
			const minimalData: Omit<ParsedCVData, "fileId"> = {
				personal: {
					fullName: "Jane Smith",
					email: null,
					phone: null,
					location: null,
				},
				links: [],
				summary: null,
				experience: [],
				education: [],
				certifications: [],
				languages: [],
				extras: {},
				rawText: "Minimal CV text",
			};

			const cvData = await CVDataModel.createCVData({
				uploadId: "test-upload-2",
				userId: "test-user-2",
				...minimalData,
			});

			expect(cvData.personal.fullName).toBe("Jane Smith");
			expect(cvData.personal.email).toBeNull();
			expect(cvData.links).toHaveLength(0);
			expect(cvData.experience).toHaveLength(0);
		});
	});

	describe("Query CV Data", () => {
		it("should find by uploadId", async () => {
			await CVDataModel.createCVData({
				uploadId: "test-upload-3",
				userId: "test-user-3",
				personal: { fullName: "Test User", email: null, phone: null, location: null },
				links: [],
				summary: null,
				experience: [],
				education: [],
				certifications: [],
				languages: [],
				extras: {},
				rawText: "Test",
			});

			const found = await CVDataModel.findOne(
				{ uploadId: "test-upload-3" },
				null,
				{ skipOwnershipEnforcement: true },
			);
			expect(found).toBeDefined();
			expect(found?.uploadId).toBe("test-upload-3");
		});

		it("should find by userId", async () => {
			const userId = "test-user-4";
			await CVDataModel.createCVData({
				uploadId: "test-upload-4a",
				userId,
				personal: { fullName: "User 4A", email: null, phone: null, location: null },
				links: [],
				summary: null,
				experience: [],
				education: [],
				certifications: [],
				languages: [],
				extras: {},
				rawText: "Test A",
			});

			await CVDataModel.createCVData({
				uploadId: "test-upload-4b",
				userId,
				personal: { fullName: "User 4B", email: null, phone: null, location: null },
				links: [],
				summary: null,
				experience: [],
				education: [],
				certifications: [],
				languages: [],
				extras: {},
				rawText: "Test B",
			});

			const found = await CVDataModel.find(
				{ userId },
				null,
				{ skipOwnershipEnforcement: true },
			);
			expect(found).toHaveLength(2);
		});
	});
});
