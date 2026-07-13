import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const USER_FACING_SOURCE_ROOTS = ["app", "components"] as const
const USER_FACING_LIB_FILES = [
  "lib/dashboard/data-quality.ts",
  "lib/installation-import.ts",
] as const
const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"])

const SUSPICIOUS_PATTERNS = [
  { label: "mojibake-lower-a-ring", pattern: /\u00c3\u00a5/ },
  { label: "mojibake-lower-a-umlaut", pattern: /\u00c3\u00a4/ },
  { label: "mojibake-lower-o-umlaut", pattern: /\u00c3\u00b6/ },
  { label: "mojibake-upper-a-ring", pattern: /\u00c3\u2026/ },
  { label: "mojibake-upper-a-umlaut", pattern: /\u00c3\u201e/ },
  { label: "mojibake-upper-o-umlaut", pattern: /\u00c3\u2013/ },
  { label: "mojibake-nonbreaking-space-prefix", pattern: /\u00c2/ },
  { label: "mojibake-subscript-two", pattern: /\u00e2\u201a\u201a/ },
  { label: "mojibake-en-dash", pattern: /\u00e2\u20ac\u201c/ },
  { label: "mojibake-em-dash", pattern: /\u00e2\u20ac\u201d/ },
  { label: "mojibake-left-double-quote", pattern: /\u00e2\u20ac\u0153/ },
  { label: "mojibake-right-double-quote", pattern: /\u00e2\u20ac\u009d/ },
  { label: "replacement character", pattern: /\ufffd/ },
]

describe("user-facing source encoding", () => {
  it("does not contain known mojibake sequences in curated UI/API copy", () => {
    const failures: string[] = []

    for (const filePath of listCuratedSourceFiles(process.cwd())) {
      const content = fs.readFileSync(filePath, "utf8")

      for (const { label, pattern } of SUSPICIOUS_PATTERNS) {
        if (pattern.test(content)) {
          failures.push(`${path.relative(process.cwd(), filePath)}: ${label}`)
        }
      }
    }

    expect(failures).toEqual([])
  })
})

function listCuratedSourceFiles(rootDir: string) {
  const files: string[] = []

  for (const sourceRoot of USER_FACING_SOURCE_ROOTS) {
    const absoluteRoot = path.join(rootDir, sourceRoot)
    if (fs.existsSync(absoluteRoot)) {
      walk(absoluteRoot, files)
    }
  }

  for (const libFile of USER_FACING_LIB_FILES) {
    const absolutePath = path.join(rootDir, libFile)
    if (fs.existsSync(absolutePath)) {
      files.push(absolutePath)
    }
  }

  return files
}

function walk(directory: string, files: string[]) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === ".next" || entry.name === "node_modules") continue

    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      walk(fullPath, files)
      continue
    }

    if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath)
    }
  }
}
