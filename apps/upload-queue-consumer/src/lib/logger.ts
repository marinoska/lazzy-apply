import { Axiom } from "@axiomhq/js";
import type { Env } from "../types";

export type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogContext {
	uploadId?: string;
	fileId?: string;
	logId?: string;
	userId?: string;
	fileType?: string;
	fileSize?: number;
	operation?: string;
	duration?: number;
	[key: string]: unknown;
}

/**
 * Logger that sends structured logs to both console and Axiom
 */
export class Logger {
	private axiom: Axiom;
	private dataset: string;
	private environment: string;
	private isLocal: boolean;

	constructor(env: Env) {
		this.axiom = new Axiom({
			token: env.AXIOM_API_TOKEN,
		});
		this.dataset = env.AXIOM_LOGS_DATASET;
		this.environment = env.ENVIRONMENT;
		this.isLocal = env.ENVIRONMENT === "local";
	}

	private log(
		level: LogLevel,
		message: string,
		context?: LogContext,
		error?: Error,
	) {
		const timestamp = new Date().toISOString();

		// Console log for Cloudflare logs
		const consoleMessage = `[${level.toUpperCase()}] ${message}`;
		if (level === "error") {
			console.error(consoleMessage, context, error);
		} else if (level === "warn") {
			console.warn(consoleMessage, context);
		} else {
			console.log(consoleMessage, context);
		}

		// Skip Axiom in local development
		if (this.isLocal) {
			return;
		}

		// Send to Axiom (deployed environments only)
		try {
			this.axiom.ingest(this.dataset, [
				{
					_time: timestamp,
					level,
					message,
					environment: this.environment,
					...context,
					...(error && {
						error: {
							message: error.message,
							stack: error.stack,
							name: error.name,
						},
					}),
				},
			]);
		} catch (axiomError) {
			// Don't fail the operation if Axiom logging fails
			console.error("Failed to send log to Axiom:", axiomError);
		}
	}

	info(message: string, context?: LogContext) {
		this.log("info", message, context);
	}

	warn(message: string, context?: LogContext) {
		this.log("warn", message, context);
	}

	error(message: string, context?: LogContext, error?: Error) {
		this.log("error", message, context, error);
	}

	debug(message: string, context?: LogContext) {
		this.log("debug", message, context);
	}

	/**
	 * Flush any pending logs to Axiom
	 */
	async flush(): Promise<void> {
		// Skip flush in local development
		if (this.isLocal) {
			return;
		}

		try {
			await this.axiom.flush();
		} catch (error) {
			console.error("Failed to flush Axiom logs:", error);
		}
	}
}
