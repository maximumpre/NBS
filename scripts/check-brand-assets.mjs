#!/usr/bin/env node

/**
 * Fails the build if committed SERP / social brand assets are missing from public/.
 */

import { access } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const PUBLIC = path.join(ROOT, "public");

const REQUIRED = [
  "favicon.ico",
  "icon-32x32.png",
  "icon-48x48.png",
  "apple-touch-icon.png",
  "og-image.png",
];

async function main() {
  const missing = [];

  for (const name of REQUIRED) {
    try {
      await access(path.join(PUBLIC, name));
    } catch {
      missing.push(`public/${name}`);
    }
  }

  if (missing.length > 0) {
    console.error("Brand asset check failed. Missing files:\n");
    for (const file of missing) {
      console.error(`  - ${file}`);
    }
    console.error(
      "\nGenerate and commit assets before deploy:\n" +
        "  python scripts/generate-brand-assets.py public/placeholder-logo.svg\n" +
        "  python scripts/generate-og-image.py public/placeholder-logo.svg",
    );
    process.exit(1);
  }

  console.log("Brand asset check passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
