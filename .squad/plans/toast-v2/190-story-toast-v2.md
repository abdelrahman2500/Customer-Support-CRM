# Story 190 — Toast v2

> CRM UI/UX redesign roadmap item **RD-1.13**. Intake: [`../../stories/toast-v2/toast-v2/intake.md`](../../stories/toast-v2/toast-v2/intake.md). Roadmap: [`../crm-ui-ux-redesign/00-overview.md`](../crm-ui-ux-redesign/00-overview.md) §4.2 (Toast row), §6 "RD-1.13"; recon RS-01, A11Y-10.

---

## Prerequisites

- **Story 185 completed** (`7efabea`, RD-1.8): semantic tone set and icons (`SuccessIcon`, `InfoIcon`, `WarningIcon`, `ErrorIcon` in `packages/ui/src/lib/icons.ts`).
- **Story 187 completed** (`6fe4791`, RD-1.10): `surface-raised`, `shadow-overlay`, `rounded-surface`, and the `animate-fade-in` keyframe. Precedent for shared class strings: [`../surfaces-and-overlays/187-story-surfaces-and-overlays.md`](../surfaces-and-overlays/187-story-surfaces-and-overlays.md) (`lib/overlay.ts`, `lib/menu.ts`).
- Shared contract: `@crm/ui` stays translation-free. Labels are props; notification content is the apps'.

---

## Story Goal

One toast treatment across the product:

1. **A 320px-safe position.** Today `fixed … end-4 w-full max-w-sm` puts a 100vw-wide box 1rem in from the end edge, so it overflows the start edge by 1rem (RS-01).
2. **Tones** success, info, warning and error, each with a semantic border and an icon.
3. **A live region that exists before the first toast**, so the first message is announced (A11Y-10).

This applies to the shared `SuccessToaster` and to both apps' `NotificationToaster`s. `showSuccessToast` and the `SuccessToaster` export keep working for the existing callers (about a dozen screens across web and portal).

