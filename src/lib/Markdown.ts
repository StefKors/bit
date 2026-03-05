import { bundledLanguages } from "shiki"

const EXT_TO_LANG: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  rb: "ruby",
  rs: "rust",
  go: "go",
  java: "java",
  kt: "kotlin",
  kts: "kotlin",
  swift: "swift",
  m: "objective-c",
  mm: "objective-c",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  cs: "csharp",
  fs: "fsharp",
  php: "php",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  fish: "fish",
  ps1: "powershell",
  sql: "sql",
  graphql: "graphql",
  gql: "graphql",
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  sass: "sass",
  less: "less",
  json: "json",
  jsonc: "jsonc",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  xml: "xml",
  svg: "xml",
  md: "markdown",
  mdx: "mdx",
  vue: "vue",
  svelte: "svelte",
  astro: "astro",
  lua: "lua",
  r: "r",
  dart: "dart",
  ex: "elixir",
  exs: "elixir",
  erl: "erlang",
  hs: "haskell",
  ml: "ocaml",
  mli: "ocaml",
  clj: "clojure",
  scala: "scala",
  groovy: "groovy",
  pl: "perl",
  tf: "hcl",
  dockerfile: "dockerfile",
  makefile: "makefile",
  cmake: "cmake",
  proto: "protobuf",
  prisma: "prisma",
}

const supportedLangs = new Set(Object.keys(bundledLanguages))

/** Extracts a Shiki-supported language from a file path (e.g. "src/foo.ts" → "typescript"). */
export const getLanguageFromFilePath = (path: string | null): string | null => {
  if (!path) return null
  const ext = path.split(".").pop()?.toLowerCase()
  if (!ext) return null
  const mapped = EXT_TO_LANG[ext]
  if (mapped && supportedLangs.has(mapped)) return mapped
  if (supportedLangs.has(ext)) return ext
  return null
}
