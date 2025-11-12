import { PutBucketCorsCommand } from "@aws-sdk/client-s3";
import { getCloudflareClient } from "@/app/cloudflare.js";
import { getEnv } from "@/app/env.js";

/**
 * Configure CORS on the Cloudflare R2 bucket to allow uploads from browser extensions
 * Run this once to set up CORS policy on your bucket
 */
export const setupR2Cors = async () => {
	const client = getCloudflareClient();
	const bucket = getEnv("CLOUDFLARE_BUCKET");

	const corsRules = {
		CORSRules: [
			{
				// Allow all origins for presigned URL uploads
				// This is safe because presigned URLs are time-limited and cryptographically signed
				AllowedOrigins: ["*"],
				AllowedMethods: ["GET", "PUT", "POST", "HEAD"], // Methods for presigned uploads
				AllowedHeaders: [
					"*", // Allow all headers for presigned URL signatures
				],
				ExposeHeaders: ["ETag", "Content-Length"],
				MaxAgeSeconds: 3600,
			},
		],
	};

	const command = new PutBucketCorsCommand({
		Bucket: bucket,
		CORSConfiguration: corsRules,
	});

	await client.send(command);
	console.log(`CORS configured successfully for bucket: ${bucket}`);
};

// Run this script directly to set up CORS
if (import.meta.url === `file://${process.argv[1]}`) {
	setupR2Cors()
		.then(() => {
			console.log("✓ CORS setup complete");
			process.exit(0);
		})
		.catch((error) => {
			console.error("✗ CORS setup failed:", error);
			process.exit(1);
		});
}
