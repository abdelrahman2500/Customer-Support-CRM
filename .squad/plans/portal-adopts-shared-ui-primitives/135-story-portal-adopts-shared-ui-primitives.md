# Story 135 — Portal adopts the shared UI primitives (Story: 135)

---

## Prerequisites

- **Story 134 completed** (`59a416b feat: extend design token foundation beyond colour`) — see [../design-system-token-foundation/134-story-extend-the-design-token-layer-beyond-colour.md](../design-system-token-foundation/134-story-extend-the-design-token-layer-beyond-colour.md). This story deliberately does **not** adopt Story 134's spacing/radius/elevation tokens; it swaps components only.
- **`packages/ui` primitives already exist and are exported** — `Alert` (`packages/ui/src/components/alert.tsx`) and `Textarea` (`packages/ui/src/components/textarea.tsx`). **Their implementation must not be modified.**
- **Story S-1 `--danger-*` token family** already defined in `packages/config/tailwind-tokens.css` and consumed by `Alert`'s `destructive` variant.
- **`apps/web` is the reference implementation** — match how it composes `<Alert>` rather than inventing a portal style.

---

## Story Goal

Bring the portal's hand-rolled error and form UI onto the already-established shared primitives, **without changing portal behaviour, copy, navigation, authentication, realtime behaviour, or introducing new product flows**. This is a primitive-adoption story, not a redesign.

Concretely:

1. Every raw-red error box in `apps/portal/src` renders through `<Alert variant="destructive">`.
2. Every raw `<textarea>` in `apps/portal/src` renders through `<Textarea>`.
3. `apps/portal/src/design-tokens.spec.ts` gains a guard that fails if the raw-red error-box pattern is reintroduced.

**Not in scope:** any `apps/web` file, `portal-header.tsx`'s `<select>` language switcher, `lib/ticket-badges.ts`, Story 134 token adoption, `ConfirmDialog`/`QueryStateCard`/`EmptyState` introduction, toaster consolidation, dark mode, and any new dependency.

---

## Two corrections to the intake — verified at `59a416b`, not assumed

These were established by re-running the intake's own greps and then **reading** every hit. The executor must plan around them, not around the intake's numbers.

### Correction 1 — the raw `<table>` no longer exists. Scope item 3 is already done.

The intake lists "1 file with a raw `<table>`: `components/portal/notification-history-view.tsx`". **That file was already migrated** by story PORTAL-2. It imports the shared primitives at **`apps/portal/src/components/portal/notification-history-view.tsx` lines 174–183** (`Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow` from `"@crm/ui"`) and renders through them at **~lines 192–223**.

The intake's `grep -rlE '<table' apps/portal/src --include=*.tsx` matched this file **only on doc-comment prose** — lines 76 and 79 of that file read "The hand-rolled `<table>` markup is also replaced…" and "…the last remaining raw `<table>` in either frontend". `-l` hides which line matched, which is how the false positive survived into the intake.

**Therefore:** the Table work in this story is **verification-only** (Task 4). Do **not** "migrate" a table that is already migrated, and do **not** restructure that file's existing `Table` usage.

### Correction 2 — the error box is 20 occurrences across 10 files, not 10.

The intake counts *files*; the work is per *occurrence*. Verified counts:

| File | Error-box occurrences (line numbers) |
|---|---|
| `app/[locale]/(auth)/login/page.tsx` | 1 — 106 |
| `components/chat/chat-widget.tsx` | 5 — 100, 107, 147, 169, 248 |
| `components/knowledge-base/article-detail-view.tsx` | 1 — 41 |
| `components/knowledge-base/article-list-view.tsx` | 1 — 89 |
| `components/portal/notification-history-view.tsx` | 1 — 173 |
| `components/portal/notification-preferences-section.tsx` | 1 — 48 |
| `components/tickets/ticket-attachments-card.tsx` | 2 — 43, 115 |
| `components/tickets/ticket-chat-card.tsx` | 2 — 54, 168 |
| `components/tickets/ticket-detail-view.tsx` | 4 — 84, 140, 185, 265 |
| `components/tickets/ticket-list-view.tsx` | 2 — 66, 184 |
| **Total** | **20 occurrences / 10 files** |

Four of those 20 are the **retry-button variant** (`article-list-view.tsx:89`, `notification-history-view.tsx:173`, `notification-preferences-section.tsx:48`, `ticket-list-view.tsx:66`), which additionally carry a nested `<button>` styled `border-red-300 … hover:bg-red-50`. Those nested classes are part of the same box and must go too — see Task 2.

