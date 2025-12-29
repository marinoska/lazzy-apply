import type {
	AutofillResponse,
	AutofillResponseData,
	AutofillResponseItem,
	FormFieldPath,
} from "@lazyapply/types";
import { getPresignedDownloadUrl } from "@/app/cloudflare.js";
import { getEnv } from "@/app/env.js";
import { createLogger } from "@/app/logger.js";
import type { TAutofill } from "@/domain/autofill/model/autofill.types.js";
import { AutofillCoverLetterModel } from "@/domain/autofill/model/autofillCoverLetter.model.js";
import { FileUploadModel } from "@/domain/uploads/model/fileUpload.model.js";

const logger = createLogger("autofill.response.builder");

type FreshFileInfo = {
	fileUrl: string;
	fileName: string;
	fileContentType: string;
} | null;

/**
 * Builds API responses from stored autofill documents.
 * Handles presigned URL regeneration for file uploads.
 *
 * IMPORTANT: Presigned URLs for file uploads expire after ~15 minutes.
 * When returning cached autofill data, we must regenerate fresh presigned URLs
 * for file fields. The original URLs stored in the database will be expired
 * and cause CORS/403 errors when the extension tries to fetch them.
 */
export class AutofillResponseBuilder {
	constructor(
		private readonly userId: string,
		private readonly uploadId: string,
	) {}

	/**
	 * Build API response from stored autofill document
	 */
	async build(autofillDoc: TAutofill): Promise<AutofillResponse> {
		const fields = await this.buildFields(autofillDoc);
		const coverLetter = await AutofillCoverLetterModel.findByAutofillId(
			autofillDoc.autofillId,
			this.userId,
		);

		return {
			autofillId: autofillDoc.autofillId,
			fields,
			fromCache: true,
			...(coverLetter && { coverLetter }),
		};
	}

	private async buildFields(
		autofillDoc: TAutofill,
	): Promise<AutofillResponseData> {
		const fields: AutofillResponseData = {};

		for (const item of autofillDoc.data) {
			const { fieldName, label, path, pathFound, linkType, inferenceHint } =
				item;
			const responseItem: AutofillResponseItem = {
				fieldName,
				label,
				path: path as FormFieldPath,
				pathFound,
				...(linkType && { linkType }),
				...(inferenceHint && { inferenceHint }),
			};

			if (item.fileUrl && item.fileName && item.fileContentType) {
				const freshFileInfo = await this.getFreshFileInfo();
				if (freshFileInfo) {
					responseItem.fileUrl = freshFileInfo.fileUrl;
					responseItem.fileName = freshFileInfo.fileName;
					responseItem.fileContentType = freshFileInfo.fileContentType;
					responseItem.pathFound = true;
				} else {
					responseItem.fileName = item.fileName;
					responseItem.fileContentType = item.fileContentType;
					responseItem.pathFound = false;
				}
			} else {
				responseItem.value = item.value;
			}

			fields[item.hash] = responseItem;
		}

		return fields;
	}

	/**
	 * Generate fresh presigned URL for file uploads.
	 * Presigned URLs expire (typically 15 min), so we must regenerate them.
	 */
	private async getFreshFileInfo(): Promise<FreshFileInfo> {
		const fileUpload = await FileUploadModel.findOne({
			_id: this.uploadId,
		}).setOptions({ userId: this.userId });

		if (!fileUpload) {
			logger.warn(
				{ uploadId: this.uploadId },
				"File upload not found for presigned URL refresh",
			);
			return null;
		}

		try {
			const bucket = getEnv("CLOUDFLARE_BUCKET");
			const fileUrl = await getPresignedDownloadUrl(
				bucket,
				fileUpload.objectKey,
			);
			return {
				fileUrl,
				fileName: fileUpload.originalFilename,
				fileContentType: fileUpload.contentType,
			};
		} catch (error) {
			logger.error(
				{ uploadId: this.uploadId, error },
				"Failed to generate fresh presigned URL",
			);
			return null;
		}
	}
}
