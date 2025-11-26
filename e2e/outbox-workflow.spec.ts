import { test, expect } from "@playwright/test";
import type { ParsedCVData } from "@lazyapply/types";

test.describe("Outbox and CV Data Workflow", () => {
	test("should complete full file upload and CV parsing workflow", async ({
		request,
	}) => {
		// This test simulates the full workflow:
		// 1. File upload creates outbox entry
		// 2. Worker processes file and sends parsed data
		// 3. API saves outbox completion and CV data in transaction

		const logId = `test-log-${Date.now()}`;
		const fileId = `test-file-${Date.now()}`;
		const userId = "test-user-e2e";

		// Simulate worker callback with parsed CV data
		const parsedData: ParsedCVData = {
			fileId,
			personal: {
				fullName: "E2E Test User",
				email: "e2e@test.com",
				phone: "+1234567890",
				location: "Test City, USA",
				nationality: "US",
				rightToWork: "US Citizen",
			},
			links: [
				{ type: "linkedin", url: "https://linkedin.com/in/e2etest" },
				{ type: "github", url: "https://github.com/e2etest" },
			],
			summary: "E2E test user with extensive experience",
			experience: [
				{
					role: "Senior Software Engineer",
					company: "Test Corp",
					startDate: "2020-01",
					endDate: "2024-01",
					description: "Led development of test systems",
				},
			],
			education: [
				{
					degree: "BS Computer Science",
					field: "Computer Science",
					institution: "Test University",
					startDate: "2016",
					endDate: "2020",
				},
			],
			certifications: [
				{
					name: "AWS Certified Developer",
					issuer: "Amazon",
					date: "2022-06",
				},
			],
			languages: [
				{ language: "English", level: "native" },
				{ language: "Spanish", level: "professional" },
			],
			extras: {
				drivingLicense: "Yes",
				workPermit: "US",
				willingToRelocate: true,
				remotePreference: "hybrid",
				noticePeriod: "2 weeks",
				availability: "Immediate",
				salaryExpectation: "$150k",
			},
			rawText: "Full CV text content for E2E test...",
		};

		// Update outbox status with parsed data
		const response = await request.patch(`/api/outbox/${logId}`, {
			data: {
				status: "completed",
				data: parsedData,
			},
		});

		expect(response.ok()).toBeTruthy();
		const result = await response.json();
		expect(result.success).toBe(true);
		expect(result.status).toBe("completed");
	});

	test("should handle failed processing correctly", async ({ request }) => {
		const logId = `test-log-failed-${Date.now()}`;

		const response = await request.patch(`/api/outbox/${logId}`, {
			data: {
				status: "failed",
				error: "File type validation failed",
			},
		});

		expect(response.ok()).toBeTruthy();
		const result = await response.json();
		expect(result.success).toBe(true);
		expect(result.status).toBe("failed");
	});

	test("should reject invalid file types", async ({ request }) => {
		const logId = `test-log-invalid-${Date.now()}`;

		// Attempt to create outbox with invalid file type
		const response = await request.post("/api/outbox", {
			data: {
				logId,
				type: "file_upload",
				fileId: "test-file",
				userId: "test-user",
				fileType: "txt", // Invalid - should be uppercase
			},
		});

		expect(response.ok()).toBeFalsy();
	});
});
