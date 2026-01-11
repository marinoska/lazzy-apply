export const uploadsKeys = {
	all: ["uploads"] as const,
	lists: () => [...uploadsKeys.all, "list"] as const,
	list: (params: { limit?: number; offset?: number }) =>
		[...uploadsKeys.lists(), params] as const,
};

export const cvWindowBalanceKeys = {
	all: ["cvWindowBalance"] as const,
};
