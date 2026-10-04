"use client";

import * as React from "react";
import { NativeSelect } from "./native-select";
import {
  THEME_PREFERENCES,
  applyThemePreference,
  isThemePreference,
  readThemePreference,
} from "../lib/theme";
import type { ThemePreference } from "../lib/theme";

/**
 * Story 182 (RD-1.5) — lets a person choose light, dark or the system theme.
 *
 * Self-contained: it reads the `crm-theme` cookie after mount (the server
 * cannot know it — see `../lib/theme.ts`), and on change writes the cookie and
 * flips `data-theme` on `<html>` immediately, so the whole page re-themes with
 * no reload. Every string arrives as a prop, like the rest of `@crm/ui`.
 */
export interface ThemeSwitcherProps {
  /** Accessible name, e.g. "Theme". */
  label: string;
  optionLabels: Record<ThemePreference, string>;
  size?: "sm" | "md";
  className?: string;
}

export function ThemeSwitcher({ label, optionLabels, size, className }: ThemeSwitcherProps) {
  const [preference, setPreference] = React.useState<ThemePreference>("system");

  React.useEffect(() => {
    setPreference(readThemePreference(document.cookie));
  }, []);

  return (
    <NativeSelect
      aria-label={label}
      size={size}
      className={className}
      value={preference}
      options={THEME_PREFERENCES.map((value) => ({ value, label: optionLabels[value] }))}
      onValueChange={(value) => {
        if (!isThemePreference(value)) {
          return;
        }
        setPreference(value);
        applyThemePreference(value);
      }}
    />
  );
}
