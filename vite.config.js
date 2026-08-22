import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    // All tests live under tests/, not scattered next to the source files
    // they cover — this also stops a stray *.test.js anywhere else in the
    // tree from silently joining the suite.
    include: ["tests/**/*.test.{js,jsx}"],
  },
});
