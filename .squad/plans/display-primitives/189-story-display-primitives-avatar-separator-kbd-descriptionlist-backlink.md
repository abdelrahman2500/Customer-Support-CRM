# Story 189 — Display primitives: Avatar, Separator, Kbd, DescriptionList, BackLink

> CRM UI/UX redesign roadmap item **RD-1.12**. Intake: [`../../stories/display-primitives/display-primitives-avatar-separator-kbd-descriptionlist-backlink/intake.md`](../../stories/display-primitives/display-primitives-avatar-separator-kbd-descriptionlist-backlink/intake.md). Roadmap: [`../crm-ui-ux-redesign/00-overview.md`](../crm-ui-ux-redesign/00-overview.md) §4.2, §6 "RD-1.12".

---

## Prerequisites

- **Story 179 completed** (`bac28a3`, RD-1.2): `rounded-inner`/`rounded-pill`, the `text-caption`/`text-body`/`text-label` type steps, and `cn` registration.
- **Story 185 completed** (`7efabea`, RD-1.8): `Button` uses `@radix-ui/react-slot` for `asChild` (`packages/ui/src/components/button.tsx`), which is the precedent for BackLink's `asChild`.
- **Story 188 completed** (`d8869b2`, RD-1.11): latest precedent for adding exported primitives. See [`../table-v2/188-story-table-v2.md`](../table-v2/188-story-table-v2.md).
- Shared contract: `packages/ui` stays **translation-free and router-free**: no `next-intl`, no `next/link`. All copy and links arrive from the caller.

---

## Story Goal

Add five small, domain-free display primitives that later Stories will compose: the ticket header, inspector, timeline, user menu and shortcut hints. Then replace the five copy-pasted "back to list" links with `BackLink`.

1. **Avatar**: image or grapheme-safe initials, three sizes, optional presence carried in both the dot and the accessible name, and a decorative mode.
2. **Separator**: a token rule, decorative by default.
3. **Kbd**: a keyboard-key hint.
4. **DescriptionList**: term/description pairs, one or two columns.
5. **BackLink**: a direction-aware chevron, token focus ring, and `asChild` so the apps keep `next/link` navigation.
6. The five back links use `BackLink`; hrefs and labels are unchanged; the two portal links gain the focus ring they lacked (recon A11Y-08).

**Not in scope:** using Avatar, Separator, Kbd or DescriptionList in any screen (later Stories), breadcrumbs, any new dependency, and any backend, API, database, auth or routing change.

---

## Context — Read These Files First

1. `packages/ui/src/components/button.tsx` — the `Slot` import from `@radix-ui/react-slot` and the `asChild ? Slot : "button"` pattern. BackLink follows it, adding `Slottable` so the chevron renders inside the slotted child.
2. `packages/ui/src/lib/icons.ts` — `ChevronLeftIcon` (directional: callers add `rtl:rotate-180`). Use the semantic export, never `lucide-react` directly.
3. `packages/ui/src/lib/cn.ts` — every class goes through `cn`.
4. `packages/ui/src/index.ts` — the export list. Add the new components next to related ones (for example after the `Badge` and `Card` exports).
5. The five back links to replace. Each is a `next/link` `Link` wrapping `<span aria-hidden="true" className="inline-block rtl:rotate-180">&larr;</span>{" "}{t("detail.backToList")}`:
   - `apps/web/src/components/tickets/ticket-detail-view.tsx` ~lines 294–307. Class: `focus-ring self-start rounded-sm text-sm font-medium text-ink-muted hover:text-ink hover:underline`. It has a "Batch 3 (UX audit)" comment above it.
   - `apps/web/src/components/customers/customer-detail-view.tsx` ~540–552. Same class and comment.
   - `apps/web/src/components/knowledge-base/article-detail-view.tsx` ~156–168. Same class and comment.
   - `apps/portal/src/components/tickets/ticket-detail-view.tsx` ~116–127. Class `text-sm font-medium text-ink-muted hover:text-ink hover:underline` (**no focus ring**), with an inline comment.
   - `apps/portal/src/components/knowledge-base/article-detail-view.tsx` ~57–68. Same as the portal ticket link.
