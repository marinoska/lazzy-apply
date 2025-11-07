import { Schema, model, type InferSchemaType } from "mongoose";

const fileUploadSchema = new Schema(
	{
		fileId: {
			type: String,
			required: true,
			unique: true,
			index: true,
		},
		objectKey: {
			type: String,
			required: true,
			unique: true,
		},
		originalFilename: {
			type: String,
			required: true,
		},
		contentType: {
			type: String,
			required: true,
		},
		directory: {
			type: String,
			default: "",
		},
		bucket: {
			type: String,
			required: true,
		},
		userId: {
			type: String,
			required: true,
			index: true,
		},
		userEmail: {
			type: String,
		},
		status: {
			type: String,
			enum: ["pending", "uploaded", "failed"],
			default: "pending",
		},
		size: {
			type: Number,
		},
		metadata: {
			type: Schema.Types.Mixed,
		},
	},
	{ timestamps: true },
);

export type FileUploadDocument = InferSchemaType<typeof fileUploadSchema>;

export const FileUploadModel = model<FileUploadDocument>(
	"file_uploads",
	fileUploadSchema,
);