**Not in scope:** notification wording (the portal's raw status text is RD-1.16), new notification types, persistence or sound, any new dependency, and any backend, API, database, auth or routing change.

---

## Context — Read These Files First

1. `packages/ui/src/lib/toast-store.ts`:
   - `SuccessToast { id; message }`
   - `ToastState.add(message)` / `dismiss(id)`
   - `AUTO_DISMISS_MS = 5_000`, `MAX_VISIBLE = 3`
   - `showSuccessToast(message)`
2. `packages/ui/src/components/success-toaster.tsx`:
   - `SuccessToaster({ regionLabel, dismissLabel })` returns **null** when there are no toasts.
   - It renders `role="region"` and a fixed stack, `pointer-events-none fixed bottom-4 end-4 z-50 flex w-full max-w-sm flex-col gap-2`.
   - Each item is a `role="status" aria-live="polite"` card with `rounded-md border border-success-border bg-success-subtle … shadow-md`, plus a dismiss button with `CloseIcon` and `focus-ring`.
3. `packages/ui/src/index.ts`:
   - ~line 110: `export { useToastStore, showSuccessToast } from "./lib/toast-store";`
   - ~111: `export type { SuccessToast } …`
   - ~210: `export { SuccessToaster } …`
4. `apps/web/src/components/notifications/notification-toaster.tsx`:
   - `if (notifications.length === 0) return null` (~line 86)
   - region div (~92–94: `pointer-events-none fixed top-4 end-4 z-50 flex w-full max-w-sm flex-col gap-2`)
   - per-item `role="status" aria-live="polite"` (~101)
   - card classes via `cn(… "rounded-md border bg-surface p-3 shadow-md", breached ? "border-danger-border" : "border-rule")` (~104)
   - the Badge, dismiss button and "View ticket" `Button`
5. `apps/portal/src/components/portal/notification-toaster.tsx`:
   - the same structure: `return null` (~54), region (~60–62), item `role="status"` (~69), card `rounded-md border border-rule bg-surface p-3 shadow-md` (~71)
   - title span, dismiss button and "View ticket" button
6. Specs:
   - `packages/ui/src/components/success-toaster.spec.tsx`. Line ~20 "renders nothing when there are no toasts" (`toBeEmptyDOMElement`), ~36 `getByRole("status")` with `aria-live="polite"`, ~85 `getAllByRole("status")` length 3 (the cap). The others (~45 labelled region, ~52 dismiss, ~61 auto-dismiss, ~91 focus ring) must still hold.
   - `apps/web/src/components/notifications/notification-toaster.spec.tsx` ~28–35 and `apps/portal/src/components/portal/notification-toaster.spec.tsx` ~28–35, both "renders nothing when there are no notifications". All other tests in both files (messages, dismiss, View ticket) must stay green unchanged.
7. Guards: `apps/web/src/test/style-guard.spec.ts`, `apps/web/src/test/token-contrast.spec.ts`.

---

## Frontend Tasks

No backend changes required.

### 1 — Shared toast classes

**Create file: `packages/ui/src/lib/toast.ts`**:

```ts
/**
 * Story 190 (RD-1.13) — the one toast treatment (SuccessToaster and both
 * apps' NotificationToasters). The region is 320px-safe: `inset-x-4` gives a
 * 1rem gutter on both edges on phones; from `sm` it is a 24rem column at
 * the reading-end edge. Pass the vertical edge separately.
 */
export const toastRegionClassName =
  "pointer-events-none fixed inset-x-4 z-50 sm:inset-x-auto sm:end-4 sm:w-96";

/** The always-mounted live list inside the region. */
export const toastListClassName = "flex flex-col gap-2";

export const toastCardClassName =
  "pointer-events-auto flex rounded-surface border bg-surface-raised p-3 text-sm text-ink shadow-overlay animate-fade-in";

export type ToastTone = "success" | "info" | "warning" | "error";

export const toastToneClassName: Record<ToastTone, string> = {
  success: "border-success-border",
  info: "border-info-border",
  warning: "border-warning-border",
  error: "border-danger-border",
};
```

### 2 — Store: optional tone, additive helper

**File: `packages/ui/src/lib/toast-store.ts`**:
- `SuccessToast` gains `tone: ToastTone`. Keep the type name for compatibility, and add `export type Toast = SuccessToast`.
- `add(message: string, tone: ToastTone = "success")`.
- `showSuccessToast(message)` stays as-is and calls `add(message, "success")`.
- Add `showToast(message: string, options?: { tone?: ToastTone })`.
- **Do not** change `AUTO_DISMISS_MS`, `MAX_VISIBLE` or the ordering.

### 3 — SuccessToaster (the shared toaster)

**File: `packages/ui/src/components/success-toaster.tsx`** (keep the name and props):
- **Always** render `<div role="region" aria-label={regionLabel} className={cn(toastRegionClassName, "bottom-4")}>` containing `<ol aria-live="polite" className={toastListClassName}>`, even when empty. The empty list announces nothing.
- Each toast is an `<li>` with `className={cn(toastCardClassName, toastToneClassName[toast.tone], "items-start gap-2")}`. Error toasts carry `role="alert"`, which is announced assertively when inserted.
- Inside each toast:
  - a leading tone icon (`SuccessIcon` / `InfoIcon` / `WarningIcon` / `ErrorIcon`), `h-4 w-4 shrink-0 mt-0.5`, `aria-hidden`, coloured `text-{family}-foreground` (danger for error);
  - `<p className="min-w-0 flex-1 break-words">{toast.message}</p>`;
  - the dismiss button, unchanged except `className="focus-ring rounded-inner text-ink-subtle hover:text-ink"`.
- Update the doc comment (Story 190): the always-mounted region (A11Y-10), the 320px-safe position (RS-01), tones, and no nested status roles.

### 4 — Exports

**File: `packages/ui/src/index.ts`:**
- Extend the store export to `{ useToastStore, showSuccessToast, showToast }`, and the type export to `{ SuccessToast, Toast }`.
- Add `export { toastRegionClassName, toastListClassName, toastCardClassName, toastToneClassName } from "./lib/toast";` and `export type { ToastTone } from "./lib/toast";`.

### 5 — Web NotificationToaster

**File: `apps/web/src/components/notifications/notification-toaster.tsx`:**
- Remove the `if (notifications.length === 0) return null;` early return.
- The region becomes `<div role="region" aria-label={t("regionLabel")} className={cn(toastRegionClassName, "top-4")}>`, wrapping `<ol aria-live="polite" className={toastListClassName}>`.
- Each notification becomes an `<li>` (no `role="status"`/`aria-live` of its own) with `className={cn(toastCardClassName, "flex-col gap-2", notification.eventType === "sla.breached" ? toastToneClassName.error : toastToneClassName.warning)}`.

   The previous neutral `border-rule` for at-risk/escalated is replaced by the warning tone, which matches the warning Badge already shown in each card.

- The dismiss button class becomes `focus-ring rounded-inner text-ink-subtle hover:text-ink`.
- Badge, message, "View ticket" button, handlers and translations are **unchanged**.
- Import `toastRegionClassName`, `toastListClassName`, `toastCardClassName`, `toastToneClassName` from `@crm/ui`.

### 6 — Portal NotificationToaster

**File: `apps/portal/src/components/portal/notification-toaster.tsx`:** the same structural change as task 5:
- no early return;
- region `cn(toastRegionClassName, "top-4")`, plus the `<ol aria-live="polite">`;
- `<li>` cards with `cn(toastCardClassName, "flex-col gap-2", toastToneClassName.info)`. Portal notifications are informational: ticket updates and new replies.
- the dismiss button class as in task 5.

Title span, message, "View ticket" button, handlers and translations are **unchanged**. Import `cn` from `@crm/ui`, which this file does not yet import.

---

## Edge Cases & Failure Modes

- **First toast after page load.** The `<ol aria-live="polite">` is in the DOM from the first render, so adding the first `<li>` is an announced change. This is the A11Y-10 fix in `success-toaster.tsx` and both notification toasters. It is covered by specs that assert the region and list exist while empty.
- **Error toasts.** `role="alert"` on the `<li>` (implicitly assertive) inside a polite list. Screen readers announce the alert once on insertion. There are no other nested live roles, so nothing is announced twice.
- **The empty region is a landmark.** An empty `role="region"` with a label is a valid, quiet landmark. It is `pointer-events-none`, so it never blocks clicks. Items re-enable pointer events (`pointer-events-auto` in `toastCardClassName`).
- **320px.** `inset-x-4` spans the viewport minus 1rem on each side, so it can't overflow. From `sm`, `sm:inset-x-auto sm:end-4 sm:w-96` reproduces today's 24rem column at the reading-end edge, and `end-4` mirrors in RTL.
- **Long messages.** `min-w-0 flex-1 break-words` on the text keeps long unbroken strings (ticket ids, URLs) from widening the card.
- **Reduced motion.** `animate-fade-in` is neutralised by the global reduced-motion rule (Story 179).
- **Dark mode.** `bg-surface-raised`, `text-ink`, the semantic borders and the foreground icon colours all have dark values (guarded by `token-contrast.spec.ts`).
- **Callers that read `SuccessToast` objects.** `tone` is a new required field produced only by the store; external code only reads `id`/`message`. Grep showed no app code constructing `SuccessToast` objects (`useToastStore` is not used in `apps/`).
- **Two toasters at once.** The success stack is at the bottom, notifications at the top, as today. They never overlap.

---

## Test Plan

1. **Modify** `packages/ui/src/components/success-toaster.spec.tsx`:
   - ~20, "renders nothing when there are no toasts", becomes "renders an empty, labelled live region before any toast". It asserts `getByRole("region", { name: "Success notifications" })` exists and contains a `list` with `aria-live="polite"` and no `listitem`.
   - ~36 becomes "renders the message inside the polite live list": the message's `listitem` sits inside the `aria-live="polite"` list.
   - ~85 (the cap): `getAllByRole("listitem")` has length 3.
   - All other tests stay unchanged.
2. **Extend** `packages/ui/src/components/success-toaster.spec.tsx`:
   - `showToast("x", { tone: "error" })` renders an `alert` with `border-danger-border` and an `aria-hidden` icon;
   - `tone: "info"` gives `border-info-border`;
   - the region has `inset-x-4` and `sm:w-96` and not `w-full`;
   - the card has `rounded-surface`, `bg-surface-raised` and `shadow-overlay`.
3. **Create** `packages/ui/src/lib/toast.spec.ts`: the region class contains `inset-x-4`, `sm:inset-x-auto`, `sm:end-4` and `sm:w-96`; `toastToneClassName` maps the four tones to the four semantic borders.
4. **Modify** `apps/web/src/components/notifications/notification-toaster.spec.tsx` and `apps/portal/src/components/portal/notification-toaster.spec.tsx` (~28–35). "renders nothing when there are no notifications" becomes "renders an empty, labelled live region when there are no notifications": the region is present by its translated name, and the list has no items. All other tests are unchanged.
5. **Unchanged, must pass:** every other web and portal suite (the `showSuccessToast` callers), the style guard and the token guards.

---

## Verification Steps

1. **Unit (sequential):** `pnpm --filter @crm/ui test`, then `pnpm --filter @crm/web test`, then `pnpm --filter @crm/portal test`.
2. **Static:** typecheck and lint for `@crm/ui`, `@crm/web` and `@crm/portal`.
3. **Builds:** stop any server using `apps/*/.next`; run `pnpm --filter @crm/web build`, then `pnpm --filter @crm/portal build`.
4. **Frontend runs:** with the API and production servers running, trigger a real success toast by saving the web branding form unchanged (an idempotent write: same values). The portal has no write-free trigger, so insert a card with the shared classes into its always-mounted notification list to measure the compiled CSS. Check it at 320 and 1280 × en/ar × light/dark. Confirm:
   - the toast is fully inside the viewport (no overflow);
   - it sits at the reading-end edge from `sm`;
   - the region exists before the toast (DOM check).
5. **Regression:** run `git diff --check`, review the complete diff, and confirm only the files named here plus the specs, intake, plan, overview and index changed. `qa-review.md` and `stash@{0}` must be untouched.

---

## Done Criteria

- [ ] Shared `lib/toast.ts` classes; the region is 320px-safe (`inset-x-4` → `sm:end-4 sm:w-96`); cards use the raised surface, surface radius, overlay shadow and fade.
- [ ] Tones success/info/warning/error with semantic border and icon; error uses `role="alert"`; `showToast` added; `showSuccessToast` and `SuccessToaster` unchanged for callers.
- [ ] The labelled region and polite live list are always mounted in SuccessToaster and both NotificationToasters; the first toast is announced.
- [ ] Notification content, actions and translations are unchanged; the web at-risk/escalated cards use the warning border; portal cards use info.
- [ ] Specs updated for the intentional empty-region change and extended for tones and position; every other suite passes.
- [ ] ui, web and portal tests, typecheck and lint pass; both builds pass; there is no overflow at 320px with a toast visible.
- [ ] No backend, API, database, auth or routing change; no new dependency.
