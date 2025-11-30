import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
	"apps/api/vitest.config.ts",
	"apps/extension/vitest.config.ts",
	"apps/upload-queue-consumer/vitest.config.ts",
]);
