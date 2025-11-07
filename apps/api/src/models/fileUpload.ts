import { Schema, model, type InferSchemaType } from "mongoose";

const fileUploadSchema = new Schema(
	{
		fileId: {
			type: String,
			required: true,
			unique: true,
			index: true,
			immutable: true
		},
		objectKey: {
			type: String,
			required: true,
			unique: true,
			immutable: true
		},
		originalFilename: {
			type: String,
			required: true,
			immutable: true
		},
		contentType: {
			type: String,
			enum: ["PDF", "DOCX"],
			required: true,
			immutable: true
		},
		directory: {
			type: String,
			default: "",
			immutable: true
		},
		bucket: {
			type: String,
			required: true,
			immutable: true
		},
		userId: {
			type: String,
			required: true,
			index: true,
			immutable: true
		},
		userEmail: {
			type: String,
			immutable: true
		},
		status: {
			type: String,
			enum: ["pending", "uploaded", "failed"],
			default: "pending",
		},
		size: {
			type: Number,
			immutable: true
		},
	},
	{ timestamps: true },
);

export type FileUploadDocument = InferSchemaType<typeof fileUploadSchema>;

export const FileUploadModel = model<FileUploadDocument>(
	"file_uploads",
	fileUploadSchema,
);
