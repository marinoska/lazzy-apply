/**
 * Sanitize error messages for user display
 * Logs detailed error to console and returns user-friendly message
 */
export function sanitizeErrorForUser(
	error: unknown,
	context: string,
	fallbackMessage = "Something went wrong. Please try again.",
): string {
	// Always log the full error for debugging
	console.error(`[${context}] Error:`, error);

	// Return user-friendly message
	return fallbackMessage;
}

/**
 * Get user-friendly message for specific error types
 */
export function getUserFriendlyMessage(error: unknown): string {
	if (error instanceof Error) {
		const message = error.message.toLowerCase();

		// Network errors
		if (message.includes("network") || message.includes("fetch")) {
			return "Network error. Please check your connection.";
		}

		// Auth errors
		if (message.includes("unauthorized") || message.includes("401")) {
			return "Please sign in to continue.";
		}

		// Size errors
		if (message.includes("size") || message.includes("too large")) {
			return "File is too large. Maximum size is 3MB.";
		}

		// File type errors
		if (message.includes("content type") || message.includes("format")) {
			return "Invalid file format. Please upload a PDF or DOCX file.";
		}
	}

	return "Something went wrong. Please try again.";
}
