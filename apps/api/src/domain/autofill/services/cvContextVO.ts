import type { ParsedCVData } from "@lazyapply/types";
import { getPresignedDownloadUrl } from "@/app/cloudflare.js";
import { getEnv } from "@/app/env.js";
import { createLogger } from "@/app/logger.js";
import { CVDataModel } from "@/domain/uploads/model/cvData.model.js";
import type { TFileUpload } from "@/domain/uploads/model/fileUpload.types.js";

const logger = createLogger("cv.context");

export type FileInfo = {
	fileUrl: string;
	fileName: string;
	fileContentType: string;
};

/**
 * Value object encapsulating CV data and file upload context.
 * Provides a single point of access for CV-related data and operations.
 */
export class CVContextVO {
	private constructor(
		private readonly mCvData: ParsedCVData,
		private readonly mFileUpload: TFileUpload,
	) {}

	/**
	 * Load CV context from upload ID and user ID
	 */
	static async load(uploadId: string, userId: string): Promise<CVContextVO> {
		const cvData = await CVDataModel.findByUploadId(uploadId, userId);

		if (!cvData) {
			logger.error({ uploadId }, "CV data not found for selected upload");
			throw new Error("CV data not found for selected upload");
		}

		const fileUpload: TFileUpload = cvData.uploadId;

		logger.debug({ uploadId }, "CV context loaded");
		return new CVContextVO(cvData.toObject(), fileUpload);
	}

	get cvData(): ParsedCVData {
		return this.mCvData;
	}

	get rawText(): string | undefined {
		return this.mCvData.rawText;
	}

	get summaryFacts(): string[] {
		return this.mCvData.summaryFacts || [];
	}

	get experienceFacts(): Array<{
		role: string | null;
		company: string | null;
		facts: string[];
	}> {
		return (
			this.mCvData.experience?.map((exp) => ({
				role: exp.role,
				company: exp.company,
				facts: exp.experienceFacts || [],
			})) || []
		);
	}

	get profileSignals(): Record<string, string> {
		return this.mCvData.profileSignals || {};
	}

	get fileUploadId(): string {
		return this.mFileUpload._id;
	}

	get cvDataId(): string {
		return this.mCvData._id;
	}

	/**
	 * Generate presigned URL and file info for resume uploads
	 */
	async getFileInfo(): Promise<FileInfo | null> {
		try {
			const bucket = getEnv("CLOUDFLARE_BUCKET");
			const fileUrl = await getPresignedDownloadUrl(
				bucket,
				this.mFileUpload.objectKey,
			);

			return {
				fileUrl,
				fileName: this.mFileUpload.originalFilename,
				fileContentType: this.mFileUpload.contentType,
			};
		} catch (error) {
			logger.error(
				{ uploadId: this.mFileUpload._id, error },
				"Failed to generate presigned URL",
			);
			return null;
		}
	}
}
