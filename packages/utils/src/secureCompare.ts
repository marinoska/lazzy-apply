import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time string comparison to prevent timing attacks.
 *
 * Uses crypto.timingSafeEqual under the hood to ensure comparison
 * takes the same amount of time regardless of where strings differ.
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns true if strings are equal, false otherwise
 */
export function secureCompare(a: string, b: string): boolean {
	const aBuffer = Buffer.from(a);
	const bBuffer = Buffer.from(b);

	if (aBuffer.length !== bBuffer.length) {
		// Compare against itself to maintain constant time
		// This prevents length-based timing attacks
		timingSafeEqual(aBuffer, aBuffer);
		return false;
	}

	return timingSafeEqual(aBuffer, bBuffer);
}
