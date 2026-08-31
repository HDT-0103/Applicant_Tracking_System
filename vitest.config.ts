import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  // src/frontend/tsconfig.json sets `jsx: "preserve"` because Next compiles JSX
  // itself. Left to esbuild, vitest reads that and refuses to parse .tsx with
  // "invalid JS syntax". This plugin owns the JSX transform instead, so the
  // real tsconfig stays correct for the Next build.
  plugins: [react()],
  resolve: {
    // Mirrors the `@/*` alias in src/frontend/tsconfig.json. Without it,
    // component files that import `@/lib/...` fail to resolve under vitest.
    alias: { "@": path.resolve(__dirname, "src/frontend") },
  },
  test: {
    // Default stays "node". The pure-logic suites (tokens, jwt, httpClient,
    // db) need no DOM, and booting jsdom for each of them roughly doubles the
    // suite runtime for nothing. Component tests opt in individually with a
    // `@vitest-environment jsdom` docblock — `environmentMatchGlobs` was
    // removed in Vitest 4.
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/frontend/**/*.{test,spec}.{ts,tsx}"],
  },
});
