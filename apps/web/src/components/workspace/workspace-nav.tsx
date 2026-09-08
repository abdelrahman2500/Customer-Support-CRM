"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Fragment, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import type { AuthenticatedUser } from "@crm/shared";
import { useBrandingQuery } from "@/hooks/use-branding";
import { useMyBranchMembershipsQuery } from "@/hooks/use-branch-memberships";
import { useUnreadNotificationCountQuery } from "@/hooks/use-notifications";
import { useMentionNotifications } from "@/hooks/use-mention-notifications";
import { useRealtimeConnectionIssue } from "@/lib/realtime-connection";
import { useErrorMessage } from "@/hooks/use-error-message";
import {
  Alert,
  ApiKeysIcon,
  AuditLogsIcon,
  AutomationRulesIcon,
  Badge,
  BranchesIcon,
  Button,
  CustomersIcon,
  DashboardIcon,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  KbCategoriesIcon,
  KnowledgeBaseIcon,
  MenuIcon,
  MySessionsIcon,
  NotificationTemplatesIcon,
  NotificationsIcon,
  QuickRepliesIcon,
  ReportsIcon,
  RolesIcon,
  SettingsIcon,
  SlaPoliciesIcon,
  TicketCategoriesIcon,
  TicketsIcon,
  UsersIcon,
  WebhookSubscriptionsIcon,
} from "@crm/ui";
import type { LucideIcon } from "@crm/ui";
import { clearAccessToken, logout, switchBranch, updatePreferredLocale } from "@/lib/api";
import { clearQueryCache } from "@/lib/query-client-registry";

/** Story 119 — `apps/web/src/i18n/routing.ts`'s own configured locales. */
const LOCALES = ["en", "ar"] as const;

/** Swaps the leading `/{locale}` segment of `pathname` for `targetLocale`
 * — a plain string operation, mirroring this codebase's own "no
 * `next-intl/navigation` helper anywhere" convention (confirmed by grep
 * while authoring this story). Falls back to just `/{targetLocale}` if
 * `pathname` doesn't start with the expected segment (should not happen
 * in practice — every route here is locale-prefixed). */
function buildLocalePath(pathname: string, currentLocale: string, targetLocale: string): string {
  const prefix = `/${currentLocale}`;
  if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
    return `/${targetLocale}${pathname.slice(prefix.length)}`;
  }
  return `/${targetLocale}`;
}

