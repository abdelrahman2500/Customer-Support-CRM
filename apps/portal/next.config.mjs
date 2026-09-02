import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs/config";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

// Story 113 — mirrors apps/web/next.config.mjs exactly; see that file's
// own doc comment.
export default withSentryConfig(withNextIntl(nextConfig), {
  silent: !process.env.CI,
  sourcemaps: { disable: true },
});
