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
				// Browser extensions have dynamic IDs, so we use wildcards
				// This is still safer than "*" as it restricts to extension protocols only
				AllowedOrigins: [
					"chrome-extension://*",
					"moz-extension://*",
					"safari-web-extension://*",
				],
				AllowedMethods: ["GET", "PUT", "HEAD"], // Only methods needed for upload
				AllowedHeaders: [
					"Content-Type",
					"Content-Length",
					"x-amz-content-sha256",
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
