import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { getLocale, getTranslations } from "next-intl/server";
import LocaleNotFound from "./not-found";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(),
  getLocale: vi.fn(),
}));

const mockedGetTranslations = vi.mocked(getTranslations);
const mockedGetLocale = vi.mocked(getLocale);

/**
 * Story 96 created this boundary; Story 177 re-scoped what it is understood to
 * cover.
 *
 * **This boundary does NOT handle unmatched URLs.** `/en/nope` and `/ar/nope`
 * are served from `/_not-found`, outside `[locale]`, and reach
 * `app/not-found.tsx` — see that file and `app/not-found.spec.tsx`. Story 96's
 * original comment claimed otherwise and was wrong; nothing here should be read
 * as covering that path.
 *
 * What this boundary genuinely serves is a **descendant `notFound()`** raised
 * by a page or layout inside `[locale]`. That was proven by routing experiment
 * during Story 177 — a component inside the segment calling `notFound()`
 * renders this file, localised, nested in `[locale]/layout.tsx` — and the
 * assertions below cover its rendering for that path.
 */
describe("LocaleNotFound (Stories 96/177) — descendant notFound() boundary", () => {
  it("renders the localized title/description and links back within the active locale", async () => {
    mockedGetLocale.mockResolvedValue("ar");
    mockedGetTranslations.mockResolvedValue(((key: string) => key) as never);

    render(await LocaleNotFound());

    expect(screen.getByText("notFound.title")).toBeInTheDocument();
    expect(screen.getByText("notFound.description")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "backLinkLabel" })).toHaveAttribute("href", "/ar/home");
  });

  /** It nests inside `[locale]/layout.tsx`, which owns the single document.
   * Rendering its own `<html>`/`<body>` here would give the segment two of
   * each — the exact defect Story 177 fixed on the root boundary. */
  it("renders no document tags of its own", async () => {
    mockedGetLocale.mockResolvedValue("en");
    mockedGetTranslations.mockResolvedValue(((key: string) => key) as never);

    const { container } = render(await LocaleNotFound());

    expect(container.querySelector("html")).toBeNull();
    expect(container.querySelector("body")).toBeNull();
  });
});
