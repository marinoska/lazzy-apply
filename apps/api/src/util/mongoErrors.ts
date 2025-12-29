export const MONGO_ERROR_CODES = {
	DUPLICATE_KEY: 11000,
} as const;

export function isDuplicateKeyError(error: unknown): boolean {
	return (error as { code?: number })?.code === MONGO_ERROR_CODES.DUPLICATE_KEY;
}
