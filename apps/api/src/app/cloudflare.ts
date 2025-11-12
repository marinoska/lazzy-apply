import { createHash } from "node:crypto";

import {
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	type HeadObjectCommandOutput,
	S3Client,
} from "@aws-sdk/client-s3";

import { getEnv } from "./env.js";

let cachedClient: S3Client | null = null;

/**
 * Lazily initialize an S3 client configured for Cloudflare R2.
 */
export const getCloudflareClient = (): S3Client => {
	if (cachedClient) {
		return cachedClient;
	}

	cachedClient = new S3Client({
		region: "auto",
		endpoint: getEnv("CLOUDFLARE_API_ENDPOINT"),
		credentials: {
			accessKeyId: getEnv("CLOUDFLARE_ACCESS_KEY_ID"),
			secretAccessKey: getEnv("CLOUDFLARE_SECRET_ACCESS_KEY"),
		},
		forcePathStyle: true,
		// Disable request checksums to avoid CORS preflight issues with browser uploads
		requestChecksumCalculation: "WHEN_REQUIRED",
	});

	return cachedClient;
};

export const fetchHeadObject = async (
	bucket: string,
	objectKey: string,
): Promise<HeadObjectCommandOutput | undefined> => {
	try {
		const headCommand = new HeadObjectCommand({
			Bucket: bucket,
			Key: objectKey,
		});

		return await getCloudflareClient().send(headCommand);
	} catch {
		return undefined;
	}
};

export const deleteRemoteObject = async (
	bucket: string,
	objectKey: string,
) => {
	const deleteCommand = new DeleteObjectCommand({
		Bucket: bucket,
		Key: objectKey,
	});

	await getCloudflareClient().send(deleteCommand);
};

export const hashRemoteObject = async (
	bucket: string,
	objectKey: string,
): Promise<string | undefined> => {
	const getCommand = new GetObjectCommand({
		Bucket: bucket,
		Key: objectKey,
	});
	const getResult = await getCloudflareClient().send(getCommand);

	if (!getResult.Body) {
		return undefined;
	}

	const hash = createHash("sha256");
	const stream = getResult.Body as NodeJS.ReadableStream;

	for await (const chunk of stream) {
		hash.update(chunk);
	}

	return hash.digest("hex");
};
