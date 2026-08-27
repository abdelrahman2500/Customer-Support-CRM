import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// `vitest.config.mts` sets `globals: false`, so @testing-library/react's own
// auto-cleanup (which relies on a global `afterEach`) never registers —
// without this, DOM from one test leaks into the next within the same file.
afterEach(() => {
  cleanup();
});

// Story 25 — jsdom implements neither of these DOM APIs, and Radix UI's
// `Select` (installed in Story 23, first actually opened/interacted-with by
// a test in Story 25) calls them internally when positioning/scrolling its
// open content. Without these no-op polyfills, opening a `Select` in any
// test throws (`scrollIntoView is not a function`) or silently fails to
// render its portal content. This is a well-known, standard Radix+jsdom
// test-environment gap — not an application behavior change.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
