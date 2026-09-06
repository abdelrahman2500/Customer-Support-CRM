/**
 * DS-1b — `postcss-import` inlines `globals.css`'s `@import` of the shared
 * token/focus-ring partial (`@crm/config/tailwind-tokens.css`) at the
 * PostCSS level, before `tailwindcss` runs, so `@apply`/`@layer` inside the
 * imported file are processed in the exact same pass as `@tailwind base;`
 * rather than depending on how the bundler's own CSS loader might otherwise
 * split `@import`s into separate modules. Must run first.
 */
/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    "postcss-import": {},
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
