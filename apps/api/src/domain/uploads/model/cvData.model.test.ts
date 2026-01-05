import type { ParsedCVData } from "@lazyapply/types";
import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { CVDataModel } from "./cvData.model.js";

describe("CVData Model", () => {
	describe("Create CV Data", () => {
		it("should create CV data from ParsedCVData structure", async () => {
			const mockParsedData: Omit<ParsedCVData, "fileId" | "_id"> = {
				personal: {
					fullName: "John Doe",
					firstName: "John",
					lastName: "Doe",
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
				headline: "Senior Software Engineer",
				summary: "Experienced software engineer",
				summaryFacts: [],
				profileSignals: {},
				experience: [
					{
						role: "Senior Developer",
						company: "Tech Corp",
						startDate: "2020-01",
						endDate: "2023-12",
						description: "Led development team",
						experienceFacts: [],
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

			const testUploadId = new mongoose.Types.ObjectId();
			const cvData = await CVDataModel.createCVData({
				uploadId: testUploadId.toString(),
				userId: "test-user-1",
				...mockParsedData,
			});

			expect(cvData.uploadId.toString()).toBe(testUploadId.toString());
			expect(cvData.userId).toBe("test-user-1");
			expect(cvData.personal.fullName).toBe("John Doe");
			expect(cvData.personal.firstName).toBe("John");
			expect(cvData.personal.lastName).toBe("Doe");
			expect(cvData.personal.email).toBe("john@example.com");
			expect(cvData.links).toHaveLength(2);
			expect(cvData.experience).toHaveLength(1);
			expect(cvData.education).toHaveLength(1);
			expect(cvData.certifications).toHaveLength(1);
			expect(cvData.languages).toHaveLength(2);
			expect(cvData.extras.remotePreference).toBe("hybrid");
		});

		it("should handle minimal CV data", async () => {
			const minimalData: Omit<ParsedCVData, "fileId" | "_id"> = {
				personal: {
					fullName: "Jane Smith",
					firstName: "Jane",
					lastName: "Smith",
					email: null,
					phone: null,
					location: null,
				},
				links: [],
				headline: null,
				summary: null,
				summaryFacts: [],
				profileSignals: {},
				experience: [],
				education: [],
				certifications: [],
				languages: [],
				extras: {},
				rawText: "Minimal CV text",
			};

			const testUploadId = new mongoose.Types.ObjectId();
			const cvData = await CVDataModel.createCVData({
				uploadId: testUploadId.toString(),
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
		it("should find by uploadId using findOne", async () => {
			const testUploadId = new mongoose.Types.ObjectId();
			await CVDataModel.createCVData({
				uploadId: testUploadId.toString(),
				userId: "test-user-3",
				personal: {
					fullName: "Test User",
					firstName: "Test",
					lastName: "User",
					email: null,
					phone: null,
					location: null,
				},
				links: [],
				headline: null,
				summary: null,
				summaryFacts: [],
				profileSignals: {},
				experience: [],
				education: [],
				certifications: [],
				languages: [],
				extras: {},
				rawText: "Test",
			});

			const found = await CVDataModel.findOne(
				{ uploadId: testUploadId },
				null,
				{ skipOwnershipEnforcement: true },
			);
			expect(found).toBeDefined();
			expect(found?.uploadId.toString()).toBe(testUploadId.toString());
		});

		it("should find by uploadId using findByUploadId static method with string", async () => {
			const testUploadId = new mongoose.Types.ObjectId();
			const userId = "test-user-findby-1";
			const cvData = await CVDataModel.createCVData({
				uploadId: testUploadId.toString(),
				userId,
				personal: {
					fullName: "FindBy Test User",
					firstName: "FindBy",
					lastName: "Test",
					email: null,
					phone: null,
					location: null,
				},
				links: [],
				headline: null,
				summary: null,
				summaryFacts: [],
				profileSignals: {},
				experience: [],
				education: [],
				certifications: [],
				languages: [],
				extras: {},
				rawText: "Test findByUploadId",
			});

			expect(cvData.uploadId).toBeInstanceOf(mongoose.Types.ObjectId);
			expect(cvData.uploadId.toString()).toBe(testUploadId.toString());

			const found = await CVDataModel.findByUploadId(
				testUploadId.toString(),
				userId,
			);
			expect(found).toBeDefined();
			expect(found?.uploadId).toBeInstanceOf(mongoose.Types.ObjectId);
			expect(found?.uploadId.toString()).toBe(testUploadId.toString());
			expect(found?.personal.fullName).toBe("FindBy Test User");
		});

		it("should find by userId", async () => {
			const userId = "test-user-4";
			const testUploadId1 = new mongoose.Types.ObjectId();
			await CVDataModel.createCVData({
				uploadId: testUploadId1.toString(),
				userId,
				personal: {
					fullName: "User 4A",
					firstName: "User",
					lastName: "4A",
					email: null,
					phone: null,
					location: null,
				},
				links: [],
				headline: null,
				summary: null,
				summaryFacts: [],
				profileSignals: {},
				experience: [],
				education: [],
				certifications: [],
				languages: [],
				extras: {},
				rawText: "Test A",
			});

			const testUploadId2 = new mongoose.Types.ObjectId();
			await CVDataModel.createCVData({
				uploadId: testUploadId2.toString(),
				userId,
				personal: {
					fullName: "User 4B",
					firstName: "User",
					lastName: "4B",
					email: null,
					phone: null,
					location: null,
				},
				links: [],
				headline: null,
				summary: null,
				summaryFacts: [],
				profileSignals: {},
				experience: [],
				education: [],
				certifications: [],
				languages: [],
				extras: {},
				rawText: "Test B",
			});

			const found = await CVDataModel.find({ userId }, null, {
				skipOwnershipEnforcement: true,
			});
			expect(found).toHaveLength(2);
		});
	});
});
