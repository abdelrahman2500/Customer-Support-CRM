import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// `vitest.config.mts` sets `globals: false`, so @testing-library/react's own
// auto-cleanup (which relies on a global `afterEach`) never registers —
// without this, DOM from one test leaks into the next within the same file.
// Mirrors `apps/web/src/test/setup.ts` exactly.
afterEach(() => {
  cleanup();
});

// Story 148 — this app's first Radix `Select` (the ticket list's status
// filter) is also the first thing here that a test needs to actually open.
// jsdom implements none of these three DOM APIs, and Radix calls them
// internally when positioning and scrolling its open content, so without
// these no-op polyfills opening a `Select` throws
// (`scrollIntoView is not a function`). Copied verbatim from
// `apps/web/src/test/setup.ts`, which has carried them since Story 25 —
// a well-known, standard Radix+jsdom test-environment gap, not an
// application behaviour change.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
