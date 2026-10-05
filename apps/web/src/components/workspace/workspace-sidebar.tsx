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
  recipes,
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

/** Story 213 (PR-2.1) — a nav item on the ink chrome: the reserved
 * `border-s-2` only ever swaps colour (never layout), the current item gets
 * the active chrome step plus the Tier 1 brand edge, the rest stay muted. */
export function chromeNavItemClassName(isActive: boolean): string {
  return isActive
    ? "border-brand bg-chrome-active font-medium text-chrome-ink"
    : "border-transparent text-chrome-muted hover:bg-chrome-raised hover:text-chrome-ink";
}

/**
 * Story 213 (PR-2.1) — the grouped navigation drawn on the ink chrome,
 * shared by the desktop rail (`WorkspaceSidebar`) and the mobile drawer
 * (the header's Sheet), so both list the same routes, labels, icons and
 * active rule from `nav-items.tsx`.
 *
 * Group headings are real text, never `uppercase`/tracked (Arabic). When the
 * rail is collapsed the labels become `sr-only` — still each link's
 * accessible name — and a tooltip on the content side is layered on top.
 */
export function RailNav({
  collapsed = false,
  unreadCount,
  unreadCountKnown,
  onNavigate,
}: {
  collapsed?: boolean;
  unreadCount: number;
  unreadCountKnown: boolean;
  onNavigate?: () => void;
}) {
  const t = useTranslations("workspace");
  const pathname = usePathname();
  const { locale } = useParams<{ locale: string }>();

  return (
    <nav aria-label={t("nav.label")} className="flex flex-col gap-section px-2">
      {NAV_GROUPS.map((group) => (
        <div key={group.groupKey} className="flex flex-col gap-0.5">
          <p
            className={`px-3 py-1.5 text-label text-chrome-muted ${
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
                onClick={onNavigate}
                className={`flex items-center gap-2 rounded-control border-s-2 px-3 py-2 text-sm transition-colors duration-fast focus-ring ${
                  collapsed ? "justify-center" : ""
                } ${chromeNavItemClassName(isActive)}`}
              >
                <NavItemLabel
                  item={item}
                  t={t}
                  unreadCount={unreadCount}
                  unreadCountKnown={unreadCountKnown}
                  labelClassName={collapsed ? "sr-only" : "truncate"}
                />
              </Link>
            );
            return (
              <CollapsedItemTooltip
                key={item.href}
                enabled={collapsed}
                label={t(item.labelKey)}
                // Radix's `side` is physical: the tooltip belongs on the
                // content side of the rail, which is the left under RTL.
                side={localeDirection(locale) === "rtl" ? "left" : "right"}
                trigger={link}
              />
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/**
 * Story 129 — the `SIDEBAR` presentation, rendered only when a branch
 * admin opts into it. It owns its own scroll (`sticky top-0 max-h-screen
 * overflow-y-auto`), uses logical classes throughout (RTL), and is
 * `hidden sm:flex` — below `sm` the header's drawer is the only navigation.
 *
 * Story 213 (PR-2.1, visual language v2) — the rail is the ink chrome,
 * continuous with the header band above it, so the two frame the light
 * canvas: the product's signature silhouette. The chrome scopes the focus
 * ring (`.on-chrome`).
 */
export function WorkspaceSidebar({
  unreadCount,
  unreadCountKnown,
}: {
  unreadCount: number;
  unreadCountKnown: boolean;
}) {
  const t = useTranslations("workspace");
  // Never read `localStorage` during render (hydration): default to
  // expanded, then adopt the stored preference in an effect.
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
      className={`${recipes.chrome} hidden shrink-0 flex-col gap-3 border-e border-chrome-rule py-3 sm:sticky sm:top-0 sm:flex sm:max-h-screen sm:overflow-y-auto ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      <div className={`flex px-2 ${collapsed ? "justify-center" : "justify-end"}`}>
        <Button
          variant="chrome"
          size="icon-sm"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")}
        >
          {/* Directional glyph: takes the prescribed `rtl:rotate-180`. The
              glyph never changes — `aria-expanded` carries the state. */}
          <SidebarToggleIcon className="h-4 w-4 rtl:rotate-180" aria-hidden />
        </Button>
      </div>
      <RailNav
        collapsed={collapsed}
        unreadCount={unreadCount}
        unreadCountKnown={unreadCountKnown}
      />
    </aside>
  );
}

/** Only the collapsed rail needs a tooltip — expanded, the label is right
 * there. Rendering the provider/root only when it is actually used keeps
 * the expanded rail's DOM identical to what it would be without tooltips. */
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
