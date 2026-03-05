import { readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"

const rootDir = path.resolve(process.cwd(), "src")
const cssFiles = []

const walk = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await walk(fullPath)
      continue
    }
    if (entry.isFile() && fullPath.endsWith(".css")) {
      cssFiles.push(fullPath)
    }
  }
}

const getLineNumber = (content, index) => content.slice(0, index).split("\n").length

await stat(rootDir)
await walk(rootDir)

const definedVars = new Set()
const usages = []

const definitionRegex = /(--bit-[a-z0-9-]+)\s*:/g
const usageRegex = /var\(\s*(--bit-[a-z0-9-]+)/g

for (const filePath of cssFiles) {
  const content = await readFile(filePath, "utf8")

  for (const match of content.matchAll(definitionRegex)) {
    definedVars.add(match[1])
  }

  for (const match of content.matchAll(usageRegex)) {
    usages.push({
      filePath,
      token: match[1],
      line: getLineNumber(content, match.index ?? 0),
    })
  }
}

const unknownUsages = usages.filter(({ token }) => !definedVars.has(token))

if (unknownUsages.length === 0) {
  console.log(`CSS vars check passed (${usages.length} var() usages).`)
  process.exit(0)
}

console.error("Unknown --bit-* CSS variables found:")
for (const item of unknownUsages) {
  const relativePath = path.relative(process.cwd(), item.filePath)
  console.error(`- ${relativePath}:${item.line} uses ${item.token}`)
}

process.exit(1)
