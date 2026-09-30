#!/usr/bin/env node

/**
 * Fails the build if the homepage meta description is outside 25–170 chars.
 * Prefers lib/meta-description.ts LAYOUT_DESCRIPTION; falls back to
 * lib/seo-metadata.ts SITE_DESCRIPTION.
 */

import { access, readFile } from "node:fs/promises"
import path from "node:path"

const ROOT = path.join(import.meta.dirname, "..")
const META_CANDIDATES = [
  path.join(ROOT, "lib", "meta-description.ts"),
  path.join(ROOT, "src", "lib", "meta-description.ts"),
]
const SEO_META_CANDIDATES = [
  path.join(ROOT, "lib", "seo-metadata.ts"),
  path.join(ROOT, "src", "lib", "seo-metadata.ts"),
]
const MIN_LEN = 25
const MAX_LEN = 170

async function firstExisting(paths) {
  for (const candidate of paths) {
    try {
      await access(candidate)
      return candidate
    } catch {
      // try next
    }
  }
  return null
}

function extractStringExport(source, exportName) {
  const match = source.match(
    new RegExp(`export const ${exportName}\\s*=\\s*(["'\`])([\\s\\S]*?)\\1`),
  )
  return match ? match[2].replace(/\\n/g, " ").trim() : null
}

async function main() {
  let description = null
  let label = ""

  const metaFile = await firstExisting(META_CANDIDATES)
  if (metaFile) {
    const source = await readFile(metaFile, "utf8")
    description = extractStringExport(source, "LAYOUT_DESCRIPTION")
    label = "LAYOUT_DESCRIPTION"
    if (!description) {
      console.error("Meta description check failed: LAYOUT_DESCRIPTION not found.")
      process.exit(1)
    }
  } else {
    const seoFile = await firstExisting(SEO_META_CANDIDATES)
    if (!seoFile) {
      console.error(
        "Meta description check failed: lib/meta-description.ts or lib/seo-metadata.ts not found.",
      )
      process.exit(1)
    }
    const source = await readFile(seoFile, "utf8")
    description = extractStringExport(source, "SITE_DESCRIPTION")
    label = "SITE_DESCRIPTION"
    if (!description) {
      console.error("Meta description check failed: SITE_DESCRIPTION not found.")
      process.exit(1)
    }
  }

  const length = description.length

  if (length < MIN_LEN || length > MAX_LEN) {
    console.error(
      `Meta description check failed: ${label} is ${length} chars (must be ${MIN_LEN}–${MAX_LEN}).`,
    )
    console.error(`  "${description}"`)
    process.exit(1)
  }

  console.log(`Meta description check passed (${label}, ${length} chars).`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
