import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import type { PreRenderedChunk } from "rollup";

const rootDir = path.resolve(__dirname, "src");
const outDir = path.resolve(__dirname, "dist");

export default defineConfig({
  root: rootDir,
  envDir: __dirname,
  plugins: [react()],
  build: {
    outDir,
    emptyOutDir: true,
    modulePreload: false,
    rollupOptions: {
      input: {
        background: path.resolve(rootDir, "background/index.ts"),
        content: path.resolve(rootDir, "content/index.ts")
      },
      output: {
        entryFileNames: (chunk: PreRenderedChunk) =>
          chunk.name === "background"
            ? "background/index.js"
            : chunk.name === "content"
            ? "content/index.js"
            : "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
        format: "es",
        inlineDynamicImports: false
      }
    }
  }
});
