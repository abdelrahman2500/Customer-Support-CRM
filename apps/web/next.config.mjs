import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs/config";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

// Story 113 — no `org`/`project`/`authToken` configured: this repository
// has no Sentry project set up yet (see docs/architecture/11-quality-and-operations.md's
// own "Sentry or self-hosted GlitchTip" wording — an intentionally
// deferred provider choice, mirrored by `SENTRY_DSN` being optional
// everywhere else in this story). Without `authToken`, the source-map-
// upload step is skipped with a warning, not a build failure — `silent:
// true` suppresses even that warning outside CI.
export default withSentryConfig(withNextIntl(nextConfig), {
  silent: !process.env.CI,
  sourcemaps: { disable: true },
});
