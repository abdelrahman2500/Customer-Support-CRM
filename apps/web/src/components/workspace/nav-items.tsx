import { useTranslations } from "next-intl";
import {
  ApiKeysIcon,
  AuditLogsIcon,
  AutomationRulesIcon,
  Badge,
  BranchesIcon,
  CustomersIcon,
  DashboardIcon,
  KbCategoriesIcon,
  KnowledgeBaseIcon,
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
import type { NavigationLayout } from "@/lib/branding-api";
import { useBrandingQuery } from "@/hooks/use-branding";

/**
 * Story 129 — this module is the ONE source of truth for the Agent
 * Workspace's navigation. `WorkspaceNavbar` and `WorkspaceSidebar` are two
 * presentations over exactly this list and exactly these rules; neither
 * re-declares a route, a label key, an icon, a permission rule or an
 * active-route rule of its own. Everything below moved here verbatim from
 * `workspace-nav.tsx`, whose accumulated doc comment — the written record
 * of every prior navigation decision — is preserved intact for the same
 * reason it was written.
 *
 * Story 44 — the top-level Agent Workspace screens, in a fixed,
 * always-rendered order (day-to-day operational screens first, then
 * administrative/oversight screens). No client-side permission gating: no
 * such pattern exists anywhere in this codebase, and the seeded `Agent`
 * role has zero granted permissions today, so there is no real per-permission
 * signal to key visibility off — a screen the current session lacks
 * permission for renders its own existing 403/forbidden state after
 * navigation, exactly as it already does when reached by direct URL.
 * Story 129 keeps this exactly as it is, in BOTH presentations: "permission
 * visibility must continue to work as it does today" means preserving this
 * behaviour, not introducing gating.
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
 * components (`user`/`AuthenticatedUser` is fetched server-side by
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
 * RM-11 — Mobile-Responsive Navigation. Below `sm` the desktop navigation
 * is hidden (`hidden sm:flex`, the same pure-CSS, mobile-first pattern
 * RM-10 used) and a hamburger `DropdownMenuTrigger` takes its place,
 * opening the identical set of links as `DropdownMenuItem`
 * `asChild` `Link`s. `DropdownMenuContent` only mounts in the DOM once
 * opened (Radix's own default, unrelated to CSS), so the two link sets
 * never coexist and every pre-existing test that queries a nav link by
 * name/href keeps finding exactly one match. `NavItemLabel` is the one
 * shared render path for a nav item's label + unread badge, so the
 * desktop and mobile lists can never drift apart. RTL correctness is
 * inherited for free: `MenuIcon` is direction-neutral (no chevron to
 * flip), and `DropdownMenuContent` shares its floating-panel styling with
 * `Select`, already relied on for RTL throughout this app. Story 129
 * keeps exactly this mechanism and moves it into `WorkspaceHeader`, so
 * one hamburger now serves both desktop presentations.
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
 *   inert divider between groups. **Both Story 129 presentations inherit
 *   this rule: neither the sidebar's group headings nor the navbar's
 *   group triggers may use `uppercase`/`tracking-wide`.**
 * - The active item reserves a `border-s-2 border-transparent` on every
 *   item (active or not), so becoming active only ever swaps that to
 *   `border-accent` — a real, non-colour cue (position + weight + tint,
 *   not tint alone) that never shifts the row's layout when it appears.
 *   Story 129's sidebar applies the identical treatment in a vertical
 *   rhythm rather than inventing a second one.
 * - Raw `slate-*`/`white` utility classes throughout that file (both the
 *   header and the nav) are replaced with the semantic tokens Story S-1
 *   already defined for the rest of the app (`bg-surface`, `text-ink*`,
 *   `border-rule*`, `bg-accent-surface`) — that file had never been
 *   migrated off the pre-S-1 palette. Both new presentations use the same
 *   tokens; no raw `slate-*` class may be reintroduced.
 * - No sidebar, no collapse state, no second route-loading mechanism:
 *   this stays the same in-flow, top-of-page `<nav>` it already was, so
 *   the page's own normal scroll still handles a tall nav — there is
 *   nothing here that needs its own scroll container. See this batch's
 *   own final report for why a sidebar was considered and declined.
 *
 *   Story 129 supersedes the first two clauses of that last point — and
 *   ONLY because an admin now opts into a sidebar explicitly, per branch,
 *   from Settings → Branding. `NAVBAR` remains the default for every
 *   unconfigured branch, so nothing changes for anyone who never touches
 *   the setting. The third clause still stands, unconditionally: neither
 *   presentation introduces a second route-loading mechanism — both use
 *   the same `useNavigatingRouter`-driven `Link`s and the existing
 *   `NavigationOverlayListener`/per-route `loading.tsx` pair.
 */
export interface NavLinkItem {
  readonly href: string;
  readonly labelKey: string;
  readonly icon: LucideIcon;
}

export interface NavGroup {
  readonly groupKey: string;
  readonly items: readonly NavLinkItem[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
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
 * the accessible name comes from the text alone.
 *
 * Story 129 — now shared by three render paths (the hamburger menu, the
 * navbar's group menus and the sidebar's rows) for exactly the same
 * reason. `labelClassName` is the one concession the sidebar needs: while
 * collapsed it passes `sr-only` so the label stays in the accessibility
 * tree — and therefore stays the item's accessible name — while taking no
 * visual space. It is never used to remove the label. */
export function NavItemLabel({
  item,
  t,
  unreadCount,
  unreadCountKnown,
  labelClassName,
}: {
  item: NavLinkItem;
  t: ReturnType<typeof useTranslations>;
  unreadCount: number;
  unreadCountKnown: boolean;
  labelClassName?: string;
}) {
  const Icon = item.icon;
  const brandingQuery = useBrandingQuery();
  const navigationLayout = brandingQuery.data?.navigationLayout;
  return (
    <>
      <Icon
        className={
          navigationLayout == "NAVBAR" ? "h-4 w-4 shrink-0 -ms-4 me-4" : "h-4 w-4 shrink-0"
        }
        aria-hidden
      />
      <span className={labelClassName}>{t(item.labelKey)}</span>
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

/** Story 96's rule, extracted verbatim: a nested route (e.g.
 * `/en/tickets/ticket-1`) still marks its own top-level link current, so
 * this is a prefix match, not exact equality. The one active-route rule
 * both presentations share — an item cannot read as active in one
 * variant and inactive in the other. */
export function isNavItemActive(pathname: string | null, href: string): boolean {
  return pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
}

/** Story 129 — resolves the configured layout to the one actually
 * rendered. `null` (no `BrandingConfig` row, an unconfigured field, a
 * still-loading or failed branding query) resolves to `NAVBAR` — the
 * presentation every branch had before Story 129, so nothing changes for
 * a branch that never touches the setting. */
export function resolveNavigationLayout(
  layout: NavigationLayout | null | undefined,
): NavigationLayout {
  return layout === "SIDEBAR" ? "SIDEBAR" : "NAVBAR";
}
