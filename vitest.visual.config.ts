import { defineConfig } from "vitest/config"
import path from "path"
import { playwright } from "@vitest/browser-playwright"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["src/**/*.visual.test.tsx"],
    setupFiles: ["./src/test/visual.setup.ts"],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: "chromium" }],
      screenshotFailures: true,
      expect: {
        toMatchScreenshot: {
          comparatorName: "pixelmatch",
          comparatorOptions: {
            threshold: 0.2,
            allowedMismatchedPixels: 100,
          },
        },
      },
    },
  },
})
