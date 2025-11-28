export class OutboxEntryAlreadyProcessingError extends Error {
	constructor(processId: string) {
		super(`Outbox entry ${processId} is already being processed`);
		this.name = "OutboxEntryAlreadyProcessingError";
	}
}
