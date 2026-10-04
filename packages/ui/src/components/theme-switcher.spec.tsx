import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeSwitcher } from "./theme-switcher";
import { THEME_COOKIE, readThemePreference } from "../lib/theme";

const LABELS = { system: "System", light: "Light", dark: "Dark" };

afterEach(() => {
  document.cookie = `${THEME_COOKIE}=; path=/; max-age=0`;
  document.documentElement.removeAttribute("data-theme");
});

describe("ThemeSwitcher", () => {
  it("offers system, light and dark under an accessible name, defaulting to system", () => {
    render(<ThemeSwitcher label="Theme" optionLabels={LABELS} />);
    const select = screen.getByRole("combobox", { name: "Theme" });
    expect(select).toHaveValue("system");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "System",
      "Light",
      "Dark",
    ]);
  });

  it("reflects a previously chosen theme from the cookie", async () => {
    document.cookie = `${THEME_COOKIE}=dark; path=/`;
    render(<ThemeSwitcher label="Theme" optionLabels={LABELS} />);
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Theme" })).toHaveValue("dark"));
  });

  it("applies and persists a choice immediately", async () => {
    render(<ThemeSwitcher label="Theme" optionLabels={LABELS} />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Theme" }), "dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(readThemePreference(document.cookie)).toBe("dark");

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Theme" }), "system");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });
});
