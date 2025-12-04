import path from "node:path";
import { crx } from "@crxjs/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import manifest from "./src/manifest.json";

export default defineConfig(({ mode }) => ({
	plugins: [react(), crx({ manifest })],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	build: {
		rollupOptions: {
			output: {
				manualChunks:
					mode === "production"
						? {
								"vendor-react": ["react", "react-dom"],
								"vendor-mui": [
									"@mui/joy",
									"@mui/icons-material",
									"@emotion/react",
									"@emotion/styled",
									"@emotion/cache",
								],
								"vendor-supabase": ["@supabase/supabase-js"],
								"vendor-nlp": ["compromise"],
							}
						: undefined,
			},
		},
	},
}));
