import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default [
  { ignores: ["dist", "node_modules", "coverage"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.es2021 },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      // Only the two long-standing, well-understood rules — not the plugin's
      // full "recommended" bundle, which (as of v7) also ships several React
      // Compiler-readiness rules (purity, set-state-in-effect, and friends).
      // Those assume a codebase written for the compiler; this one predates
      // it, and satisfying them would mean restructuring working, tested
      // hooks (src/engine/useTournament.js in particular) for a hygiene pass
      // that isn't supposed to change behaviour.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["api/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    // vite.config.js sets test.globals = true, so test files use describe/it/
    // expect/vi without importing them — ESLint needs to be told the same
    // thing. Scoped to tests/ (where vite.config.js's own include points),
    // not **/*.test.js — tests live in one place, not next to their subjects.
    files: ["tests/**/*.test.{js,jsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        vi: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
      },
    },
  },
];
