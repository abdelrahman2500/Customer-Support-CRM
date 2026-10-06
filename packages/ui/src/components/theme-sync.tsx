"use client";

import * as React from "react";
import { readThemePreference } from "../lib/theme";

/**
 * Demo hardening — keeps the chosen theme when the document element is
 * replaced on the client.
 *
 * `ThemeScript` puts an explicit light/dark on `<html>` before first paint,
 * but it only runs on a full page load. Switching language swaps the
 * `[locale]` layout, so React renders a fresh `<html>` without
 * `data-theme`, and a dark-mode user dropped to light until they reloaded.
 * Rendered inside each locale layout, this re-applies the saved preference
 * whenever that layout mounts — before paint (layout effect), so there is no
 * flash. "system" leaves the attribute off and the media query in charge.
 */
export function ThemeSync() {
  React.useLayoutEffect(() => {
    const preference = readThemePreference(document.cookie);
    if (preference === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", preference);
    }
  }, []);
  return null;
}