---

## Context — Read These Files First

1. `packages/ui/src/components/alert.tsx` — the whole file (~62 lines). Note the `destructive` variant resolves `border-danger-border bg-danger-subtle text-danger-foreground`, the base is `w-full rounded-md border px-4 py-3 text-sm`, and `ROLE_BY_VARIANT` gives `destructive` an implicit `role="alert"`. **Do not modify.**
2. `packages/ui/src/components/textarea.tsx` — the whole file (~40 lines). Note `TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>` (every native prop passes through), the `rows = 3` default, and that `className` is merged via `cn` so a caller can still add `max-w-md`. **Do not modify.**
3. `apps/web/src/components/admin/branding-view.tsx` — **~lines 50–56**. This is the retry-inside-an-Alert precedent to copy verbatim in shape: `<Alert variant="destructive" className="flex items-center justify-between">` wrapping a `<span>` and a `<Button variant="outline" size="sm">`.
4. `apps/web/src/app/[locale]/(auth)/login/page.tsx` — **line 112**. The plain-error precedent: `{error && <Alert variant="destructive">{error}</Alert>}`.
5. `apps/portal/src/app/[locale]/(auth)/login/page.tsx` — **read lines 75–110**. Critical: the **session-expired banner at lines 79–83** is a *separate, neutral* block (`border-rule bg-surface-sunk text-ink-strong`, rendering `tCommon("errors.unauthorized")`, guarded by `sessionExpired && !error`). The raw-red box at **line 106** is the **submit-error** branch. See Edge Cases.
6. `apps/portal/src/components/tickets/ticket-chat-card.tsx` — **read lines 85–95 and 150–172**. Line 91 carries a bare `text-red-700` on the **delivery-status label**, which is *not* an error box and is **out of scope**.
7. `apps/portal/src/components/tickets/ticket-chat-card.spec.tsx` — **line 254**: `expect(screen.getByText("detail.chatDeliveryStatus.FAILED")).toHaveClass("text-red-700")`. This test pins the line-91 class. It must keep passing untouched.
8. `apps/portal/src/design-tokens.spec.ts` — the whole file (87 lines). Note `FORBIDDEN` (lines 39–40), the comment-line skip at lines 75–78, `collectSourceFiles` excluding `.spec.` files (line 52), and the doc comment at **lines 29–33** explaining why the status families are exempt — that exemption is exactly why the raw-red pattern survived.
9. `apps/portal/src/components/portal/notification-history-view.tsx` — **read lines 174–183 and 192–223** to confirm Correction 1 for yourself before doing anything to that file.
10. Grep for `border-red-200 bg-red-50` in `apps/portal/src/` to reproduce the before-inventory.

---

## Implementation tasks

Migrate **per file**, not per pattern — four files carry both an error box and a textarea, and migrating per file produces one coherent hunk per file.

### 1 — Plain error boxes → `<Alert variant="destructive">`

Applies to the 16 non-retry occurrences. For each, replace the wrapper element and delete the class string; **keep the children, the conditional branch, and every surrounding sibling exactly as they are**.

Before:

```tsx
{error && (
  <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
    {error}
  </p>
)}
```

After:

```tsx
{error && <Alert variant="destructive">{error}</Alert>}
```

**Positional utility classes are preserved, not dropped.** Several boxes carry layout classes that belong to the parent's flow, not to the box's look — e.g. `mt-2` (`chat-widget.tsx:100,107,147`; `ticket-attachments-card.tsx:43`; `ticket-chat-card.tsx:54`; `ticket-detail-view.tsx:140,185`) and `mt-3`. Carry those onto the `Alert` via `className`:

```tsx
<Alert variant="destructive" className="mt-2">
  {t("startFailed")}
</Alert>
```

Per-file notes:

