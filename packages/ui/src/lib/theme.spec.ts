import { afterEach, describe, expect, it } from "vitest";
import {
  THEME_COOKIE,
  THEME_INIT_SCRIPT,
  applyThemePreference,
  isThemePreference,
  readThemePreference,
} from "./theme";

function clearThemeCookie() {
  document.cookie = `${THEME_COOKIE}=; path=/; max-age=0`;
  document.documentElement.removeAttribute("data-theme");
}

describe("theme preference", () => {
  afterEach(clearThemeCookie);

  it("recognises only the three preferences", () => {
    expect(isThemePreference("dark")).toBe(true);
    expect(isThemePreference("light")).toBe(true);
    expect(isThemePreference("system")).toBe(true);
    expect(isThemePreference("sepia")).toBe(false);
    expect(isThemePreference(undefined)).toBe(false);
  });

  it("reads the preference from a cookie string and defaults to system", () => {
    expect(readThemePreference(`a=1; ${THEME_COOKIE}=dark; b=2`)).toBe("dark");
    expect(readThemePreference(`${THEME_COOKIE}=light`)).toBe("light");
    expect(readThemePreference(`${THEME_COOKIE}=sepia`)).toBe("system");
    expect(readThemePreference("other-crm-theme=dark")).toBe("system");
    expect(readThemePreference(undefined)).toBe("system");
  });

  it("persists an explicit choice and applies it to <html>", () => {
    applyThemePreference("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(readThemePreference(document.cookie)).toBe("dark");

    applyThemePreference("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("hands control back to the OS preference for system", () => {
    applyThemePreference("dark");
    applyThemePreference("system");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(readThemePreference(document.cookie)).toBe("system");
  });

  it("init script applies an explicit cookie before paint and ignores the rest", () => {
    document.cookie = `${THEME_COOKIE}=dark; path=/`;
    new Function(THEME_INIT_SCRIPT)();
    expect(document.documentElement.dataset.theme).toBe("dark");

    clearThemeCookie();
    document.cookie = `${THEME_COOKIE}=system; path=/`;
    new Function(THEME_INIT_SCRIPT)();
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });
});
