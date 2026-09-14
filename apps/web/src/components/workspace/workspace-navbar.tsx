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
} from "@crm/ui";
import { NAV_GROUPS, NavItemLabel, isNavItemActive } from "./nav-items";

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

  return (
    <nav
      aria-label={t("nav.label")}
      className="hidden items-center gap-1 border-b border-rule bg-surface px-6 py-2 sm:flex"
    >
      {NAV_GROUPS.map((group) => {
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
              className={`flex items-center gap-1.5 rounded-md border-s-2 px-2 py-1.5 text-sm transition-colors focus-ring-always ${
                isGroupActive
                  ? "border-accent bg-accent-surface font-medium text-ink-strong"
                  : "border-transparent text-ink-muted hover:bg-surface-muted hover:text-ink-strong"
              }`}
              aria-label={t("nav.groupMenuLabel", { group: groupName })}
            >
              {/* No `uppercase`/`tracking-wide`: Arabic has no case
                  distinction and letter-spacing breaks its connected
                  letterforms — see `nav-items.tsx`'s doc comment. */}
              {groupName}
              {groupUnreadCount > 0 && (
                <Badge
                  variant="destructive"
                  aria-label={t("nav.unreadNotificationsLabel", { count: groupUnreadCount })}
                >
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
                  <DropdownMenuItem key={item.href} asChild>
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
