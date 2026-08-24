const { FlatCompat } = require("@eslint/eslintrc");
const baseConfig = require("@crm/config/eslint-preset");

const compat = new FlatCompat({ baseDirectory: __dirname });

/** @type {import("eslint").Linter.Config[]} */
module.exports = [
  { ignores: ["next-env.d.ts"] },
  ...baseConfig,
  ...compat.extends("next/core-web-vitals"),
];
