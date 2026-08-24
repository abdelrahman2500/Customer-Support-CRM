// @ts-check
const js = require("@eslint/js");
const tseslint = require("typescript-eslint");
const prettierConfig = require("eslint-config-prettier");
const globals = require("globals");

/**
 * Base flat-config array shared by every app/package in the monorepo.
 * Consumers spread this into their own `eslint.config.js` and append
 * framework-specific configs (e.g. `eslint-config-next`) as needed.
 *
 * @type {import("eslint").Linter.Config[]}
 */
const baseConfig = [
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/node_modules/**",
      "**/generated/**",
      "**/coverage/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Plain CommonJS tooling/config files (this preset itself, *.config.js, etc.).
    files: ["**/*.config.js", "**/*.config.cjs", "**/eslint-preset.js", "**/prettier-preset.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];

module.exports = baseConfig;
