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

// RM-15 — jsdom implements no `ResizeObserver` at all, and Radix UI's
// `Checkbox` (installed by Story S-3, first actually rendered inside a
// real `<form>` by a test in this story — `TicketChatCard`'s "send by
// email" checkbox) renders a hidden native `<input>` "bubble" for
// form-submission compatibility whenever it detects a `<form>` ancestor,
// sized via a `ResizeObserver`-backed hook. Without this no-op polyfill,
// rendering a form-embedded `Checkbox` in any test throws
// `ResizeObserver is not defined` — the same category of well-known,
// standard Radix+jsdom test-environment gap `hasPointerCapture`/
// `scrollIntoView` above already document, not an application behavior
// change. `packages/ui`'s own `checkbox.spec.tsx` never renders inside a
// `<form>`, so it never needed this.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
