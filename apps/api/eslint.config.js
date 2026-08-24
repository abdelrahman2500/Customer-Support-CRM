const baseConfig = require("@crm/config/eslint-preset");
const globals = require("globals");

/** @type {import("eslint").Linter.Config[]} */
module.exports = [
  ...baseConfig,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // NestJS relies on empty constructors for DI and decorator-only classes.
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
];