/**
 * Story 44 — the top-level Agent Workspace screens, in a fixed,
 * always-rendered order (day-to-day operational screens first, then
 * administrative/oversight screens). No client-side permission gating: no
 * such pattern exists anywhere in this codebase, and the seeded `Agent`
 * role has zero granted permissions today, so there is no real per-permission
 * signal to key visibility off — a screen the current session lacks
 * permission for renders its own existing 403/forbidden state after
 * navigation, exactly as it already does when reached by direct URL.
 *
 * Story 51 — `knowledge-base` appended as the new last entry, the same
 * append convention every prior addition to this list has used.
 *
 * Story 56 — `reports` appended as the new last entry, same convention.
 *
 * Story 57 — `automation-rules` appended as the new last entry, same
 * convention.
 *
 * Story 61 — `notification-templates` appended as the new last entry,
 * same convention.
 *
 * Story 62 — `branding` appended as the new last entry, same convention.
 *
 * Story 81 — `ai-settings` appended as the new last entry, same
 * convention.
 *
 * Story 82 — the header consumes `useBrandingQuery()` (Story 62's own
 * agent-facing query, unchanged): a configured logo replaces the plain
 * app-name text link, and `primaryColor` tints the header's own bottom
 * border via a CSS custom property + a Tailwind arbitrary-value class
 * with a literal fallback — an unconfigured branch (every branch today)
 * renders pixel-identical to before this story. See that story's own
 * plan, "Design decision", for why this is safe relative to
 * `docs/architecture/12-risks-tradeoffs-and-scope.md`'s RTL/i18n risk.
 *
 * Story 91 — `quick-replies` appended as the new last entry, same
 * convention.
 *
 * Story 120 — `ticket-categories` appended as the new last entry, same
 * convention.
 *
 * Story 92 — the `notifications` nav link gains an unread-count `Badge`
 * from `useUnreadNotificationCountQuery()`. Rendered only when the count
 * is a real, positive number; a loading or errored query (or a `0` count)
 * renders no badge at all — the link itself is never affected, mirroring
 * this codebase's own "a fetch hiccup never breaks the primary flow"
 * convention (e.g. `ChatComposer`'s quick-reply picker, Story 91).
 *
 * Story 118 — a branch switcher next to "signed in as", rendered only
 * when `useMyBranchMembershipsQuery()` returns more than one row — every
 * user before this story (and any user who has never been granted a
 * second membership) sees no new UI at all. Switching calls
 * `switchBranch` (a fresh access token + rotated refresh cookie), clears
 * every cached query (Story 95's existing helper — every branch-scoped
 * query is now stale for the new active branch), and `router.refresh()`s
 * — not a client-side `router.push()` — so this route's own server
 * components (`user`/`AuthenticatedUser` above is fetched server-side by
 * the parent layout, `fetchCurrentUser()`) actually re-render with the
 * new active branch too.
 *
 * Story 119 — a language `<select>` next to the branch switcher, always
 * rendered (unlike the branch switcher, every user has exactly one of
 * exactly two locales at all times — there's no "only one option"
 * case to hide it for). Persists the choice (best-effort — a failed
 * `PATCH` never blocks the actual switch) and navigates into the same
 * page under the new locale segment.
 *
 * RM-11 — Mobile-Responsive Navigation. Below `sm` the flat, ~19-item
 * `<nav>` below is hidden (`hidden sm:flex`, the same pure-CSS,
 * mobile-first pattern RM-10 used) and a hamburger `DropdownMenuTrigger`
 * takes its place, opening the identical set of links as `DropdownMenuItem`
 * `asChild` `Link`s. `DropdownMenuContent` only mounts in the DOM once
 * opened (Radix's own default, unrelated to CSS), so the two link sets
 * never coexist and every pre-existing test that queries a nav link by
 * name/href keeps finding exactly one match. `NavItemLabel` is the one
 * shared render path for a nav item's label + unread badge, so the
 * desktop and mobile lists can never drift apart. RTL correctness is
 * inherited for free: `MenuIcon` is direction-neutral (no chevron to
 * flip), and `DropdownMenuContent` shares its floating-panel styling with
 * `Select`, already relied on for RTL throughout this app.
 *
 * RM-20 — `webhook-subscriptions` appended as the new last entry before
 * `my-sessions`, same convention.
 *
 * RM-22 — `api-keys` appended the same way.
 *
 * RM-23 — `settings` appended the same way — a consolidated view over the
 * three settings screens already in this list (`branding`, `aiSettings`,
 * `businessHours`), not a replacement for any of them.
 *
 * RM-27 — `kb-categories` inserted right after `knowledge-base` (grouped
 * with its own domain, rather than appended last like every entry above),
 * mirroring how `ticket-categories` sits as the Ticketing domain's own
 * managed-vocabulary screen.
 *
 * Batch 3 (UX audit) — the list above had grown to 23 flat, ungrouped
 * items with no visual sectioning at all. Regrouped into six named
 * sections (Recon's own proposed grouping) with a divider between
 * sections on the desktop `<nav>` and a `DropdownMenuLabel`/
 * `DropdownMenuSeparator` per section in the mobile menu — the items
 * themselves are unchanged (same hrefs, same labels, same active-route
 * logic), so this is purely a presentation change over the same flat list
 * of destinations.
 *
 * Also drops the three duplicate entries RM-23's Settings consolidation
 * left behind: `branding`, `ai-settings` and `business-hours` are now
 * shown only inside `settings`'s own tabs (`SettingsView`), exactly as
 * RM-23's own doc comment already described `settings` as "a consolidated
 * view over the three settings screens already in this list" — it never
 * actually removed those three from nav. Their routes are untouched and
 * still reachable by a direct link/bookmark; only the redundant top-level
 * nav entries are gone.
 *
 * Workspace Navigation UX audit — Batch 3 gave the six groups real
 * boundaries but, on desktop, only a thin divider between them: the
 * group's own name existed only in the mobile `DropdownMenuLabel`, so the
 * desktop row read as one long, icon-less list of ~20 links rather than
 * six sections. This pass keeps that IA and every href/label/active-route
 * rule exactly as Batch 3 left them, and changes only presentation:
 *
 * - Every item gets a `LucideIcon` (see `packages/ui/src/lib/icons.ts`'s
 *   own "Workspace navigation" section), rendered once in `NavItemLabel`
 *   so desktop and mobile can never drift apart, same as the label/badge
 *   already didn't.
 * - The desktop `<nav>` renders one row per group — the same
 *   `nav.groups.*` copy the mobile menu already had, styled exactly like
 *   `DropdownMenuLabel` (`text-xs font-semibold text-ink-subtle`, no
 *   `uppercase`/`tracking-wide`: Arabic has no case distinction, and
 *   letter-spacing visibly breaks Arabic's connected letterforms, so a
 *   treatment that reads as "just a label" in English would read as
 *   broken in Arabic) — instead of the old single wrapped row with an
 *   inert divider between groups.
 * - The active item reserves a `border-s-2 border-transparent` on every
 *   item (active or not), so becoming active only ever swaps that to
 *   `border-accent` — a real, non-colour cue (position + weight + tint,
 *   not tint alone) that never shifts the row's layout when it appears.
 * - Raw `slate-*`/`white` utility classes throughout this file (both the
 *   header and the nav) are replaced with the semantic tokens Story S-1
 *   already defined for the rest of the app (`bg-surface`, `text-ink*`,
 *   `border-rule*`, `bg-accent-surface`) — this file had never been
 *   migrated off the pre-S-1 palette.
 * - No sidebar, no collapse state, no second route-loading mechanism:
 *   this stays the same in-flow, top-of-page `<nav>` it already was, so
 *   the page's own normal scroll still handles a tall nav — there is
 *   nothing here that needs its own scroll container. See this batch's
 *   own final report for why a sidebar was considered and declined.
 */
