import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateCoverLetterController } from "./coverLetter.controller.js";

vi.mock("@/app/env.js", () => ({
	env: {
		LOG_LEVEL: "silent",
		NODE_ENV: "test",
	},
	getEnv: vi.fn(),
}));

describe("coverLetter.controller", () => {
	let mockReq: {
		user: { id: string };
		body: {
			autofillId: string;
			instructions?: string;
			settings?: {
				length: "short" | "medium" | "detailed";
				tone: "professional" | "warm" | "confident" | "friendly";
				format: "paragraph" | "bullet";
				language: "simple" | "neutral" | "advanced";
				cta: "none" | "minimal" | "strong";
				style:
					| "to the point"
					| "energetic"
					| "story-like"
					| "calm"
					| "formal"
					| "casual";
			};
		};
	};
	let mockRes: {
		status: ReturnType<typeof vi.fn>;
		json: ReturnType<typeof vi.fn>;
	};

	beforeEach(() => {
		vi.clearAllMocks();

		mockRes = {
			status: vi.fn().mockReturnThis(),
			json: vi.fn(),
		};

		mockReq = {
			user: { id: "test-user-id" },
			body: {
				autofillId: "test-autofill-id",
				instructions: "Highlight leadership experience",
				settings: {
					length: "medium",
					tone: "professional",
					format: "paragraph",
					language: "neutral",
					cta: "minimal",
					style: "to the point",
				},
			},
		};
	});

	describe("generateCoverLetterController", () => {
		it("should return placeholder cover letter with autofillId", async () => {
			await generateCoverLetterController(mockReq as never, mockRes as never);

			expect(mockRes.status).toHaveBeenCalledWith(200);
			expect(mockRes.json).toHaveBeenCalledWith({
				autofillId: "test-autofill-id",
				coverLetter: expect.stringContaining("Dear Hiring Manager"),
			});
		});

		it("should throw Unauthorized when user is missing", async () => {
			const reqWithoutUser = {
				...mockReq,
				user: undefined,
			};

			await expect(
				generateCoverLetterController(
					reqWithoutUser as never,
					mockRes as never,
				),
			).rejects.toThrow("Missing authenticated user");
		});

		it("should handle request without instructions", async () => {
			mockReq.body.instructions = undefined;

			await generateCoverLetterController(mockReq as never, mockRes as never);

			expect(mockRes.status).toHaveBeenCalledWith(200);
			expect(mockRes.json).toHaveBeenCalledWith({
				autofillId: "test-autofill-id",
				coverLetter: expect.any(String),
			});
		});

		it("should handle request without settings", async () => {
			mockReq.body.settings = undefined;

			await generateCoverLetterController(mockReq as never, mockRes as never);

			expect(mockRes.status).toHaveBeenCalledWith(200);
			expect(mockRes.json).toHaveBeenCalledWith({
				autofillId: "test-autofill-id",
				coverLetter: expect.any(String),
			});
		});

		it("should accept all valid tone options", async () => {
			const tones = ["professional", "warm", "confident", "friendly"] as const;

			for (const tone of tones) {
				if (mockReq.body.settings) {
					mockReq.body.settings = {
						...mockReq.body.settings,
						tone,
					};
				}

				await generateCoverLetterController(mockReq as never, mockRes as never);

				expect(mockRes.status).toHaveBeenCalledWith(200);
			}
		});

		it("should accept all valid length options", async () => {
			const lengths = ["short", "medium", "detailed"] as const;

			for (const length of lengths) {
				if (mockReq.body.settings) {
					mockReq.body.settings = {
						...mockReq.body.settings,
						length,
					};
				}

				await generateCoverLetterController(mockReq as never, mockRes as never);

				expect(mockRes.status).toHaveBeenCalledWith(200);
			}
		});

		it("should accept all valid format options", async () => {
			const formats = ["paragraph", "bullet"] as const;

			for (const format of formats) {
				if (mockReq.body.settings) {
					mockReq.body.settings = {
						...mockReq.body.settings,
						format,
					};
				}

				await generateCoverLetterController(mockReq as never, mockRes as never);

				expect(mockRes.status).toHaveBeenCalledWith(200);
			}
		});

		it("should accept all valid language options", async () => {
			const languages = ["simple", "neutral", "advanced"] as const;

			for (const language of languages) {
				if (mockReq.body.settings) {
					mockReq.body.settings = {
						...mockReq.body.settings,
						language,
					};
				}

				await generateCoverLetterController(mockReq as never, mockRes as never);

				expect(mockRes.status).toHaveBeenCalledWith(200);
			}
		});

		it("should accept all valid cta options", async () => {
			const ctas = ["none", "minimal", "strong"] as const;

			for (const cta of ctas) {
				if (mockReq.body.settings) {
					mockReq.body.settings = {
						...mockReq.body.settings,
						cta,
					};
				}

				await generateCoverLetterController(mockReq as never, mockRes as never);

				expect(mockRes.status).toHaveBeenCalledWith(200);
			}
		});

		it("should accept all valid style options", async () => {
			const styles = [
				"to the point",
				"energetic",
				"story-like",
				"calm",
				"formal",
				"casual",
			] as const;

			for (const style of styles) {
				if (mockReq.body.settings) {
					mockReq.body.settings = {
						...mockReq.body.settings,
						style,
					};
				}

				await generateCoverLetterController(mockReq as never, mockRes as never);

				expect(mockRes.status).toHaveBeenCalledWith(200);
			}
		});

		it("should handle different autofillIds", async () => {
			const autofillIds = ["autofill-123", "autofill-456", "test-autofill-789"];

			for (const autofillId of autofillIds) {
				mockReq.body.autofillId = autofillId;

				await generateCoverLetterController(mockReq as never, mockRes as never);

				expect(mockRes.json).toHaveBeenCalledWith(
					expect.objectContaining({
						autofillId,
					}),
				);
			}
		});
	});
});