6. Specs that must keep passing (they query `getByRole("link", { name: /detail.backToList/ })` and assert `href`):
   - `apps/web/src/components/customers/customer-detail-view.spec.tsx` ~236
   - `apps/web/src/components/knowledge-base/article-detail-view.spec.tsx` ~181
   - `apps/web/src/components/tickets/ticket-detail-view.spec.tsx` ~342
   - plus the portal ticket and article detail specs
7. Guards: `apps/web/src/test/style-guard.spec.ts` (no raw palette, no physical-direction utilities) and `token-contrast.spec.ts`.

---

## Frontend Tasks

No backend changes required.

### 1 — Avatar

**Create file: `packages/ui/src/components/avatar.tsx`** (`"use client"`, since it uses state for image failure):

```tsx
export type AvatarSize = "sm" | "md" | "lg";
export type AvatarPresence = "online" | "away" | "offline";

export interface AvatarProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  /** The person's display name: initials source and accessible name. */
  name: string;
  src?: string | null;
  size?: AvatarSize; // default "md"
  presence?: AvatarPresence;
  /** Translated presence text, e.g. "Online". Appended to the accessible name. Required for presence to be announced. */
  presenceLabel?: string;
  /** When the name is already visible beside the avatar: aria-hidden, no role. */
  decorative?: boolean;
}

export function getInitials(name: string): string { /* exported for tests */ }
```

Rules:
- **`getInitials`:** trim the name and split it on whitespace, ignoring empty parts. Take the first **grapheme** of the first part and of the last part when there are two or more parts; otherwise only the first part's first grapheme. Use `Intl.Segmenter` with `{ granularity: "grapheme" }` when available, falling back to `Array.from(part)[0]`. Uppercase with `toLocaleUpperCase()`, a no-op for Arabic. An empty name yields `""`.
- **Sizes:** `sm` = `h-6 w-6 text-caption`, `md` = `h-8 w-8 text-caption`, `lg` = `h-10 w-10 text-body`. Root: `relative inline-flex shrink-0 items-center justify-center rounded-pill bg-accent-surface font-medium text-accent-hover select-none`.
- **Image:** when `src` is set and has not errored, render `<img src alt="" className="h-full w-full rounded-pill object-cover" onError={…}>`; `onError` switches to initials. The image's `alt=""` is correct because the root carries the name.
- **Presence dot:** `absolute bottom-0 end-0 h-2.5 w-2.5 rounded-pill ring-2 ring-surface`, coloured `bg-success-solid` (online), `bg-warning-solid` (away) or `bg-rule-strong` (offline). The dot itself is `aria-hidden`.
- **Accessibility:**
  - Not decorative: the root gets `role="img"` and `aria-label` = `presence && presenceLabel ? `${name}, ${presenceLabel}` : name`.
  - Decorative: the root gets `aria-hidden="true"` and no role or label.

### 2 — Separator

**Create file: `packages/ui/src/components/separator.tsx`**:

```tsx
export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical"; // default "horizontal"
  decorative?: boolean;                     // default true
}
```

- Classes: horizontal `h-px w-full bg-rule`; vertical `w-px self-stretch bg-rule`; both `shrink-0`.
- Decorative: `role="none"`. Otherwise: `role="separator"` plus `aria-orientation={orientation}`.

### 3 — Kbd

**Create file: `packages/ui/src/components/kbd.tsx`**: render `<kbd>` with:

```
inline-flex min-w-5 items-center justify-center rounded-inner border border-rule-strong bg-surface-muted px-1.5 font-sans text-caption font-medium text-ink-muted
```

`className` merges via `cn`. No other behaviour.

### 4 — DescriptionList

**Create file: `packages/ui/src/components/description-list.tsx`**:

