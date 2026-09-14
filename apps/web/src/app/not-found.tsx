import Link from "next/link";
import "./globals.css";

/**
 * Story 96 — Navigation & Route Robustness.
 *
 * This is the ROOT not-found boundary (outside `[locale]/`), reached only
 * when `[locale]/layout.tsx` itself throws `notFound()` for a genuinely
 * invalid locale segment (e.g. `/xx/tickets`) — at that point the layout
 * hasn't rendered yet, so there is no `<html>`/`<body>` or
 * `NextIntlClientProvider` anywhere above this boundary to rely on. It
 * therefore supplies its own minimal document and a locale-agnostic,
 * English fallback (this repository's default locale) rather than risking
 * a crash trying to resolve messages for an already-invalid locale.
 * `[locale]/not-found.tsx` is the localized boundary used for the far more
 * common case — a valid locale with an unmatched route.
 */
export default function RootNotFound() {
  return (
    <html lang="en" dir="ltr">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-surface-sunk p-8">
          <div className="w-full max-w-sm rounded-lg border border-rule bg-surface p-8 text-center shadow-sm">
            <h1 className="text-xl font-semibold text-ink">Page not found</h1>
            <p className="mt-2 text-sm text-ink-muted">
              The page you&apos;re looking for doesn&apos;t exist or may have been moved.
            </p>
            <Link
              href="/en"
              className="mt-4 inline-block text-sm font-medium text-ink hover:underline"
            >
              Go back home
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
