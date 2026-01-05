import type { ParsedCVData } from "@lazyapply/types";
import { describe, expect, it } from "vitest";
import { extractValueByPath, isPathInCVData } from "./cvDataExtractor.llm.js";

const mockCVData: ParsedCVData = {
	_id: "mock-cv-id",
	personal: {
		fullName: "John Doe",
		firstName: "John",
		lastName: "Doe",
		email: "john@example.com",
		phone: "+1234567890",
		location: "New York, NY",
		nationality: "American",
		rightToWork: "US Citizen",
	},
	links: [
		{ type: "linkedin", url: "https://linkedin.com/in/johndoe" },
		{ type: "github", url: "https://github.com/johndoe" },
		{ type: "portfolio", url: "https://johndoe.dev" },
	],
	headline: "Senior Software Engineer",
	summary: "Experienced developer with 10+ years in web development.",
	summaryFacts: [],
	profileSignals: {},
	experience: [
		{
			role: "Senior Engineer",
			company: "Tech Corp",
			startDate: "2020-01",
			endDate: "Present",
			description: "Led development of core platform.",
			experienceFacts: [],
		},
		{
			role: "Software Engineer",
			company: "Startup Inc",
			startDate: "2018-01",
			endDate: "2019-12",
			description: "Built microservices architecture.",
			experienceFacts: [],
		},
	],
	education: [
		{
			degree: "Bachelor of Science",
			field: "Computer Science",
			institution: "MIT",
			startDate: "2010",
			endDate: "2014",
		},
	],
	certifications: [
		{ name: "AWS Solutions Architect", issuer: "Amazon", date: "2022" },
	],
	languages: [
		{ language: "English", level: "Native" },
		{ language: "Spanish", level: "Intermediate" },
	],
	extras: {
		drivingLicense: "Class B",
		workPermit: "US Work Authorization",
		willingToRelocate: true,
		remotePreference: "Remote preferred",
		noticePeriod: "2 weeks",
		availability: "Immediately",
		salaryExpectation: "$150,000 - $180,000",
	},
	rawText: "Full CV text...",
};