```tsx
export interface DescriptionListProps extends React.HTMLAttributes<HTMLDListElement> {
  columns?: 1 | 2; // default 1
}
export function DescriptionList(...) // <dl class="grid grid-cols-1 gap-x-section gap-y-stack" + (columns === 2 ? " sm:grid-cols-2" : "")>
export interface DescriptionItemProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  term: React.ReactNode;
  children: React.ReactNode; // the description
}
export function DescriptionItem(...) // <div class="flex min-w-0 flex-col gap-tight"><dt class="text-caption text-ink-subtle">{term}</dt><dd class="min-w-0 break-words text-body text-ink">{children}</dd></div>
```

A `<div>` wrapping a `<dt>`/`<dd>` pair is valid HTML inside `<dl>`.

### 5 — BackLink

**Create file: `packages/ui/src/components/back-link.tsx`** (no `"use client"` needed; there are no handlers):

```tsx
import { Slot, Slottable } from "@radix-ui/react-slot";

export interface BackLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Render the caller's element (e.g. next/link's <Link>) instead of <a>; the chevron is placed inside it. */
  asChild?: boolean;
}

export const BackLink = React.forwardRef<HTMLAnchorElement, BackLinkProps>(
  ({ asChild = false, className, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "a";
    return (
      <Comp
        ref={ref}
        className={cn(
          "focus-ring inline-flex items-center gap-1 self-start rounded-inner text-sm font-medium text-ink-muted transition-colors duration-fast hover:text-ink hover:underline",
          className,
        )}
        {...props}
      >
        <ChevronLeftIcon className="h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden="true" />
        <Slottable>{children}</Slottable>
      </Comp>
    );
  },
);
BackLink.displayName = "BackLink";
```

Usage in the apps: `<BackLink asChild><Link href={…}>{t("detail.backToList")}</Link></BackLink>`.

### 6 — Exports

**File: `packages/ui/src/index.ts`**: export `Avatar`, `getInitials`, `AvatarProps`, `AvatarSize`, `AvatarPresence`; `Separator`, `SeparatorProps`; `Kbd`; `DescriptionList`, `DescriptionItem` and their props; `BackLink`, `BackLinkProps`.

### 7 — Adopt BackLink at the five sites

Each `Link` + arrow span becomes:

```tsx
<BackLink asChild>
  <Link href={`/${locale}/tickets`}>{t("detail.backToList")}</Link>
</BackLink>
```

- Keep each site's own href:
  - web ticket → `/${locale}/tickets`
  - web customer → `/${locale}/customers`
  - web article → `/${locale}/knowledge-base`
  - portal ticket → `/${locale}/tickets`
  - portal article → `/${locale}/knowledge-base`
- Replace the old "Batch 3 (UX audit)" and inline arrow comments with one short line: `{/* Story 189 — the shared BackLink: chevron flips in RTL, token focus ring. */}`.
- Add `BackLink` to each file's existing `@crm/ui` import (portal files import from `@crm/ui` too). **Do not** touch anything else in these files.

---

## Edge Cases & Failure Modes

- **`asChild` with `next/link`.** `Slot` merges className and ref onto `Link`'s `<a>`; `Slottable` places the chevron and the link's own children inside it. If `Slottable` is missing or misused, the chevron would render outside the anchor or the label would be dropped. The web specs' `getByRole("link", { name: /detail.backToList/ })` would then fail, which guards this.
- **Accessible name.** The chevron is `aria-hidden`, so the link's name stays exactly the label (the specs match a name regex).
- **RTL.** `ChevronLeftIcon` with `rtl:rotate-180` points to the reading start, which is "back", in both directions. `gap-1` and `inline-flex` order mirror automatically.
- **Avatar with an empty or whitespace name.** `getInitials` returns `""` and the root still renders, with an empty `aria-label`. Callers always pass a name; document this in the prop comment.
- **Avatar image failure.** `onError` sets state so initials render; the specs simulate it with `fireEvent.error`.
- **Presence without a label.** The dot shows, but the accessible name stays the name only. This is documented: presence must be announced via `presenceLabel` (translation-free package).
- **Arabic initials.** Arabic has no case, so `toLocaleUpperCase` leaves letters unchanged. Graphemes keep any diacritics with their base letter.
- **`Intl.Segmenter` unavailable** (old engines): the `Array.from` fallback handles astral characters correctly.
- **Dark mode.** `bg-accent-surface`/`text-accent-hover` (avatar) and `bg-surface-muted` (kbd) all have dark values. `accent-hover` on `accent-surface` is ≥ 4.5:1 in both themes (asserted by `token-contrast.spec.ts`).
- **Branding.** The avatar uses the accent family, so a Tier-2 branded branch tints avatars; that is acceptable and consistent with buttons.

