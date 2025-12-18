import type { FileUploadContentType } from "@lazyapply/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as cloudflare from "@/app/cloudflare.js";
import { FileUploadModel } from "@/domain/uploads/model/fileUpload.model.js";
import { downloadUploadController } from "./downloadUpload.controller.js";

vi.mock("@/app/cloudflare.js", () => ({
	getPresignedDownloadUrl: vi.fn(),
}));

vi.mock("@/app/env.js", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/app/env.js")>();
	return {
		...actual,
		getEnv: vi.fn(() => "test-bucket"),
	};
});

describe("Download Upload", () => {
	let mockReq: { params: { fileId: string }; user?: { id: string } };
	let mockRes: { json: ReturnType<typeof vi.fn> };
	let jsonMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		jsonMock = vi.fn();
		mockRes = {
			json: jsonMock,
		};
		vi.clearAllMocks();
	});

	describe("Successful Download", () => {
		it("should return presigned download URL for uploaded file", async () => {
			const userId = "test-user-download-1";
			const fileId = "test-file-download-1";

			await FileUploadModel.create({
				fileId,
				objectKey: "cv/test-key-1.pdf",
				originalFilename: "my-resume.pdf",
				contentType: "PDF" satisfies FileUploadContentType,
				directory: "cv",
				bucket: "test-bucket",
				userId,
				status: "uploaded",
				uploadUrlExpiresAt: new Date(Date.now() + 3600000),
			});

			vi.mocked(cloudflare.getPresignedDownloadUrl).mockResolvedValue(
				"https://r2.example.com/signed-url",
			);

			mockReq = {
				params: { fileId },
				user: { id: userId },
			};

			await downloadUploadController(mockReq, mockRes);

			expect(cloudflare.getPresignedDownloadUrl).toHaveBeenCalledWith(
				expect.any(String),
				"cv/test-key-1.pdf",
			);
			expect(jsonMock).toHaveBeenCalledWith({
				downloadUrl: "https://r2.example.com/signed-url",
				filename: "my-resume.pdf",
			});
		});
	});

	describe("Error Handling", () => {
		it("should throw NotFound for non-existent file", async () => {
			mockReq = {
				params: { fileId: "non-existent-file" },
				user: { id: "test-user" },
			};

			await expect(downloadUploadController(mockReq, mockRes)).rejects.toThrow(
				"Upload not found",
			);
		});

		it("should throw NotFound for file owned by different user", async () => {
			const fileId = "test-file-download-2";

			await FileUploadModel.create({
				fileId,
				objectKey: "cv/test-key-2.pdf",
				originalFilename: "other-resume.pdf",
				contentType: "PDF" satisfies FileUploadContentType,
				directory: "cv",
				bucket: "test-bucket",
				userId: "owner-user",
				status: "uploaded",
				uploadUrlExpiresAt: new Date(Date.now() + 3600000),
			});

			mockReq = {
				params: { fileId },
				user: { id: "different-user" },
			};

			await expect(downloadUploadController(mockReq, mockRes)).rejects.toThrow(
				"Upload not found",
			);
		});

		it("should throw Unauthorized when user is missing", async () => {
			mockReq = {
				params: { fileId: "test-file" },
				user: undefined,
			};

			await expect(downloadUploadController(mockReq, mockRes)).rejects.toThrow(
				"Missing authenticated user",
			);
		});
	});
});
