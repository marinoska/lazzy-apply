import { secureCompare } from "@lazyapply/utils";
import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Security Test Suite
 *
 * This test suite verifies security-critical functionality across the application.
 * Tests are organized by security concern rather than by module.
 */

describe("Security", () => {
	describe("Timing Attack Prevention", () => {
		/**
		 * Verifies that secret comparisons use constant-time algorithms
		 * to prevent timing-based side-channel attacks.
		 */

		it("should use shared secureCompare from @lazyapply/utils (authenticateWorker)", async () => {
			// Read the actual source to verify implementation
			const fs = await import("node:fs/promises");
			const path = await import("node:path");
			const filePath = path.join(
				__dirname,
				"app/middleware/authenticateWorker.ts",
			);
			const source = await fs.readFile(filePath, "utf-8");

			// Verify secureCompare is imported from shared package
			expect(source).toContain(
				'import { secureCompare } from "@lazyapply/utils"',
			);

			// Verify direct string comparison is NOT used for the secret
			expect(source).not.toMatch(/authHeader\s*!==\s*workerSecret/);
			expect(source).not.toMatch(/authHeader\s*===\s*workerSecret/);

			// Verify secureCompare is used
			expect(source).toContain("secureCompare(authHeader, workerSecret)");
		});

		it("should use shared secureCompare from @lazyapply/utils (uploadHandler)", async () => {
			const fs = await import("node:fs/promises");
			const path = await import("node:path");
			const filePath = path.resolve(
				__dirname,
				"../../upload-queue-consumer/src/lib/uploadHandler.ts",
			);
			const source = await fs.readFile(filePath, "utf-8");

			// Verify secureCompare is imported from shared package
			expect(source).toContain(
				'import { secureCompare } from "@lazyapply/utils"',
			);

			// Verify direct string comparison is NOT used
			expect(source).not.toMatch(/extensionKey\s*!==\s*env\.EXTENSION_SECRET/);

			// Verify secureCompare is used
			expect(source).toContain(
				"secureCompare(extensionKey, env.EXTENSION_SECRET)",
			);
		});

		it("secureCompare should return false for different strings in constant time", () => {
			// Test the shared secureCompare function
			expect(secureCompare("secret123", "secret123")).toBe(true);
			expect(secureCompare("secret123", "secret124")).toBe(false);
			expect(secureCompare("secret123", "different")).toBe(false);
			expect(secureCompare("short", "muchlongerstring")).toBe(false);
			expect(secureCompare("", "")).toBe(true);
			expect(secureCompare("a", "")).toBe(false);
		});

		it("should handle empty and null-like inputs safely", () => {
			expect(secureCompare("", "")).toBe(true);
			expect(secureCompare("secret", "")).toBe(false);
			expect(secureCompare("", "secret")).toBe(false);
		});
	});

	describe("Authentication Middleware", () => {
		describe("Worker Authentication", () => {
			let mockReq: Partial<Request>;
			let mockRes: Partial<Response>;
			let mockNext: NextFunction;

			beforeEach(() => {
				mockReq = {
					header: vi.fn(),
				};
				mockRes = {
					status: vi.fn().mockReturnThis(),
					json: vi.fn().mockReturnThis(),
				};
				mockNext = vi.fn();
			});

			it("should reject requests without X-Worker-Secret header", async () => {
				const { authenticateWorker } = await import(
					"./app/middleware/authenticateWorker.js"
				);

				(mockReq.header as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

				await expect(
					authenticateWorker(mockReq as Request, mockRes as Response, mockNext),
				).rejects.toThrow("Missing worker authentication header");

				expect(mockNext).not.toHaveBeenCalled();
			});

			it("should reject requests with invalid worker secret", async () => {
				const { authenticateWorker } = await import(
					"./app/middleware/authenticateWorker.js"
				);

				(mockReq.header as ReturnType<typeof vi.fn>).mockReturnValue(
					"wrong-secret",
				);

				await expect(
					authenticateWorker(mockReq as Request, mockRes as Response, mockNext),
				).rejects.toThrow("Invalid worker authentication token");

				expect(mockNext).not.toHaveBeenCalled();
			});

			it("should accept requests with valid worker secret", async () => {
				const { authenticateWorker } = await import(
					"./app/middleware/authenticateWorker.js"
				);

				// Use the test secret from vitest.config.ts
				(mockReq.header as ReturnType<typeof vi.fn>).mockReturnValue(
					"test-worker-secret",
				);

				await authenticateWorker(
					mockReq as Request,
					mockRes as Response,
					mockNext,
				);

				expect(mockNext).toHaveBeenCalled();
			});
		});

		describe("User Authentication", () => {
			let mockReq: Partial<Request>;
			let mockRes: Partial<Response>;
			let mockNext: NextFunction;

			beforeEach(() => {
				mockReq = {
					header: vi.fn(),
				};
				mockRes = {};
				mockNext = vi.fn();
			});

			it("should reject requests without Authorization header", async () => {
				const { authenticateUser } = await import(
					"./app/middleware/authenticateUser.js"
				);

				(mockReq.header as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

				await expect(
					authenticateUser(mockReq as Request, mockRes as Response, mockNext),
				).rejects.toThrow("Missing Authorization header");
			});

			it("should reject non-Bearer tokens", async () => {
				const { authenticateUser } = await import(
					"./app/middleware/authenticateUser.js"
				);

				(mockReq.header as ReturnType<typeof vi.fn>).mockReturnValue(
					"Basic dXNlcjpwYXNz",
				);

				await expect(
					authenticateUser(mockReq as Request, mockRes as Response, mockNext),
				).rejects.toThrow("Authorization header must be a Bearer token");
			});

			it("should reject malformed Bearer tokens", async () => {
				const { authenticateUser } = await import(
					"./app/middleware/authenticateUser.js"
				);

				(mockReq.header as ReturnType<typeof vi.fn>).mockReturnValue("Bearer");

				await expect(
					authenticateUser(mockReq as Request, mockRes as Response, mockNext),
				).rejects.toThrow("Authorization header must be a Bearer token");
			});
		});
	});

	describe("Input Validation", () => {
		describe("File Upload Validation", () => {
			it("should only allow PDF and DOCX content types", async () => {
				const { initUploadRequestSchema } = await import(
					"./routes/uploads/initUpload.controller.js"
				);

				// Valid content types
				expect(() =>
					initUploadRequestSchema.parse({
						originalFilename: "resume.pdf",
						contentType: "PDF",
						userId: "user-123",
						userEmail: "test@example.com",
					}),
				).not.toThrow();

				expect(() =>
					initUploadRequestSchema.parse({
						originalFilename: "resume.docx",
						contentType: "DOCX",
						userId: "user-123",
						userEmail: "test@example.com",
					}),
				).not.toThrow();

				// Invalid content type
				expect(() =>
					initUploadRequestSchema.parse({
						originalFilename: "malware.exe",
						contentType: "EXE",
						userId: "user-123",
						userEmail: "test@example.com",
					}),
				).toThrow();
			});

			it("should require valid UUID for fileId in finalize", async () => {
				const { finalizeUploadRequestSchema } = await import(
					"./routes/uploads/finalizeUpload.controller.js"
				);

				// Invalid UUID
				expect(() =>
					finalizeUploadRequestSchema.parse({
						fileId: "not-a-uuid",
						size: 1024,
						rawText: "Some text",
					}),
				).toThrow();

				// Path traversal attempt in fileId
				expect(() =>
					finalizeUploadRequestSchema.parse({
						fileId: "../../../etc/passwd",
						size: 1024,
						rawText: "Some text",
					}),
				).toThrow();
			});

			it("should require valid email format in init", async () => {
				const { initUploadRequestSchema } = await import(
					"./routes/uploads/initUpload.controller.js"
				);

				expect(() =>
					initUploadRequestSchema.parse({
						originalFilename: "resume.pdf",
						contentType: "PDF",
						userId: "user-123",
						userEmail: "not-an-email",
					}),
				).toThrow();
			});

			it("should require positive file size in finalize", async () => {
				const { finalizeUploadRequestSchema } = await import(
					"./routes/uploads/finalizeUpload.controller.js"
				);

				expect(() =>
					finalizeUploadRequestSchema.parse({
						fileId: "550e8400-e29b-41d4-a716-446655440000",
						size: -1,
						rawText: "Some text",
					}),
				).toThrow();

				expect(() =>
					finalizeUploadRequestSchema.parse({
						fileId: "550e8400-e29b-41d4-a716-446655440000",
						size: 0,
						rawText: "Some text",
					}),
				).toThrow();
			});
		});

		describe("Delete Upload Validation", () => {
			it("should require valid UUID for fileId parameter", async () => {
				const { deleteUploadParamsSchema } = await import(
					"./routes/uploads/deleteUpload.controller.js"
				);

				expect(() =>
					deleteUploadParamsSchema.parse({ fileId: "not-a-uuid" }),
				).toThrow();

				expect(() =>
					deleteUploadParamsSchema.parse({
						fileId: "550e8400-e29b-41d4-a716-446655440000",
					}),
				).not.toThrow();
			});
		});
	});

	describe("Sensitive Data Protection", () => {
		it("should not log CV content in extractCVData error handling", async () => {
			const fs = await import("node:fs/promises");
			const path = await import("node:path");

			// Check upload-queue-consumer extractCVData.ts
			const extractCVDataPath = path.resolve(
				__dirname,
				"../../upload-queue-consumer/src/lib/extractCVData.ts",
			);
			const source = await fs.readFile(extractCVDataPath, "utf-8");

			// Should NOT contain CV text preview logging
			expect(source).not.toContain("cvText.substring");
			expect(source).not.toContain('CV text preview"');

			// Should contain safe metadata logging
			expect(source).toContain("cvTextLength");
		});

		it("should not log request headers in authenticateWorker", async () => {
			const fs = await import("node:fs/promises");
			const path = await import("node:path");

			const filePath = path.join(
				__dirname,
				"app/middleware/authenticateWorker.ts",
			);
			const source = await fs.readFile(filePath, "utf-8");

			// Should NOT log full headers
			expect(source).not.toContain("req.headers");
			expect(source).not.toContain("Headers:");
		});

		it("should not use console.log in API middleware", async () => {
			const fs = await import("node:fs/promises");
			const path = await import("node:path");

			const filePath = path.join(
				__dirname,
				"app/middleware/authenticateWorker.ts",
			);
			const source = await fs.readFile(filePath, "utf-8");

			// Should use logger, not console
			expect(source).not.toMatch(/console\.(log|error|warn)/);
			expect(source).toContain('createLogger("authenticateWorker")');
		});
	});

	describe("Authorization", () => {
		describe("Ownership Enforcement", () => {
			it("should enforce userId on user-facing queries", async () => {
				const fs = await import("node:fs/promises");
				const path = await import("node:path");

				// Check deleteUpload controller
				const deleteControllerPath = path.join(
					__dirname,
					"routes/uploads/deleteUpload.controller.ts",
				);
				const source = await fs.readFile(deleteControllerPath, "utf-8");

				// Should pass userId to query for ownership enforcement
				expect(source).toContain("user.id");
				expect(source).toContain("findDeletableByFileId");
			});

			it("should skip ownership for worker routes with explicit flag", async () => {
				const fs = await import("node:fs/promises");
				const path = await import("node:path");

				// Check getRawText controller (worker route)
				const getRawTextPath = path.join(
					__dirname,
					"routes/uploads/getRawText.controller.ts",
				);
				const source = await fs.readFile(getRawTextPath, "utf-8");

				// Should explicitly skip ownership for worker access
				expect(source).toContain("skipOwnershipEnforcement: true");
			});
		});
	});

	describe("Route Protection", () => {
		it("should apply authenticateWorker to all /worker routes", async () => {
			const fs = await import("node:fs/promises");
			const path = await import("node:path");

			const routesPath = path.join(__dirname, "routes/index.ts");
			const source = await fs.readFile(routesPath, "utf-8");

			// Worker router should use authenticateWorker middleware
			expect(source).toContain("workerRouter.use(authenticateWorker)");

			// Worker routes should be mounted under /worker
			expect(source).toContain('app.use("/worker", workerRouter)');
		});

		it("should apply authenticateUser to all user routes", async () => {
			const fs = await import("node:fs/promises");
			const path = await import("node:path");

			const routesPath = path.join(__dirname, "routes/index.ts");
			const source = await fs.readFile(routesPath, "utf-8");

			// User router should use authenticateUser middleware
			expect(source).toContain("userRouter.use(authenticateUser)");
		});

		it("should use validateRequest middleware on all routes with schemas", async () => {
			const fs = await import("node:fs/promises");
			const path = await import("node:path");

			const routesPath = path.join(__dirname, "routes/index.ts");
			const source = await fs.readFile(routesPath, "utf-8");

			// All routes with schemas should use validateRequest
			expect(source).toContain(
				"validateRequest({ body: initUploadRequestSchema })",
			);
			expect(source).toContain(
				"validateRequest({ body: finalizeUploadRequestSchema })",
			);
			expect(source).toContain(
				"validateRequest({ params: getRawTextParamsSchema })",
			);
			expect(source).toContain(
				"validateRequest({ params: deleteUploadParamsSchema })",
			);
			expect(source).toContain(
				"validateRequest({ query: getUploadsQuerySchema })",
			);
			expect(source).toContain(
				"validateRequest({ body: classifyFormFieldsBodySchema })",
			);
		});
	});

	describe("Security Headers", () => {
		it("should use helmet middleware", async () => {
			const fs = await import("node:fs/promises");
			const path = await import("node:path");

			const appPath = path.join(__dirname, "app/createApp.ts");
			const source = await fs.readFile(appPath, "utf-8");

			expect(source).toContain('import helmet from "helmet"');
			expect(source).toContain("app.use(");
			expect(source).toContain("helmet(");
		});

		it("should disable x-powered-by header", async () => {
			const fs = await import("node:fs/promises");
			const path = await import("node:path");

			const appPath = path.join(__dirname, "app/createApp.ts");
			const source = await fs.readFile(appPath, "utf-8");

			expect(source).toContain('app.disable("x-powered-by")');
		});
	});
});
