import * as React from "react";
import { cn } from "../lib/cn";
import { recipes } from "../lib/recipes";
import type { LucideIcon } from "../lib/icons";
import { Card } from "./card";

/**
 * Story 214 (PR-2.2) — the one sign-in layout both apps use (agents and
 * customers), so the first screen of the product reads the same everywhere.
 *
 * - The form column comes FIRST in the DOM (it owns the page's single `h1`
 *   and keeps the keyboard on the form); from `lg` it moves to the logical
 *   end with `order-last`, which mirrors under RTL with nothing to configure.
 * - The brand panel is the ink chrome (the product's signature) with one
 *   restrained brand wash — the only gradient the design language allows —
 *   in both themes (no bright panel in dark mode). Real content, so it is not
 *   `aria-hidden`; below `lg` it is not rendered and the form column carries
 *   the product name instead.
 * - The form sits in a card with the decorative accent rail.
 *
 * Translation-free: every string is a prop.
 */
export interface AuthFeature {
  key: string;
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface AuthLayoutProps {
  /** The page-level controls (language, theme), at the inline end. */
  controls?: React.ReactNode;
  /** The product name; shown above the title below `lg`. */
  productName: string;
  /** The page's `h1` ("Sign in"). */
  title: string;
  /** The form card's contents (alerts, the form, a help hint). */
  children: React.ReactNode;
  panel: {
    headline: string;
    subheadline: string;
    features: AuthFeature[];
  };
}

export function AuthLayout({ controls, productName, title, children, panel }: AuthLayoutProps) {
  return (
    <main className="min-h-screen bg-surface-sunk">
      <div className="mx-auto flex min-h-screen w-full max-w-screen-2xl flex-col lg:flex-row">
        <section className="flex flex-1 flex-col px-surface py-shell sm:px-shell lg:order-last">
          {controls && <div className="flex flex-wrap justify-end gap-inline">{controls}</div>}
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-sm">
              <div className="mb-stack flex flex-col gap-tight text-center">
                <span className="text-sm font-medium text-ink-muted lg:hidden">{productName}</span>
                <h1 className="text-title text-ink">{title}</h1>
              </div>
              <Card elevation="raised" className="overflow-hidden">
                <div aria-hidden className="h-1 w-full bg-accent" />
                <div className="flex flex-col gap-stack p-surface sm:p-shell">{children}</div>
              </Card>
            </div>
          </div>
        </section>

        <aside
          className={cn(
            recipes.chrome,
            "relative hidden overflow-hidden lg:flex lg:flex-1 lg:flex-col lg:justify-center lg:p-shell",
          )}
        >
          {/* The brand wash: decorative, vertical (identical under both
              reading directions), Tier 1 brand only. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand/30 via-brand/5 to-transparent"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-32 -end-24 h-96 w-96 rounded-pill bg-chrome-accent/10 blur-3xl"
          />
          <div className="relative flex max-w-lg flex-col gap-stack">
            <span className="text-sm font-medium text-chrome-muted">{productName}</span>
            <h2 className="text-title text-chrome-ink">{panel.headline}</h2>
            <p className="text-body-lg text-chrome-muted">{panel.subheadline}</p>
            <ul className="mt-section flex flex-col gap-section">
              {panel.features.map(({ key, icon: Icon, title: featureTitle, description }) => (
                <li key={key} className="flex items-start gap-stack">
                  <span
                    aria-hidden
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-surface bg-chrome-raised text-chrome-accent ring-1 ring-chrome-rule"
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="flex flex-col gap-tight">
                    <span className="text-sm font-semibold text-chrome-ink">{featureTitle}</span>
                    <span className="text-sm text-chrome-muted">{description}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}
