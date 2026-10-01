import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    // Run in a zone far from Warsaw so tests fail if slot logic leans on the runtime's local time.
    env: { TZ: "America/New_York" },
  },
});
