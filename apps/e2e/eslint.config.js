const baseConfig = require("@crm/config/eslint-preset");
const globals = require("globals");

/** @type {import("eslint").Linter.Config[]} */
module.exports = [
  ...baseConfig,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
