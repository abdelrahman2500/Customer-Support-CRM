"use client";

import * as React from "react";
import { brandCssVariables } from "../lib/brand";
import type { BrandTokens } from "../lib/brand";

/**
 * Story 183 (RD-1.6) — applies a branch's brand tokens (from
 * `deriveBrandTokens`) to everything it wraps.
 *
 * Two places, one set of variables:
 *  - a `display: contents` wrapper, so server-rendered shell content is
 *    branded on first paint (no flash) without adding a layout box;
 *  - `<html>`, after mount, because Radix renders menus, selects and dialogs
 *    into `document.body` — outside the wrapper — and they must match.
 *    Removed again on unmount (e.g. signing out to the unbranded login).
 *
 * `data-brand-accent` is set only when Tier 2 passed its gates; the
 * `[data-brand-accent]` rules in tailwind-tokens.css then swap the accent
 * family. Tier 1 (`--brand`) applies regardless.
 */
export function BrandScope({ tokens, children }: { tokens: BrandTokens | null; children: React.ReactNode }) {
  const variables = React.useMemo(() => brandCssVariables(tokens), [tokens]);
  const hasAccent = Boolean(tokens?.accent);

  React.useEffect(() => {
    const root = document.documentElement;
    const names = Object.keys(variables);
    for (const name of names) {
      root.style.setProperty(name, variables[name]!);
    }
    if (hasAccent) {
      root.setAttribute("data-brand-accent", "");
    }
    return () => {
      for (const name of names) {
        root.style.removeProperty(name);
      }
      root.removeAttribute("data-brand-accent");
    };
  }, [variables, hasAccent]);

  return (
    <div
      className="contents"
      style={variables as React.CSSProperties}
      data-brand-accent={hasAccent ? "" : undefined}
    >
      {children}
    </div>
  );
}
