import { S3Client } from "@aws-sdk/client-s3";

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
