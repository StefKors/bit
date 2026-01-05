import { defineConfig } from "vite"
import path from "path"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteTsConfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  build: {
    target: "es2022",
    outDir: "dist",
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
    tanstackStart({
      ssr: {
        entry: "./src/entry.server.tsx",
      },
    }),
  ],
})