interface NavLinkItem {
  readonly href: string;
  readonly labelKey: string;
  readonly icon: LucideIcon;
}

interface NavGroup {
  readonly groupKey: string;
  readonly items: readonly NavLinkItem[];
}

const NAV_GROUPS: readonly NavGroup[] = [
  {
    groupKey: "workspace",
    items: [
      { href: "dashboard", labelKey: "nav.dashboard", icon: DashboardIcon },
      { href: "tickets", labelKey: "nav.tickets", icon: TicketsIcon },
      { href: "customers", labelKey: "nav.customers", icon: CustomersIcon },
      { href: "knowledge-base", labelKey: "nav.knowledgeBase", icon: KnowledgeBaseIcon },
      { href: "kb-categories", labelKey: "nav.kbCategories", icon: KbCategoriesIcon },
      { href: "notifications", labelKey: "nav.notifications", icon: NotificationsIcon },
    ],
  },
  {
    groupKey: "ticketingConfig",
    items: [
      { href: "sla-policies", labelKey: "nav.slaPolicies", icon: SlaPoliciesIcon },
      { href: "ticket-categories", labelKey: "nav.ticketCategories", icon: TicketCategoriesIcon },
      { href: "automation-rules", labelKey: "nav.automationRules", icon: AutomationRulesIcon },
      { href: "quick-replies", labelKey: "nav.quickReplies", icon: QuickRepliesIcon },
    ],
  },
  {
    groupKey: "reporting",
    items: [
      { href: "reports", labelKey: "nav.reports", icon: ReportsIcon },
      { href: "audit-logs", labelKey: "nav.auditLogs", icon: AuditLogsIcon },
    ],
  },
  {
    groupKey: "administration",
    items: [
      { href: "branches", labelKey: "nav.branches", icon: BranchesIcon },
      { href: "users", labelKey: "nav.users", icon: UsersIcon },
      { href: "roles", labelKey: "nav.roles", icon: RolesIcon },
    ],
  },
  {
    groupKey: "system",
    items: [
      {
        href: "notification-templates",
        labelKey: "nav.notificationTemplates",
        icon: NotificationTemplatesIcon,
      },
      {
        href: "webhook-subscriptions",
        labelKey: "nav.webhookSubscriptions",
        icon: WebhookSubscriptionsIcon,
      },
      { href: "api-keys", labelKey: "nav.apiKeys", icon: ApiKeysIcon },
    ],
  },
  {
    groupKey: "account",
    items: [
      { href: "settings", labelKey: "nav.settings", icon: SettingsIcon },
      { href: "my-sessions", labelKey: "nav.mySessions", icon: MySessionsIcon },
    ],
  },
];