describe("cvDataExtractor.llm", () => {
	describe("isPathInCVData", () => {
		it("should return true for CV data paths", () => {
			expect(isPathInCVData("personal.fullName")).toBe(true);
			expect(isPathInCVData("personal.email")).toBe(true);
			expect(isPathInCVData("links")).toBe(true);
			expect(isPathInCVData("summary")).toBe(true);
			expect(isPathInCVData("experience")).toBe(true);
			expect(isPathInCVData("extras.salaryExpectation")).toBe(true);
		});

		it("should return false for inferred paths", () => {
			expect(isPathInCVData("resume_upload")).toBe(false);
			expect(isPathInCVData("cover_letter")).toBe(false);
			expect(isPathInCVData("motivation_text")).toBe(false);
			expect(isPathInCVData("unknown")).toBe(false);
		});
	});

	describe("extractValueByPath", () => {
		describe("personal fields", () => {
			it("should extract personal.fullName", () => {
				expect(extractValueByPath(mockCVData, "personal.fullName")).toBe(
					"John Doe",
				);
			});

			it("should extract personal.email", () => {
				expect(extractValueByPath(mockCVData, "personal.email")).toBe(
					"john@example.com",
				);
			});

			it("should extract personal.phone", () => {
				expect(extractValueByPath(mockCVData, "personal.phone")).toBe(
					"+1234567890",
				);
			});

			it("should extract personal.location", () => {
				expect(extractValueByPath(mockCVData, "personal.location")).toBe(
					"New York, NY",
				);
			});

			it("should extract personal.nationality", () => {
				expect(extractValueByPath(mockCVData, "personal.nationality")).toBe(
					"American",
				);
			});

			it("should extract personal.rightToWork", () => {
				expect(extractValueByPath(mockCVData, "personal.rightToWork")).toBe(
					"US Citizen",
				);
			});

			it("should extract personal.firstName", () => {
				expect(extractValueByPath(mockCVData, "personal.firstName")).toBe(
					"John",
				);
			});

			it("should extract personal.lastName", () => {
				expect(extractValueByPath(mockCVData, "personal.lastName")).toBe("Doe");
			});

			it("should return null for missing firstName/lastName", () => {
				const cvDataWithoutNames: ParsedCVData = {
					...mockCVData,
					personal: {
						...mockCVData.personal,
						firstName: undefined,
						lastName: undefined,
					},
				};
				expect(
					extractValueByPath(cvDataWithoutNames, "personal.firstName"),
				).toBeNull();
				expect(
					extractValueByPath(cvDataWithoutNames, "personal.lastName"),
				).toBeNull();
			});
		});

		describe("links", () => {
			it("should extract linkedin URL by linkType", () => {
				expect(extractValueByPath(mockCVData, "links", "linkedin")).toBe(
					"https://linkedin.com/in/johndoe",
				);
			});

			it("should extract github URL by linkType", () => {
				expect(extractValueByPath(mockCVData, "links", "github")).toBe(
					"https://github.com/johndoe",
				);
			});

			it("should return null for missing linkType", () => {
				expect(extractValueByPath(mockCVData, "links")).toBeNull();
			});

			it("should return null for non-existent link type", () => {
				expect(extractValueByPath(mockCVData, "links", "twitter")).toBeNull();
			});

			it("should match linkType case-insensitively", () => {
				expect(extractValueByPath(mockCVData, "links", "LinkedIn")).toBe(
					"https://linkedin.com/in/johndoe",
				);
			});
		});

		describe("simple string fields", () => {
			it("should extract headline", () => {
				expect(extractValueByPath(mockCVData, "headline")).toBe(
					"Senior Software Engineer",
				);
			});

			it("should extract summary", () => {
				expect(extractValueByPath(mockCVData, "summary")).toBe(
					"Experienced developer with 10+ years in web development.",
				);
			});
		});

		describe("array fields", () => {
			it("should format experience as text", () => {
				const result = extractValueByPath(mockCVData, "experience");
				expect(result).toContain("Senior Engineer");
				expect(result).toContain("Tech Corp");
				expect(result).toContain("Led development of core platform");
			});

			it("should format education as text", () => {
				const result = extractValueByPath(mockCVData, "education");
				expect(result).toContain("Bachelor of Science");
				expect(result).toContain("Computer Science");
				expect(result).toContain("MIT");
			});

			it("should format certifications as text", () => {
				const result = extractValueByPath(mockCVData, "certifications");
				expect(result).toContain("AWS Solutions Architect");
				expect(result).toContain("Amazon");
			});

			it("should format languages as comma-separated list", () => {
				const result = extractValueByPath(mockCVData, "languages");
				expect(result).toBe("English (Native), Spanish (Intermediate)");
			});
		});

		describe("extras fields", () => {
			it("should extract extras.drivingLicense", () => {
				expect(extractValueByPath(mockCVData, "extras.drivingLicense")).toBe(
					"Class B",
				);
			});

			it("should extract extras.willingToRelocate as string", () => {
				expect(extractValueByPath(mockCVData, "extras.willingToRelocate")).toBe(
					"true",
				);
			});

			it("should extract extras.salaryExpectation", () => {
				expect(extractValueByPath(mockCVData, "extras.salaryExpectation")).toBe(
					"$150,000 - $180,000",
				);
			});
		});

		describe("null values", () => {
			it("should return null for missing personal fields", () => {
				const emptyCVData: ParsedCVData = {
					_id: "empty-cv-id",
					personal: {
						fullName: null,
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
					rawText: "",
				};

				expect(extractValueByPath(emptyCVData, "personal.fullName")).toBeNull();
				expect(extractValueByPath(emptyCVData, "headline")).toBeNull();
				expect(extractValueByPath(emptyCVData, "experience")).toBeNull();
			});
		});
	});
});
