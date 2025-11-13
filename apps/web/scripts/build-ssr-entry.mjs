#!/usr/bin/env node
/**
 * Build script for SSR entry point
 * Type checks with tsconfig.ssr.json, then bundles with esbuild
 */

import * as esbuild from "esbuild";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const webRoot = path.resolve(__dirname, "..");
const entryPoint = path.join(webRoot, "src", "entry-blog-ssr.tsx");
const outDir = path.join(webRoot, "dist-ssr");
const outfile = path.join(outDir, "entry-blog-ssr.js");
const tsconfigPath = path.join(webRoot, "tsconfig.ssr.json");

async function build() {
  try {
    // Step 1: Type check with tsconfig.ssr.json
    console.log("🔍 Type checking SSR entry...");
    execSync(`tsc -p ${tsconfigPath}`, { 
      stdio: "inherit",
      cwd: webRoot 
    });
    console.log("✅ Type check passed");

    // Step 2: Bundle with esbuild
    console.log("📦 Bundling SSR entry...");
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    await esbuild.build({
      entryPoints: [entryPoint],
      bundle: true,
      outfile,
      format: "esm",
      platform: "node",
      target: "node18",
      jsx: "automatic",
      packages: "external",
      banner: {
        js: "// @ts-nocheck\n",
      },
    });
    console.log(`✅ Built SSR entry: ${outfile}`);
  } catch (error) {
    console.error("❌ Error building SSR entry:", error);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

build();