---

## Test Plan

1. **Create** `packages/ui/src/components/avatar.spec.tsx`:
   - `getInitials("Ada Lovelace")` is `"AL"`, `getInitials("Ada")` is `"A"`, `getInitials("  محمد   علي ")` is `"مع"`, and `getInitials("")` is `""`;
   - it renders `role="img"` named by the name;
   - presence + label gives the name "Ada Lovelace, Online" plus a dot element;
   - `decorative` gives `aria-hidden` and no role;
   - with `src`, an `<img>` renders, and `fireEvent.error` switches to the initials;
   - the sizes apply `h-6`/`h-8`/`h-10`.
2. **Create** `packages/ui/src/components/separator.spec.tsx`: the default is `role="none"` with `bg-rule`; `decorative={false}` gives `role="separator"` + `aria-orientation`; vertical uses `w-px`.
3. **Create** `packages/ui/src/components/kbd.spec.tsx`: renders a `KBD` element with the text, `rounded-inner` and `text-caption`.
4. **Create** `packages/ui/src/components/description-list.spec.tsx`: renders `dl` > `dt`/`dd` with the term and the value; `columns={2}` adds `sm:grid-cols-2`.
5. **Create** `packages/ui/src/components/back-link.spec.tsx`:
   - a plain `href` renders an `<a>` with `focus-ring`, and its chevron svg is `aria-hidden` with `rtl:rotate-180`;
   - `asChild` with a custom anchor component renders that component's element, with the chevron inside it and the accessible name equal to the label.
6. **Unchanged, must pass:** the web customer, article and ticket detail specs (role, name and href of the back link), the portal ticket and article detail specs, the style guard, and every other suite.

---

## Verification Steps

1. **Unit (sequential):** `pnpm --filter @crm/ui test`, then `pnpm --filter @crm/web test`, then `pnpm --filter @crm/portal test`.
2. **Static:** typecheck and lint for `@crm/ui`, `@crm/web` and `@crm/portal`.
3. **Builds:** stop any server using `apps/*/.next`; run `pnpm --filter @crm/web build`, then `pnpm --filter @crm/portal build`.
4. **Frontend runs:** with the API and production servers, open a web ticket detail and a portal ticket detail at 320 / 1280 × en / ar × light / dark. Confirm:
   - the chevron points toward the reading start;
   - Tab reaches the back link with a visible focus ring, now on the portal too;
   - activating it navigates to the list;
   - there is no new horizontal overflow.
5. **Regression:** run `git diff --check`, review the complete diff, and confirm that only the files named here plus the specs, intake, plan, overview and index changed. `qa-review.md` and `stash@{0}` must be untouched.

---

## Done Criteria

- [ ] Avatar, Separator, Kbd, DescriptionList and BackLink exist, are exported, are token-only and translation-/router-free, and each has a spec.
- [ ] Avatar initials are grapheme-safe (including Arabic), image failure falls back to initials, presence is in the accessible name and the dot, and decorative avatars are hidden.
- [ ] Separator is decorative by default, with a semantic role when needed.
- [ ] BackLink: aria-hidden chevron with `rtl:rotate-180`, `focus-ring`, `asChild` places the chevron inside the caller's link.
- [ ] All five back links use BackLink with unchanged hrefs and labels; the portal links gain a focus ring; the existing specs pass.
- [ ] ui, web and portal tests, typecheck and lint pass; both builds pass; visual checks pass in en/ar, light/dark, 320/1280.
- [ ] No backend, API, database, auth or routing change; no new dependency.
