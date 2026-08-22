import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// If deploying to https://<user>.github.io/<repo>/ set base to "/<repo>/".
// The GitHub Actions workflow sets VITE_BASE automatically.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || "/",
  test: {
    environment: "jsdom",
    globals: true,
  },
});
