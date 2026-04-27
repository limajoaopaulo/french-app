import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/tests/setup.ts"],
    include: ["src/tests/**/*.{test,spec}.{ts,tsx}"],
    env: {
      // Pure-function tests still trigger module loads (e.g. fsrs.ts → prisma)
      // that throw if DATABASE_URL is unset. Use an in-memory SQLite URL —
      // tests that don't actually hit the DB never create a connection.
      DATABASE_URL: ":memory:",
    },
  },
})
