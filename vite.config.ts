import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import type { PreRenderedChunk } from "rollup";

const rootDir = path.resolve(__dirname, "src");
const outDir = path.resolve(__dirname, "dist");

export default defineConfig(({ command, mode }) => {
  const isContentBuild = process.env.BUILD_TARGET === 'content';
  
  return {
    root: rootDir,
    envDir: __dirname,
    plugins: [react()],
    build: {
      outDir,
      emptyOutDir: !isContentBuild, // Only empty on first build
      modulePreload: false,
      rollupOptions: {
        input: isContentBuild
          ? { content: path.resolve(rootDir, "content/index.ts") }
          : { background: path.resolve(rootDir, "background/index.ts") },
        output: {
          entryFileNames: (chunk: PreRenderedChunk) =>
            chunk.name === "background"
              ? "background/index.js"
              : chunk.name === "content"
              ? "content/index.js"
              : "assets/[name]-[hash].js",
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash][extname]",
          format: isContentBuild ? "iife" : "es",
          inlineDynamicImports: isContentBuild
        }
      }
    }
  };
});
