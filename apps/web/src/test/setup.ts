import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// `vitest.config.mts` sets `globals: false`, so @testing-library/react's own
// auto-cleanup (which relies on a global `afterEach`) never registers —
// without this, DOM from one test leaks into the next within the same file.
afterEach(() => {
  cleanup();
});
