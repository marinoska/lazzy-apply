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
