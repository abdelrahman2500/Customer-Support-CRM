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

describe("LocaleNotFound (portal, Story 96)", () => {
  it("renders the localized title/description and links back to the current locale's home screen", async () => {
    mockedGetLocale.mockResolvedValue("en");
    mockedGetTranslations.mockResolvedValue(((key: string) => key) as never);

    render(await LocaleNotFound());

    expect(screen.getByText("notFound.title")).toBeInTheDocument();
    expect(screen.getByText("notFound.description")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "backLinkLabel" })).toHaveAttribute(
      "href",
      "/en/home",
    );
  });
});