/** RM-11 — the one shared render path for a nav item's visible label plus
 * its Story 92 unread-count badge, so the desktop `<nav>` and the mobile
 * `DropdownMenu` can never render different content for the same item.
 *
 * Workspace Navigation UX audit — also the one shared render path for the
 * item's icon, for the same reason. `aria-hidden`: the icon sits beside
 * the label it illustrates, so per `packages/ui`'s own icon convention
 * the accessible name comes from the text alone. */
function NavItemLabel({
  item,
  t,
  unreadCount,
  unreadCountKnown,
}: {
  item: NavLinkItem;
  t: ReturnType<typeof useTranslations>;
  unreadCount: number;
  unreadCountKnown: boolean;
}) {
  const Icon = item.icon;
  return (
    <>
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {t(item.labelKey)}
      {item.href === "notifications" && unreadCountKnown && unreadCount > 0 && (
        <Badge
          variant="destructive"
          aria-label={t("nav.unreadNotificationsLabel", { count: unreadCount })}
        >
          {unreadCount}
        </Badge>
      )}
    </>
  );
}

export function WorkspaceNav({ user }: { user: AuthenticatedUser }) {
  const t = useTranslations("workspace");
  const router = useRouter();
  const pathname = usePathname();
  const { locale } = useParams<{ locale: string }>();
  const brandingQuery = useBrandingQuery();
  const unreadCountQuery = useUnreadNotificationCountQuery();
  const unreadCount = unreadCountQuery.data?.unreadCount ?? 0;
  // RM-06 — mounted here (rather than a single page) since this component
  // is rendered on every agent-workspace page, mirroring how its own
  // unread-count badge already needs to stay live regardless of which
  // screen is open.
  useMentionNotifications(user.id);
  // Batch 7 (UX audit) — the shared realtime connection's status; no
  // realtime hook anywhere previously surfaced a dropped connection to the
  // user at all (silence, indistinguishable from "nothing happened yet").
  const connectionIssue = useRealtimeConnectionIssue();
  const membershipsQuery = useMyBranchMembershipsQuery();
  const memberships = membershipsQuery.data ?? [];
  const errorMessage = useErrorMessage();
  const [branchSwitchError, setBranchSwitchError] = useState<string | null>(null);

  /**
   * Story 41 — calls the real `POST /auth/logout` (revoking the refresh
   * token server-side) before the existing local cleanup. `logout()` is
   * itself best-effort (it never throws), but the `catch` here is a second,
   * defense-in-depth guarantee at this call site: local cleanup — cookie
   * cleared, redirected — always runs, even if `logout()` were to reject,
   * so the user's intent to leave is never blocked on a round-trip.
   *
   * Story 95 — also clears every cached query, so a different user signing
   * in next, in the same tab, never sees a flash of this session's cached
   * data before their own queries refetch.
   */
  async function handleSignOut() {
    try {
      await logout();
    } catch {
      // Best-effort — local sign-out below always proceeds regardless.
    }
    clearAccessToken();
    clearQueryCache();
    router.push(`/${locale}/login`);
  }

  /**
   * Story 118 — `value` encodes both `branchId`/`departmentId` (a
   * membership is unique on the pair, not `branchId` alone) as
   * `"branchId::departmentId-or-empty"` — plain `<select>` values are
   * always single strings.
   *
   * Unlike `handleSignOut`/`handleSwitchLocale` below, `switchBranch(...)`
   * is not a secondary side effect of some other action that should
   * proceed regardless — it *is* the action the user asked for. A
   * rejection here (a stale membership, a network blip) must not
   * silently clear the cache/refresh as if it had succeeded: that would
   * leave the session on the branch it was already on while looking like
   * nothing happened. On failure this sets a visible message instead and
   * returns without touching the cache/route; the `<select>` itself
   * already reverts to the still-active membership on the next render,
   * since its `value` is derived from `memberships`, not from whatever
   * the browser's native dropdown shows mid-interaction.
   */
  async function handleSwitchBranch(value: string) {
    const [branchId, departmentId] = value.split("::");
    if (!branchId) {
      return;
    }
    setBranchSwitchError(null);
    try {
      await switchBranch(branchId, departmentId || undefined);
    } catch (error) {
      setBranchSwitchError(
        errorMessage(error, {
          forbidden: t("branchSwitcher.actionForbidden"),
          generic: t("branchSwitcher.actionFailed"),
        }),
      );
      return;
    }
    clearQueryCache();
    router.refresh();
  }

  /** Story 119 — best-effort persist (a failed `PATCH` never blocks the
   * actual language switch, mirroring `handleSignOut`'s own `logout()`
   * try/catch for a non-critical side effect), then a plain
   * `router.push()` into the new locale — no token/cache implications,
   * unlike `handleSwitchBranch` above. */
  async function handleSwitchLocale(targetLocale: string) {
    if (targetLocale === locale) {
      return;
    }
    try {
      await updatePreferredLocale(targetLocale as "en" | "ar");
    } catch {
      // Best-effort — the language switch below always proceeds regardless.
    }
    router.push(buildLocalePath(pathname ?? `/${locale}`, locale, targetLocale));
  }

  return (
    <>
      <header
        style={
          { "--brand-primary": brandingQuery.data?.primaryColor ?? undefined } as CSSProperties
        }
        className="flex items-center justify-between border-b-2 border-[var(--brand-primary,rgb(var(--rule)))] bg-surface px-6 py-3"
      >
        {brandingQuery.data?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brandingQuery.data.logoUrl} alt={t("appName")} className="h-8 w-auto" />
        ) : (
          <Link href={`/${locale}/tickets`} className="text-sm font-semibold text-ink-strong">
            {t("appName")}
          </Link>
        )}
        <div className="flex items-center gap-4 text-sm text-ink-muted">
          <span>{t("signedInAs", { name: user.fullName })}</span>
          {memberships.length > 1 && (
            <select
              aria-label={t("branchSwitcher.label")}
              className="h-8 rounded-md border border-rule-strong bg-surface px-2 text-sm"
              value={`${memberships.find((m) => m.isActive)?.branchId ?? ""}::${
                memberships.find((m) => m.isActive)?.departmentId ?? ""
              }`}
              onChange={(event) => void handleSwitchBranch(event.target.value)}
            >
              {memberships.map((membership) => (
                <option
                  key={`${membership.branchId}::${membership.departmentId ?? ""}`}
                  value={`${membership.branchId}::${membership.departmentId ?? ""}`}
                >
                  {membership.departmentId
                    ? t("branchSwitcher.branchAndDepartment", {
                        branch: membership.branchName,
                        department: membership.departmentName ?? "",
                      })
                    : membership.branchName}
                </option>
              ))}
            </select>
          )}
          {branchSwitchError && (
            <span role="alert" className="text-danger-solid">
              {branchSwitchError}
            </span>
          )}
          <select
            aria-label={t("languageSwitcher.label")}
            className="h-8 rounded-md border border-rule-strong bg-surface px-2 text-sm"
            value={locale}
            onChange={(event) => void handleSwitchLocale(event.target.value)}
          >
            {LOCALES.map((localeOption) => (
              <option key={localeOption} value={localeOption}>
                {t(`languageSwitcher.options.${localeOption}`)}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            {t("signOut")}
          </Button>
        </div>
      </header>
      {/* Batch 7 (UX audit) — a non-destructive banner while the shared
          realtime connection is down after having been up (see
          `useRealtimeConnectionIssue`'s own doc comment for exactly which
          case that is). Live notifications/presence/ticket updates are
          simply not arriving right now; nothing here is destructive or
          blocks the rest of the page. */}
      {connectionIssue && (
        <Alert variant="default" className="rounded-none border-x-0 border-t-0 text-center text-xs">
          {t("realtimeReconnecting")}
        </Alert>
      )}
      {/* RM-11 — the hamburger toggle only, below `sm`; the flat `<nav>`
          below takes over at `sm` and up. */}
      <div className="border-b border-rule bg-surface px-6 py-2 sm:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" aria-label={t("nav.menuLabel")}>
              <MenuIcon className="h-4 w-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {NAV_GROUPS.map((group, groupIndex) => (
              <Fragment key={group.groupKey}>
                {groupIndex > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel>{t(`nav.groups.${group.groupKey}`)}</DropdownMenuLabel>
                {group.items.map((item) => {
                  const href = `/${locale}/${item.href}`;
                  const isActive = pathname === href || pathname?.startsWith(`${href}/`);
                  return (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link href={href} aria-current={isActive ? "page" : undefined}>
                        <NavItemLabel
                          item={item}
                          t={t}
                          unreadCount={unreadCount}
                          unreadCountKnown={unreadCountQuery.isSuccess}
                        />
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <nav
        aria-label={t("nav.label")}
        className="hidden flex-col gap-2 border-b border-rule bg-surface px-6 py-3 sm:flex"
      >
        {/* Workspace Navigation UX audit — one row per group, replacing the
            old single wrapped row + inert divider: each group's own name is
            now visible on desktop too (previously only in the mobile
            menu), and every group keeps its items on its own row even when
            they wrap, so two groups can never visually run together at a
            narrower desktop width. `items-start` (not `-center`): the
            items column can itself wrap onto more than one line, and the
            label should sit at the top of that block, not centred against
            its full height. */}
        {NAV_GROUPS.map((group) => (
          <div key={group.groupKey} className="flex items-start gap-x-4 gap-y-1">
            {/* Same treatment as `menuLabelClassName` (the mobile
                `DropdownMenuLabel`) — visually subordinate to the items
                beside it, but real text, not decoration: no `uppercase`/
                `tracking-wide` (see this file's own doc comment for why
                that matters for Arabic). */}
            <span className="w-36 shrink-0 py-1.5 text-xs font-semibold text-ink-subtle">
              {t(`nav.groups.${group.groupKey}`)}
            </span>
            <div className="flex flex-1 flex-wrap items-center gap-1">
              {group.items.map((item) => {
                const href = `/${locale}/${item.href}`;
                // Story 96 — Navigation & Route Robustness. A nested route
                // (e.g. `/en/tickets/ticket-1`) still marks its own
                // top-level `Tickets` link current, so it doesn't just match
                // on exact equality.
                const isActive = pathname === href || pathname?.startsWith(`${href}/`);
                return (
                  <Link
                    key={item.href}
                    href={href}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex items-center gap-1.5 rounded-md border-s-2 px-2 py-1.5 text-sm transition-colors focus-ring ${
                      isActive
                        ? "border-accent bg-accent-surface font-medium text-ink-strong"
                        : "border-transparent text-ink-muted hover:bg-surface-muted hover:text-ink-strong"
                    }`}
                  >
                    <NavItemLabel
                      item={item}
                      t={t}
                      unreadCount={unreadCount}
                      unreadCountKnown={unreadCountQuery.isSuccess}
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </>
  );
}
