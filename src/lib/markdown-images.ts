/**
 * Rewrites relative image URLs in markdown to load from GitHub's raw content CDN.
 *
 * README files reference images with relative paths like `./public/logo.png`
 * or `docs/screenshot.png`. When rendered in our app these resolve against
 * localhost and 404. This rewrites them to raw.githubusercontent.com.
 */

export interface RepoContext {
  owner: string
  repo: string
  branch: string
}

const isAbsoluteUrl = (url: string): boolean =>
  url.startsWith("http://") || url.startsWith("https://") || url.startsWith("//")

const isDataUrl = (url: string): boolean => url.startsWith("data:")

const isAnchor = (url: string): boolean => url.startsWith("#")

export const rewriteImageUrl = (src: string, ctx?: RepoContext): string => {
  if (!ctx) return src
  if (!src) return src
  if (isAbsoluteUrl(src) || isDataUrl(src) || isAnchor(src)) return src

  // Strip leading ./ if present
  const cleanPath = src.replace(/^\.\//, "")

  return `https://raw.githubusercontent.com/${ctx.owner}/${ctx.repo}/${ctx.branch}/${cleanPath}`
}
