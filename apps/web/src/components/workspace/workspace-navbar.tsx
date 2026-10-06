"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Badge,
  ChevronDownIcon,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  recipes,
} from "@crm/ui";
import { NavItemLabel, isNavItemActive, useVisibleNavGroups } from "./nav-items";
import { chromeNavItemClassName } from "./workspace-sidebar";

/**
 * Story 129 — the `NAVBAR` presentation, and the default one: every branch
 * that never touches the Settings → Branding layout control gets this.
 *
 * It is NOT the pre-Story-129 wrapped-rows nav. Each of the six
 * `NAV_GROUPS` is now a `DropdownMenu`, so the bar holds exactly six
 * triggers no matter how many destinations the groups accumulate — the
 * wrapped-rows layout grew a row taller with every story that appended an
 * item, and that is precisely what made a second presentation worth
 * offering. Six triggers fit comfortably from `sm` up, which is why no
 * `overflow-x` container is needed here.
 *
 * Everything it renders comes from `nav-items.tsx`: the same routes, the
 * same label keys, the same icons, the same `isNavItemActive` rule, and
 * the same `NavItemLabel` render path the hamburger menu and the sidebar
 * use. No route or rule is declared in this file.
 *
 * `hidden sm:flex` — below `sm` the header's own hamburger is the only
 * navigation, exactly as before this story.
 */
export function WorkspaceNavbar({
  unreadCount,
  unreadCountKnown,
}: {
  unreadCount: number;
  unreadCountKnown: boolean;
}) {
  const t = useTranslations("workspace");
  const pathname = usePathname();
  const { locale } = useParams<{ locale: string }>();
  const navGroups = useVisibleNavGroups();

  return (
    <nav
      aria-label={t("nav.label")}
      // Story 213 (PR-2.1) — the navbar row continues the header's ink chrome
      // band; its menus still open on the light raised surface.
      className={`${recipes.chrome} hidden items-center gap-1 border-b border-chrome-rule px-6 py-2 sm:flex`}
    >
      {navGroups.map((group) => {
        const groupName = t(`nav.groups.${group.groupKey}`);
        // The section the user is currently in has to stay identifiable
        // with every menu closed, so the trigger takes the exact same
        // active treatment its items do — a reserved `border-s-2` that
        // only ever swaps colour, never layout (see `nav-items.tsx`).
        const isGroupActive = group.items.some((item) =>
          isNavItemActive(pathname, `/${locale}/${item.href}`),
        );
        // Story 92's unread count lives on the `notifications` item, which
        // sits inside a closed menu here. Without mirroring it onto the
        // trigger, an unread notification would be completely invisible
        // until the user happened to open that particular group.
        const groupUnreadCount =
          unreadCountKnown && unreadCount > 0 && group.items.some((i) => i.href === "notifications")
            ? unreadCount
            : 0;
        return (
          <DropdownMenu key={group.groupKey}>
            <DropdownMenuTrigger
              // `.focus-ring-always`, not `.focus-ring`: Radix moves focus
              // to this trigger programmatically (on close, on Escape),
              // where `:focus-visible` does not always match — see
              // `packages/config/tailwind-tokens.css`.
              // Story 196 (RD-2.2) — the active section reads as a neutral fill
              // plus the Tier 1 brand indicator, not the accent tint, so
              // selection and the (indigo) focus ring are separate cues.
              // Story 213 (PR-2.1) — the same chrome item treatment as the rail.
              className={`flex items-center gap-1.5 rounded-control border-s-2 px-2 py-1.5 text-sm transition-colors focus-ring-always ${chromeNavItemClassName(
                isGroupActive,
              )}`}
              // Story 196 — the trigger's aria-label is its whole accessible
              // name, so the unread count has to be in it (recon A11Y-11);
              // the visual badge below is aria-hidden.
              aria-label={
                groupUnreadCount > 0
                  ? t("nav.groupMenuLabelUnread", { group: groupName, count: groupUnreadCount })
                  : t("nav.groupMenuLabel", { group: groupName })
              }
            >
              {/* No `uppercase`/`tracking-wide`: Arabic has no case
                  distinction and letter-spacing breaks its connected
                  letterforms — see `nav-items.tsx`'s doc comment. */}
              {groupName}
              {groupUnreadCount > 0 && (
                <Badge variant="destructive" aria-hidden="true">
                  {groupUnreadCount}
                </Badge>
              )}
              {/* `ChevronDownIcon` is direction-neutral and needs no `rtl:`
                  flip — `packages/ui/src/lib/icons.ts` says so explicitly. */}
              <ChevronDownIcon className="h-4 w-4 shrink-0" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {group.items.map((item) => {
                const href = `/${locale}/${item.href}`;
                const isActive = isNavItemActive(pathname, href);
                return (
                  <DropdownMenuItem
                    key={item.href}
                    asChild
                    // Final UX pass — the page you are on is marked in its menu
                    // too: the accent tint and an accent icon.
                    className="aria-[current=page]:bg-accent-surface aria-[current=page]:font-medium aria-[current=page]:text-accent-hover [&[aria-current=page]_svg]:text-accent"
                  >
                    <Link href={href} aria-current={isActive ? "page" : undefined}>
                      <NavItemLabel
                        item={item}
                        t={t}
                        unreadCount={unreadCount}
                        unreadCountKnown={unreadCountKnown}
                        inMenu
                      />
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}
    </nav>
  );
}
