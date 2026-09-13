"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  Button,
  SidebarToggleIcon,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@crm/ui";
import { localeDirection } from "@/i18n/direction";
import { NAV_GROUPS, NavItemLabel, isNavItemActive } from "./nav-items";

/** Story 129 — the collapsed/expanded flag is a PER-USER, per-browser view
 * convenience, deliberately kept separate from the admin's branch-level
 * `navigationLayout` setting: one is "which navigation does this branch
 * use", the other is "how wide do I personally want the rail right now".
 * They must never be conflated — persisting this to `BrandingConfig` would
 * let one agent's preference re-render every colleague's workspace. */
const COLLAPSED_STORAGE_KEY = "crm.workspace.sidebarCollapsed";

/**
 * Story 129 — the `SIDEBAR` presentation, rendered only when a branch
 * admin opts into it. A genuinely vertical surface rather than a rotated
 * navbar:
 *
 * - It owns its own scroll (`sticky top-0 max-h-screen overflow-y-auto`).
 *   Twenty items stacked vertically do not fit a 720px-tall viewport, and
 *   the page's own scroll is the wrong one to use — scrolling the article
 *   you are reading must not scroll the navigation away. The navbar never
 *   had this problem, which is why `nav-items.tsx`'s pre-Story-129 comment
 *   could correctly say no scroll container was needed there.
 * - It is `border-e`, `ps-`/`pe-`, `border-s-2` throughout — never
 *   `border-r`/`pl-`/`left-`. `docs/architecture/12-risks-tradeoffs-and-scope.md`'s
 *   risk #1 names physical-direction classes as this codebase's standing
 *   RTL hazard, and a sidebar is exactly where that leak happens.
 * - `hidden sm:flex` — below `sm` the header's hamburger is the only
 *   navigation, so this rail can never occupy a phone's width.
 *
 * Everything it renders still comes from `nav-items.tsx`: same routes,
 * same labels, same icons, same `isNavItemActive` rule, same
 * `NavItemLabel`. The active treatment is the identical reserved-border
 * swap the navbar uses, applied in a vertical rhythm.
 */
export function WorkspaceSidebar({
  unreadCount,
  unreadCountKnown,
}: {
  unreadCount: number;
  unreadCountKnown: boolean;
}) {
  const t = useTranslations("workspace");
  const pathname = usePathname();
  const { locale } = useParams<{ locale: string }>();
  // Never read `localStorage` during render: the server renders this
  // component too, and a value only the browser has would make the first
  // client render disagree with the server's HTML — a hydration mismatch.
  // Default to expanded, then adopt the stored preference in an effect.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === "true");
    } catch {
      // A browser with storage disabled simply keeps the expanded default.
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((previous) => {
      const next = !previous;
      try {
        window.localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
      } catch {
        // Best-effort — the toggle itself always takes effect regardless.
      }
      return next;
    });
  }

  return (
    <aside
      className={`hidden shrink-0 flex-col gap-2 border-e border-rule bg-surface py-3 sm:sticky sm:top-0 sm:flex sm:max-h-screen sm:overflow-y-auto ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      <div className={`flex px-2 ${collapsed ? "justify-center" : "justify-end"}`}>
        <Button
          variant="outline"
          size="sm"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")}
        >
          {/* `SidebarToggleIcon` is directional (its chevron points at the
              start edge), so it takes the `rtl:rotate-180` flip
              `packages/ui/src/lib/icons.ts` prescribes for exactly this
              case. The glyph itself never changes — `aria-expanded` above
              is what carries the state. */}
          <SidebarToggleIcon className="h-4 w-4 rtl:rotate-180" aria-hidden />
        </Button>
      </div>
      <nav aria-label={t("nav.label")} className="flex flex-col gap-3 px-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.groupKey} className="flex flex-col gap-0.5">
            {/* A real heading, not decoration — and no `uppercase`/
                `tracking-wide`, for the Arabic reasons `nav-items.tsx`
                records. Collapsed it becomes `sr-only` rather than being
                removed, so the grouping survives for a screen reader while
                the rail is only 4rem wide. `break-words`: the rail is a
                fixed `w-60`, and a long Arabic group name must wrap inside
                it rather than widen it. */}
            <p
              className={`px-3 py-1.5 text-xs font-semibold text-ink-subtle ${
                collapsed ? "sr-only" : "break-words"
              }`}
            >
              {t(`nav.groups.${group.groupKey}`)}
            </p>
            {group.items.map((item) => {
              const href = `/${locale}/${item.href}`;
              const isActive = isNavItemActive(pathname, href);
              const link = (
                <Link
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-2 rounded-md border-s-2 px-3 py-2 text-sm transition-colors focus-ring ${
                    collapsed ? "justify-center" : ""
                  } ${
                    isActive
                      ? "border-accent bg-accent-surface font-medium text-ink-strong"
                      : "border-transparent text-ink-muted hover:bg-surface-muted hover:text-ink-strong"
                  }`}
                >
                  <NavItemLabel
                    item={item}
                    t={t}
                    unreadCount={unreadCount}
                    unreadCountKnown={unreadCountKnown}
                    // Collapsed, the label is hidden visually but kept in
                    // the accessibility tree, so it remains the link's
                    // accessible name. The tooltip below is a sighted-user
                    // affordance layered on top of that — never the only
                    // place the name lives.
                    labelClassName={collapsed ? "sr-only" : "truncate"}
                  />
                </Link>
              );
              return (
                <CollapsedItemTooltip
                  key={item.href}
                  enabled={collapsed}
                  label={t(item.labelKey)}
                  // Radix's `side` is physical, with no logical equivalent,
                  // so it is the one place in this file that has to be
                  // derived from the reading direction rather than left to
                  // CSS: the tooltip belongs on the content side of the
                  // rail, which is the left under RTL.
                  side={localeDirection(locale) === "rtl" ? "left" : "right"}
                  trigger={link}
                />
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}

/** Only the collapsed rail needs a tooltip — expanded, the label is right
 * there. Rendering the provider/root only when it is actually used keeps
 * the expanded rail's DOM identical to what it would be without tooltips
 * at all. */
function CollapsedItemTooltip({
  enabled,
  label,
  side,
  trigger,
}: {
  enabled: boolean;
  label: string;
  side: "left" | "right";
  trigger: ReactNode;
}) {
  if (!enabled) {
    return <>{trigger}</>;
  }
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent side={side}>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