- **File: `apps/portal/src/app/[locale]/(auth)/login/page.tsx`** — line 106 only. Add `Alert` to the existing `import { Button, Input } from "@crm/ui";` at line 6. **Do not touch lines 79–83.**
- **File: `apps/portal/src/components/chat/chat-widget.tsx`** — lines 100, 107, 147, 169, 248 (five boxes: start-failure, load-error, AI `outcome === "ERROR"`, escalate-error, composer send-error). Extend the import at line 16. Note the `outcome === "DISABLED"` block just below line 147 is **neutral**, not red — leave it alone. Also migrate this file's textarea (Task 3) in the same pass.
- **File: `apps/portal/src/components/knowledge-base/article-detail-view.tsx`** — line 41. Extend the import at line 6.
- **File: `apps/portal/src/components/tickets/ticket-attachments-card.tsx`** — lines 43, 115. Extend the import at line 12.
- **File: `apps/portal/src/components/tickets/ticket-chat-card.tsx`** — lines 54 and 168 **only**. Extend the import at line 12. Also migrate this file's textarea (Task 3).
- **File: `apps/portal/src/components/tickets/ticket-detail-view.tsx`** — lines 84, 140, 185, 265. Extend the import at line 20. Line 84 is an early `return` inside `if (ticketQuery.isError)` — keep the `return (…)` structure and the `notFound ? … : …` ternary intact. Also migrate this file's textarea (Task 3).
- **File: `apps/portal/src/components/tickets/ticket-list-view.tsx`** — line 184 here (line 66 is Task 2).

### 2 — Retry-button error boxes → `<Alert>` + `<Button variant="outline" size="sm">`

Applies to the 4 retry occurrences. Follow `apps/web/src/components/admin/branding-view.tsx` lines 50–56 exactly.

Before (`ticket-list-view.tsx` lines 66–74, representative of all four):

```tsx
<div className="mt-3 flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
  <span>{t("list.error")}</span>
  <button
    type="button"
    onClick={() => ticketsQuery.refetch()}
    className="rounded-md border border-red-300 bg-surface px-2 py-1 text-xs font-medium hover:bg-red-50 focus-ring"
  >
    {t("list.retry")}
  </button>
</div>
```

After:

```tsx
<Alert variant="destructive" className="mt-3 flex items-center justify-between">
  <span>{t("list.error")}</span>
  <Button variant="outline" size="sm" onClick={() => ticketsQuery.refetch()}>
    {t("list.retry")}
  </Button>
</Alert>
```

`Button`'s `outline` variant is `border border-rule-strong bg-surface text-ink hover:bg-surface-sunk` and `sm` is `h-8 rounded-md px-3 text-xs` (`packages/ui/src/components/button.tsx` lines 30 and 36) — this is what removes the nested `border-red-300`/`hover:bg-red-50`. `Button` defaults to `type="button"`, so the explicit `type` may be dropped; keeping it is also fine.

Files, with their own leading-margin class to preserve:

- **File: `apps/portal/src/components/knowledge-base/article-list-view.tsx`** — line 89, `mt-3`. Extend the import at line 7 with `Alert` and `Button`.
- **File: `apps/portal/src/components/portal/notification-history-view.tsx`** — line 173, **no** leading margin. Extend the existing multi-line `@crm/ui` import (lines 174–183) with `Alert` and `Button`, keeping it alphabetically ordered as it already is.
- **File: `apps/portal/src/components/portal/notification-preferences-section.tsx`** — line 48, `mt-2`. Extend the import at line 10 (already has `Button`).
- **File: `apps/portal/src/components/tickets/ticket-list-view.tsx`** — line 66, `mt-3`. Extend the multi-line import ending at line 18.

### 3 — Raw `<textarea>` → `<Textarea>`

Three occurrences, each in a file already being touched by Task 1.

- **File: `apps/portal/src/components/chat/chat-widget.tsx`** — line 228.
- **File: `apps/portal/src/components/tickets/ticket-chat-card.tsx`** — line 152.
- **File: `apps/portal/src/components/tickets/ticket-detail-view.tsx`** — line 257 (the CSAT comment field).

All three currently carry the identical class string `w-full rounded-md border border-rule-strong bg-surface px-3 py-2 text-sm shadow-sm focus-ring`, which is **exactly** what `Textarea` renders internally. Delete it. Preserve **every** other prop verbatim: `rows`, `value`, `onChange`, `placeholder`, `aria-label`, `disabled`, `onKeyDown`.

Before (`ticket-chat-card.tsx` lines 152–161):

```tsx
<textarea
  className="w-full rounded-md border border-rule-strong bg-surface px-3 py-2 text-sm shadow-sm focus-ring"
  rows={2}
  value={body}
  placeholder={t("detail.chatPlaceholder")}
  disabled={mutation.isPending}
  aria-label={t("detail.chatPlaceholder")}
  onChange={(event) => setBody(event.target.value)}
  onKeyDown={handleKeyDown}
/>
```

After:

