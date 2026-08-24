import type { Config } from "tailwindcss";

// See docs/architecture/10-i18n-and-rtl.md — prefer logical-property
// utilities (ms-*, me-*, ps-*, pe-*, start-*, end-*) over physical ones.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
