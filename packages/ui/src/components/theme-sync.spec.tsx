import { afterEach, describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ThemeSync } from "./theme-sync";

function setCookie(value: string) {
  document.cookie = `crm-theme=${value}; path=/`;
}

describe("ThemeSync", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.cookie = "crm-theme=; path=/; max-age=0";
  });

  it("re-applies a saved dark theme to a fresh document element", () => {
    setCookie("dark");
    document.documentElement.removeAttribute("data-theme");

    render(<ThemeSync />);

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("re-applies a saved light theme", () => {
    setCookie("light");

    render(<ThemeSync />);

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("leaves the attribute off for the system preference", () => {
    setCookie("system");
    document.documentElement.setAttribute("data-theme", "dark");

    render(<ThemeSync />);

    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });
});
