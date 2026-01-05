import { defineConfig } from "vite"
import path from "path"
import { execSync } from "child_process"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import viteTsConfigPaths from "vite-tsconfig-paths"

function getGitCommitInfo() {
  try {
    const shortSha = execSync("git rev-parse --short HEAD").toString().trim()
    const fullSha = execSync("git rev-parse HEAD").toString().trim()
    const title = execSync("git log -1 --pretty=%s").toString().trim()
    const author = execSync("git log -1 --pretty=%an").toString().trim()
    const date = execSync("git log -1 --pretty=%ci").toString().trim()
    return { shortSha, fullSha, title, author, date }
  } catch {
    return {
      shortSha: "unknown",
      fullSha: "unknown",
      title: "Unknown commit",
      author: "Unknown",
      date: new Date().toISOString(),
    }
  }
}

const commitInfo = getGitCommitInfo()

export default defineConfig({
  build: {
    target: "es2022",
    outDir: "dist",
    sourcemap: true,
  },
  define: {
    __COMMIT_INFO__: JSON.stringify(commitInfo),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/components": path.resolve(__dirname, "./src/components"),
      "@/pages": path.resolve(__dirname, "./src/pages"),
      "@/lib": path.resolve(__dirname, "./src/lib"),
      "@/db": path.resolve(__dirname, "./src/db"),
    },
  },
  plugins: [
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tanstackStart(),
    viteReact(),
  ],
})
