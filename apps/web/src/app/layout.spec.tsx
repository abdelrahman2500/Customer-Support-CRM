import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import RootLayout from "./layout";

// The root layout side-effect-imports `@/lib/fonts` so next/font's stylesheet
// (which DEFINES the --font-plex-* variables) is emitted for every route,
// including the 404. That loader only runs inside the Next build pipeline and
// throws under Vitest, so it is stubbed here.
vi.mock("@/lib/fonts", () => ({ fontVariables: "__font_variables__" }));

/**
 * Story 177 — the guard on document ownership.
 *
 * The root layout exists only to own the global stylesheet import. It must
 * render its children and nothing else: `[locale]/layout.tsx` owns `<html
 * lang dir>` and `<body>` for every real route, and `app/not-found.tsx` owns
 * them for the 404. If anyone ever adds document tags here, every route in the
 * app renders two `<html>` and two `<body>` elements — which is the exact
 * shape of the bug this story fixed, reintroduced from the other side.
 *
 * Note what this cannot do: it cannot prove CSS is emitted, which is a build
 * and runtime property. The browser matrix in this story's plan is the
 * authoritative check for that.
 */
describe("RootLayout (Story 177)", () => {
  it("renders its children untouched", () => {
    const { container } = render(RootLayout({ children: <p>child</p> }) as React.ReactElement);

    expect(container.textContent).toBe("child");
  });

  it("renders no document tags of its own", () => {
    const { container } = render(RootLayout({ children: <p>child</p> }) as React.ReactElement);

    expect(container.querySelector("html")).toBeNull();
    expect(container.querySelector("body")).toBeNull();
  });
});
