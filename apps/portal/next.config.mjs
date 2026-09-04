import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs/config";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Story S-2 — /ui ships TypeScript/JSX source rather than a compiled
  // `dist`, so Next has to transpile it as part of this app. That is the
  // deliberate divergence from `/shared`/`/ai`, which do build to
  // `dist`: those are framework-neutral and consumed by Node apps too,
  // whereas /ui is React-only and consumed by exactly these two Next
  // apps. Shipping source keeps `"use client"` boundaries intact through the
  // app compiler, needs no dual module format, and removes a build-order
  // dependency from the graph.
  transpilePackages: ["@crm/ui"],
};

// Story 113 — mirrors apps/web/next.config.mjs exactly; see that file's
// own doc comment.
export default withSentryConfig(withNextIntl(nextConfig), {
  silent: !process.env.CI,
  sourcemaps: { disable: true },
});
