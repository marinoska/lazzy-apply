import type { ParsedCVData } from "@lazyapply/types";
import type { Env } from "../types";
import { Logger } from "./logger";

/**
 * Update outbox entry status via API
 */
export async function updateOutboxStatus(
	env: Env,
	logId: string,
	status: "completed" | "failed",
	data: ParsedCVData | null,
	error?: string,
): Promise<void> {
	const logger = new Logger(env);
	try {
		logger.debug("Updating outbox status via API", {
			logId,
			status,
			apiUrl: env.API_URL,
			operation: "outbox_update",
		});

		const response = await fetch(`${env.API_URL}/api/outbox/${logId}`, {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
				"X-Worker-Secret": env.WORKER_SECRET,
			},
			body: JSON.stringify({
				status,
				data,
				error,
			}),
		});

		if (!response.ok) {
			const responseText = await response.text();
			logger.error("Failed to update outbox status", {
				logId,
				status,
				responseStatus: response.status,
				responseText,
				operation: "outbox_update",
			});
			
			// For status updates to "completed", we want to ensure the update succeeds
			// If it fails, we should retry the entire message processing
			if (status === "completed") {
				throw new Error(
					`Failed to update outbox status to completed: ${response.status} ${responseText}`,
				);
			}
			
			// For "failed" status updates, log but don't throw
			// We don't want to retry a message that already failed
			logger.warn("Could not mark outbox as failed, but continuing", {
				logId,
				status,
				operation: "outbox_update",
			});
		} else {
			logger.info("Updated outbox status", {
				logId,
				status,
				operation: "outbox_update",
			});
		}
	} catch (error) {
		logger.error(
			"Failed to update outbox",
			{ logId, status, operation: "outbox_update" },
			error instanceof Error ? error : new Error(String(error)),
		);
		
		// Re-throw for "completed" status - we need the update to succeed
		if (status === "completed") {
			throw error;
		}
		
		// For "failed" status, log but don't throw
		// The message processing already failed, no need to retry
		logger.warn("Swallowing error for failed status update", {
			logId,
			status,
			operation: "outbox_update",
		});
	}
}
