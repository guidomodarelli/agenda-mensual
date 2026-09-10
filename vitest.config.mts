/** Runs application behavior tests with Vite's React and stylesheet transforms. */
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src/", import.meta.url)),
      // Match Next's server-side treatment of its build-time boundary marker.
      "server-only": "next/dist/compiled/server-only/empty.js",
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    clearMocks: false,
    // Keep RTL polling progressing alongside explicit fake-clock advances.
    fakeTimers: { shouldAdvanceTime: true },
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "drizzle/**/*.test.ts"],
    testTimeout: 20_000,
    // The full expense-sheet tests share substantial CPU/memory demand; run files serially.
    maxWorkers: 1,
    css: { modules: { classNameStrategy: "non-scoped" } },
    server: { deps: { inline: ["beez-ui", "@next/env"] } },
  },
});
