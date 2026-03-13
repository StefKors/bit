import { defineConfig } from "vite"
import path from "path"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { bundleStats } from "rollup-plugin-bundle-stats"

export default defineConfig(({ mode }) => {
  const isDevelopment = mode === "development"

  return {
    build: {
      target: "es2023",
      outDir: "dist",
      sourcemap: isDevelopment,
    },
    css: {
      devSourcemap: isDevelopment,
    },
    optimizeDeps: {},
    resolve: {
      tsconfigPaths: true,
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@/components": path.resolve(__dirname, "./src/components"),
        "@/pages": path.resolve(__dirname, "./src/pages"),
        "@/lib": path.resolve(__dirname, "./src/lib"),
        "@/db": path.resolve(__dirname, "./src/db"),
      },
    },
    plugins: [
      tanstackStart({
        router: {
          routeFileIgnorePattern: "\\.(test|spec)\\.(ts|tsx)$",
        },
      }),
      viteReact(),
      bundleStats(),
    ],
  }
})
