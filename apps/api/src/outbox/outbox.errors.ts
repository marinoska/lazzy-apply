/**
 * Thrown when attempting to process an outbox entry that is no longer pending.
 * This typically indicates a race condition where multiple processes tried to claim the same entry.
 */
export class OutboxEntryAlreadyProcessingError extends Error {
	constructor(logId: string) {
		super(`Outbox entry ${logId} is no longer pending - already being processed`);
		this.name = "OutboxEntryAlreadyProcessingError";
	}
}

/**
 * Thrown when attempting to change the status of an outbox entry that is in a terminal state.
 * Terminal states (completed, failed) are immutable and cannot be changed.
 */
export class OutboxTerminalStatusError extends Error {
	constructor(currentStatus: string, attemptedStatus: string) {
		super(`Cannot change status from ${currentStatus} to ${attemptedStatus}`);
		this.name = "OutboxTerminalStatusError";
	}
}