```tsx
<Textarea
  rows={2}
  value={body}
  placeholder={t("detail.chatPlaceholder")}
  disabled={mutation.isPending}
  aria-label={t("detail.chatPlaceholder")}
  onChange={(event) => setBody(event.target.value)}
  onKeyDown={handleKeyDown}
/>
```

**Keep `rows` explicit** even where it equals `Textarea`'s own default — `chat-widget.tsx` and `ticket-chat-card.tsx` use `rows={2}`, which differs from the default `3`, and `ticket-detail-view.tsx`'s `rows={3}` should stay written down rather than silently inherited.

**`ticket-detail-view.tsx` line 257 keeps its `max-w-md`** — that class is layout, not look. Pass it through: `<Textarea className="max-w-md" rows={3} … />`. (`w-full` is already in `Textarea`'s base.)

### 4 — Table: verify only, change nothing

**File: `apps/portal/src/components/portal/notification-history-view.tsx`** — confirm by reading lines 174–183 and 192–223 that `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell` are already in use. **Make no structural change to this file's table.** The only edit this file receives is its Task 2 error-box migration.

Record the confirmation in the completion report so a later reader knows the item was checked, not skipped.

> **Note — `TableCell label` is deliberately not added.** The intake suggests the migrated table "should use" `TableCell`'s `label` prop for RM-10 responsiveness. The existing cells (lines ~203–221) do **not** pass `label`. Adding it now would change what renders below `640px` — a **behaviour change**, which this story's own non-goals forbid. It is recorded in Edge Cases as a follow-up, not done here.

### 5 — The guard

**File: `apps/portal/src/design-tokens.spec.ts`**

Add a second, **focused** `it(...)` inside the existing `describe("S-1 design tokens (portal)")` block. Do **not** widen `FORBIDDEN` on lines 39–40 — that regex is S-1's slate/white guard, and folding a status colour into it would contradict the deliberate exemption documented at lines 29–33.

```ts
/**
 * Story 135 — the portal's hand-rolled error box.
 *
 * The status families (amber/red/emerald) stay exempt from `FORBIDDEN`
 * above for the reason the doc comment gives: a raw status colour is a
 * design question, not a mechanical rename. But *this specific* pattern
 * is not a design question — it was the portal rendering "an error" as a
 * different object from the one `apps/web` renders for the same meaning,
 * bypassing the `--danger-*` tokens that `Alert`'s `destructive` variant
 * already resolves. Story 135 migrated all 20 occurrences to `<Alert
 * variant="destructive">`; this keeps them there.
 *
 * Narrow on purpose: it matches the error-box class pair, not every use
 * of red. `ticket-chat-card.tsx`'s delivery-status `text-red-700` is a
 * legitimate inline status colour, is asserted on by that component's
 * own spec, and is deliberately not caught here.
 */
const RAW_ERROR_BOX = /border-red-200\s+bg-red-50|bg-red-50\s+border-red-200/;

it("renders errors through the shared Alert, not a hand-rolled red box", () => {
  const offenders: string[] = [];

  for (const file of files) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/*")) {
        return;
      }
      if (RAW_ERROR_BOX.test(line)) {
        offenders.push(`${file.slice(SRC.length + 1)}:${index + 1}`);
      }
    });
  }

  expect(
    offenders,
    `Use <Alert variant="destructive"> instead:\n${offenders.join("\n")}`,
  ).toEqual([]);
});
```

The same comment-line skip as the existing test is **required**, not optional — this story's own doc comments quote the class string, and Correction 1 above is proof that prose mentions of a pattern are a real false-positive source in this repo.

**Prove the guard can fail** (this is an acceptance criterion): temporarily reintroduce `className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"` on any one portal element, run `pnpm --filter @crm/portal test`, confirm the new test **fails and names that file:line**, then revert. Record both outputs in the completion report.

---

## Edge Cases & Failure Modes

- **`<p>` → `<div>` element change.** `Alert` renders a `<div>` (`packages/ui/src/components/alert.tsx` line 50). Twelve of the sixteen plain boxes are currently `<p>`. **Risk: a `<p>` cannot legally contain a `<div>`.** Check each call site's *parent* before editing: all sixteen sit directly inside a `<form>`, `<div>`, or `<section>`, so no invalid nesting is introduced. If a new one is found nested in a `<p>`, stop and report rather than restructuring the parent.
- **New implicit `role="alert"`.** `ROLE_BY_VARIANT` gives `destructive` an assertive live region (`alert.tsx` lines 44–48); the raw `<p>`/`<div>` boxes had no role. This is an a11y improvement and is the same behaviour `apps/web` has had for 35 files. It can, however, make `getByRole("alert")` newly match — no portal spec uses that query today, so nothing breaks, but do not add such a query in this story.
- **Padding shifts `px-3 py-2` → `px-4 py-3`.** `Alert`'s base is `px-4 py-3`; the raw boxes are `px-3 py-2`. This is a deliberate, accepted ~4px visual difference — it is the point of adopting the shared primitive. **Do not** override it back with `className="px-3 py-2"`; that would re-fork the very thing being unified.
- **Login page, session expiry.** `apps/portal/src/app/[locale]/(auth)/login/page.tsx` lines 79–83 render the session-expired banner in **neutral** colours, not the raw-red box, and are guarded by `sessionExpired && !error`. The intake's Critical Risk 1 asked which branch uses the red box: it is the **submit-error** branch at line 106, and only that one is migrated. The e2e assertion at `apps/e2e/tests/session-expiry-and-refresh.spec.ts` line 185 matches on **text**, so it is unaffected either way — but migrating lines 79–83 would change that banner's colour and is forbidden here.
- **Realtime chat.** `ticket-chat-card.tsx`'s `<ol aria-label="Live Chat">` and its sender-label rendering are **not** touched by any task in this story. The only edits are lines 54, 152 and 168. Do not alter realtime merge/state behaviour.
- **`chat-widget.tsx` line 147 renders a server-supplied string** (`resultQuery.data.errorMessage ?? t("replyFailed")`). Keep the `??` fallback exactly; do not add escaping, truncation, or a title.
- **`ticket-detail-view.tsx` line 84 is an early return.** Migrating it changes the returned element's tag. Preserve the `notFound` ternary character-for-character.
- **Retry `<button>` → `<Button>`** changes the node's classes but not its accessible name; `Button` renders a real `<button>`, so both `getByText` and `querySelector("button")` still match.
- **RTL.** `Alert` and `Button`'s `outline` use only physical-neutral utilities (`px-*`, `py-*`, `border`). The four retry boxes keep `flex items-center justify-between`, already direction-aware. No `ml-*`/`mr-*`/`left-*`/`right-*` is introduced anywhere — re-verify after editing.
- **Uncertainty, disclosed:** `TableCell`'s `label` prop is absent from `notification-history-view.tsx`'s existing cells. Whether that is an oversight in PORTAL-2 or a deliberate choice for a 3-column list is **not established** by anything in the repo. It is left exactly as-is and flagged as a DS-D/RM-10 follow-up rather than guessed at.

---

## Test Plan

1. **Unit — guard, new.** `apps/portal/src/design-tokens.spec.ts`: add `it("renders errors through the shared Alert, not a hand-rolled red box")` per Task 5. Match the existing test's file-walk and comment-skip structure.
2. **Unit — guard falsifiability, manual.** Reintroduce the pattern, observe the new test fail with a `file:line` message, revert. Not a committed test; record the output in the completion report.
3. **Unit — existing, must stay green untouched.** `apps/portal/src/app/[locale]/(auth)/login/page.spec.tsx` lines 42–75: all three session-expired assertions query `getByText("errors.unauthorized")` and must pass without edits, proving the neutral banner was not migrated.
4. **Unit — existing, must stay green untouched.** `apps/portal/src/components/tickets/ticket-chat-card.spec.tsx` line 254: `toHaveClass("text-red-700")` on the delivery-status label, proving the out-of-scope red was not swept up.
5. **Unit — existing, must stay green untouched.** `apps/portal/src/components/portal/notification-history-view.spec.tsx` lines 152–153: `querySelectorAll("tbody tr")` / `"tbody .animate-pulse"`, proving the table structure was not disturbed.
6. **Unit — full portal suite.** Every spec under `apps/portal/src` — `chat-widget.spec.tsx`, `article-detail-view.spec.tsx`, `article-list-view.spec.tsx`, `notification-preferences-section.spec.tsx`, `ticket-attachments-card.spec.tsx`, `ticket-detail-view.spec.tsx`, `ticket-list-view.spec.tsx`. **No spec may be edited** unless this story's own change genuinely broke it; if one breaks, fix the implementation, not the assertion (`CLAUDE.md` §4).
7. **E2E — session expiry.** `apps/e2e/tests/session-expiry-and-refresh.spec.ts` line 185 asserts `getByText("Your session has expired. Please sign in again.")`. Must stay green.
8. **E2E — live chat.** `apps/e2e/tests/agent-customer-live-chat.spec.ts` asserts `<ol aria-label="Live Chat">`, sender labels, and `getByLabel("Type a message...")`. The last of those resolves through the migrated `Textarea`'s `aria-label` — the highest-value proof that Task 3 preserved the composer contract.
9. **No new spec files.** This story adds behaviour-preserving swaps plus one guard; a new render spec asserting "an Alert is present" would test `packages/ui`'s own already-covered primitive, not this story.

---

## Verification Steps

1. **Before-inventory:** from the repo root, record the baseline —
   ```
   grep -rn 'border-red-200 bg-red-50' apps/portal/src --include=*.tsx | wc -l   # expect 20
   grep -rn '<textarea' apps/portal/src --include=*.tsx | wc -l                  # expect 3
   ```
2. **Portal tests:** `pnpm --filter @crm/portal test`
3. **Frontend regression (web must be untouched):** `pnpm --filter @crm/web test`
4. **Typecheck:** `pnpm typecheck`
5. **Lint:** `pnpm lint`
6. **Build:** `pnpm build`
7. **After-inventory:** re-run the Step 1 greps — both must report **0**. Then confirm the companion classes are gone:
   ```
   grep -rn 'border-red-300\|hover:bg-red-50' apps/portal/src --include=*.tsx     # expect 0
   ```
8. **RTL check:** `grep -rnE '\b(ml|mr|pl|pr|left|right)-' apps/portal/src --include=*.tsx` — no **new** physical-direction class relative to `59a416b`.
9. **Non-regression proof:** `git status --short` and `git diff --stat` must list **only** the 10 portal component/page files plus `apps/portal/src/design-tokens.spec.ts` (11 files). Any `apps/web/**`, `packages/ui/**`, `portal-header.tsx`, or `ticket-badges.ts` entry is a scope violation — revert it.
10. **E2E:** run `session-expiry-and-refresh.spec.ts` and `agent-customer-live-chat.spec.ts` per `.github/workflows/ci.yml`'s e2e conventions. If the environment cannot reach Postgres or the app servers, record the blocker per `CLAUDE.md` §5 rather than claiming a pass.

---

## Done Criteria

- [ ] All 20 raw-red error-box occurrences across the 10 identified files render through `<Alert variant="destructive">`, with error **text**, conditional branches, loading/error behaviour, session-expiry behaviour and existing accessibility semantics preserved.
- [ ] Positional classes (`mt-2`/`mt-3`) and the retry boxes' `flex items-center justify-between` are carried onto the `Alert`, not dropped.
- [ ] The 4 retry buttons use `<Button variant="outline" size="sm">`; `border-red-300` and `hover:bg-red-50` no longer appear in `apps/portal/src`.
- [ ] Zero occurrences of `border-red-200 bg-red-50` remain in `apps/portal/src`.
- [ ] All 3 raw `<textarea>` occurrences use `<Textarea>`, preserving controlled behaviour, `value`/`onChange`, `aria-label`, `disabled`, `rows`, `onKeyDown`, and `max-w-md` on the CSAT field.
- [ ] `notification-history-view.tsx`'s already-migrated `Table` usage is confirmed unchanged, and Correction 1 is recorded in the completion report.
- [ ] `apps/portal/src/design-tokens.spec.ts` gains the focused `RAW_ERROR_BOX` assertion, without widening the existing `FORBIDDEN` regex.
- [ ] That assertion was **proven to fail** when the pattern was reintroduced, then reverted — with both outputs recorded.
- [ ] No `apps/web` file changed. No `packages/ui` file changed.
- [ ] `apps/portal/src/components/portal/portal-header.tsx` is not modified and its raw `<select>` is untouched.
- [ ] `apps/portal/src/lib/ticket-badges.ts` is not modified.
- [ ] `ticket-chat-card.tsx`'s delivery-status `text-red-700` label is untouched and its spec assertion still passes.
- [ ] No error copy changed. No new dependency added.
- [ ] Before/after inventory recorded (20→0 error boxes, 3→0 textareas, exactly 11 files in the diff).
- [ ] Portal typecheck / lint / build green; portal test suite green; web test suite green.
- [ ] Session-expiry E2E and live-chat E2E green (or a documented environmental blocker per `CLAUDE.md` §5).
- [ ] Portal token guard green; RTL physical-direction check clean.
