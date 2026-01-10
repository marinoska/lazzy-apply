import type { ClientSession } from "mongoose";
import { BaseBalanceTracker } from "./abstractBalanceTracker.js";
import type { CreditData } from "./balanceData.types.js";
import type { CreditsType } from "./model/usage.types.js";

export class CreditsTracker extends BaseBalanceTracker {
	private creditsEntry: CreditData[] = [];

	async grant(
		credits: number,
		type: CreditsType,
		session: ClientSession,
	): Promise<void> {
		if (credits <= 0) {
			throw new Error("Credits must be positive");
		}
		this.creditsEntry.push({
			type,
			creditsDelta: credits,
		});
		await this.persist(session);
		this.creditsEntry = [];
	}

	protected getCreditsDelta(): CreditData[] {
		return this.creditsEntry;
	}
}
