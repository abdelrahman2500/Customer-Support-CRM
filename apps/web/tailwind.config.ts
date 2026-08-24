import type { Config } from "tailwindcss";

// See docs/architecture/10-i18n-and-rtl.md: prefer logical-property utilities
// (ms-*, me-*, ps-*, pe-*, start-*, end-*) over physical ones (ml-*, mr-*,
// left-*, right-*) in every component so the same markup mirrors correctly
// under `dir="rtl"`. Tailwind ships these logical utilities out of the box —
// no plugin or extra config is required, only the convention.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
