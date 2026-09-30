import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import RootNotFound from "./not-found";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next-intl/server", () => ({ getTranslations: vi.fn() }));
// `next/font` executes a loader that only exists inside the Next build
// pipeline, so it throws under Vitest. The real value is a class-name string;
// this stands in for it so the font-parity assertion below stays meaningful.
vi.mock("@/lib/fonts", () => ({ fontVariables: "__font_variables__" }));

const mockedCookies = vi.mocked(cookies);
const mockedGetTranslations = vi.mocked(getTranslations);

/** Mirrors the slice of Next's cookie store this boundary actually uses. */
function cookieStore(value?: string) {
  return { get: () => (value === undefined ? undefined : { value }) } as never;
}

/**
 * Story 96 created this boundary; Story 177 made it the reachable, localised,
 * styled one.
 *
 * These assertions are deliberately about **locale resolution and copy source**
 * — the two things that were silently wrong and that a render test can actually
 * see. They cannot prove HTTP status, routing, document ownership or that a
 * stylesheet is emitted; jsdom has no Next router and loads no CSS, which is
 * exactly why the original defect shipped under a passing suite. The browser
 * matrix in this story's plan is the authoritative check for those.
 */
describe("RootNotFound (web, Stories 96/177)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetTranslations.mockImplementation(
      (async (opts: { locale: string }) =>
        ((key: string) => `${opts.locale}:${key}`) as never) as never,
    );
  });

  it("resolves Arabic from the NEXT_LOCALE cookie and renders RTL", async () => {
    mockedCookies.mockResolvedValue(cookieStore("ar"));

    const { container } = render(await RootNotFound());

    const html = container.querySelector("html")!;
    expect(html).toHaveAttribute("lang", "ar");
    expect(html).toHaveAttribute("dir", "rtl");
    expect(screen.getByText("ar:notFound.title")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ar:backLinkLabel" })).toHaveAttribute(
      "href",
      "/ar/tickets",
    );
  });

  it("resolves English from the cookie and renders LTR", async () => {
    mockedCookies.mockResolvedValue(cookieStore("en"));

    const { container } = render(await RootNotFound());

    const html = container.querySelector("html")!;
    expect(html).toHaveAttribute("lang", "en");
    expect(html).toHaveAttribute("dir", "ltr");
    expect(screen.getByText("en:notFound.title")).toBeInTheDocument();
  });

  /** A path the middleware matcher excludes (anything with a dot) reaches this
   * boundary with no cookie at all. */
  it("falls back to the default locale when the cookie is absent", async () => {
    mockedCookies.mockResolvedValue(cookieStore(undefined));

    const { container } = render(await RootNotFound());

    expect(container.querySelector("html")).toHaveAttribute("lang", "en");
    expect(screen.getByText("en:notFound.title")).toBeInTheDocument();
  });

  /** Without the `hasLocale` guard this would reach
   * `import('../../messages/xx.json')` and turn a 404 into a 500. */
  it("falls back to the default locale when the cookie is invalid", async () => {
    mockedCookies.mockResolvedValue(cookieStore("xx"));

    const { container } = render(await RootNotFound());

    expect(container.querySelector("html")).toHaveAttribute("lang", "en");
  });

  /** Copy must come from the shared catalogue, not be duplicated here. */
  it("sources every string from the common namespace rather than hard-coding it", async () => {
    mockedCookies.mockResolvedValue(cookieStore("ar"));

    render(await RootNotFound());

    expect(mockedGetTranslations).toHaveBeenCalledWith({ locale: "ar", namespace: "common" });
    expect(screen.getByText("ar:notFound.description")).toBeInTheDocument();
  });

  /** Typography parity with `[locale]/layout.tsx` — without the font variables
   * Arabic falls back to a system face even once the page is styled. */
  it("carries the font variables and body font class", async () => {
    mockedCookies.mockResolvedValue(cookieStore("ar"));

    const { container } = render(await RootNotFound());

    expect(container.querySelector("html")).toHaveClass("__font_variables__");
    expect(container.querySelector("body")).toHaveClass("font-sans", "antialiased");
  });
});
