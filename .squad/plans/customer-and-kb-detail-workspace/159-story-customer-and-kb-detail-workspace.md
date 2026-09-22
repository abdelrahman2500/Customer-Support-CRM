# Story 159 — Propagate the detail-page workspace pattern to Customer Detail and KB Article Detail

---

## Prerequisites

- **Story 154 completed** — `SectionCard` and `CardTitle`'s `as` prop. Customer detail already uses `SectionCard` ×5.
- **Story 156 completed** — the pattern this story propagates: visible `h1`, explicit edit mode, two-column workspace.
- **Story 151 completed** — `FormField`'s ARIA wiring; untouched here.

---

## Story Goal

Customer detail and KB article detail should read as records, not forms. Today both render an `sr-only` h1 with the identity as a permanently-open `Input`.

**Not in scope:** any backend/API/RBAC/domain change, the KB domain itself, navigation, portal, or the remaining `SectionCard`/`QueryStateCard` candidates.

---

## Context — Read These Files First

1. `apps/web/src/components/tickets/ticket-detail-view.tsx` — the reference. The `editingSubject` state, the `editing ? <Input/> : <h1/> + Edit button` block, the Escape/Enter handling, and the `grid ... lg:grid-cols-3` wrapper with `lg:col-span-2`.
2. `apps/web/src/components/customers/customer-detail-view.tsx` — identity at **~518–566** (`sr-only` h1 at 526, `displayName` `Input`, status `Select`, New Ticket `Button`); sections at **577** contacts, **591** tickets, **656** notes, **686** attachments, **699** anonymize.
3. `apps/web/src/components/knowledge-base/article-detail-view.tsx` — identity at **~132–177** (`sr-only` h1 at 139, `title` `Input`, status `Badge`, publish `Button`, `ConfirmDialog`); `Tabs` at **195**; `ArticleVersionHistory`'s raw `<section className="flex flex-col gap-2 border-t border-rule pt-4">` + `h2` at **~283–284**.
4. `apps/web/src/components/customers/customer-detail-view.spec.tsx` — **61 tests**. Line **215** asserts `heading level 1 name "Acme Inc."` — it passes today against the `sr-only` h1 and must keep passing against the visible one. Lines **406/423/430/438** drive the displayName input by `getByDisplayValue`.
5. `apps/web/src/components/knowledge-base/article-detail-view.spec.tsx` — **32 tests**.

---

## Design decisions

### 1 — The identity pattern is shared; copy the behaviour, not the code

Both pages get the same three-part change Story 156 made: an `editing<Field>` boolean, a visible `h1` + Edit `Button` in the default state, and the existing `Input` (with its unchanged `onBlur` mutation) in the edit state, plus Escape-to-abandon and Enter-to-commit. The `h1` renders in **both** states so the outline never depends on the mode.

No shared component is extracted. The two pages differ in what sits beside the identity (a status `Select` + New Ticket link vs a status `Badge` + publish `Button` + `ConfirmDialog`), and the edit-mode toggling is four lines. A premature `EditableTitle` abstraction would have to absorb both action groups to be useful.

### 2 — Customer detail gets two columns; KB does not

Customer detail has five stacked sections, and they divide cleanly: **main** = tickets + notes (what an agent reads and writes about this customer), **side** = contacts + attachments + anonymize (reference and one destructive admin action).

KB article detail is a **content editor**. Its body `Textarea` is the work surface and already sits inside Story 137's locale `Tabs`. Narrowing it to gain a sidebar with nothing to put in it would make the page worse. It gets the identity fix and one `SectionCard`, and its layout is otherwise untouched.

### 3 — Identity rows must wrap

Both identity rows are `flex items-center justify-between` with no wrap. A long customer name or Arabic article title plus an action group overflows at 360–390px. Both become `flex-wrap` with `gap`, and the action group gets `shrink-0`.

---

## Frontend Tasks

No backend changes required.

### 1 — Customer detail identity

**File: `apps/web/src/components/customers/customer-detail-view.tsx`**

Add `const [editingName, setEditingName] = useState(false);`. Replace the `sr-only` h1 + bare `Input` with the two-mode block. Keep the status `Select` and New Ticket `Button` exactly as they are; make the outer row wrap.

### 2 — Customer detail two-column workspace

Wrap the five sections in `grid grid-cols-1 items-start gap-6 lg:grid-cols-3`; main column `flex min-w-0 flex-col gap-6 lg:col-span-2` holds tickets + notes; side column `flex min-w-0 flex-col gap-6` holds contacts + attachments + anonymize. Back link, identity row and the mutation `Alert` stay above the grid, full width.

### 3 — KB article detail identity

**File: `apps/web/src/components/knowledge-base/article-detail-view.tsx`**

Same two-mode block for `title`. Keep the status `Badge`, publish `Button` and `ConfirmDialog` together in a `shrink-0` group; make the row wrap.

### 4 — KB version history → `SectionCard`

Replace `ArticleVersionHistory`'s raw `<section ... border-t border-rule pt-4>` + `h2` with `<SectionCard title={t("detail.versions.title")}>`. This drops the top border in favour of the card surface, which is the point: it becomes a peer of the other sections instead of a hairline-separated afterthought.

---

## Edge Cases & Failure Modes

- **Long identity + action group at 360px.** Without `flex-wrap` the row overflows. Fixed by decision 3; verify in both LTR and RTL, and with a long Arabic title.
- **`getByDisplayValue` specs break.** The input is no longer rendered by default; every such spec must click Edit first. Update them — do **not** weaken to `queryBy`.
- **Heading-level assertion at `customer-detail-view.spec.tsx:215`.** Must keep passing; it is the guard that the h1 survived the change.
- **Escape with an uncommitted draft.** Draft resets to the server value so reopening never shows abandoned keystrokes.
- **Blur inside edit mode also exits it.** A revert-on-error is therefore observed by reopening, not by reading the still-open input (Story 156 hit exactly this).
- **KB body editor width.** The `Textarea` must stay full width — the reason KB gets no column split.

---

## Test Plan

**`customer-detail-view.spec.tsx`**
1. Default state shows a **visible** `h1` with the customer name plus an Edit button; no name input.
2. Clicking Edit reveals the input; blur commits with the same payload and `onError` callback as today.
3. Escape abandons; reopening shows the server value.
4. Update the four `getByDisplayValue("Acme Inc.")` sites to enter edit mode first.
5. Existing level-1 heading assertion still passes, unchanged.
6. Every section still renders after the column split (contacts, tickets, notes, attachments, anonymize).

**`article-detail-view.spec.tsx`**
7. Default state shows a visible `h1` with the article title plus an Edit button.
8. Edit → blur still commits the title.
9. Version history renders as a `SectionCard` with an `h2`.
10. Locale tabs, publish/unpublish and the confirm dialog behave exactly as before.

---

## Verification Steps

1. **Focused:** from `apps/web`, `npx vitest run src/components/customers/customer-detail-view.spec.tsx src/components/knowledge-base/article-detail-view.spec.tsx`.
2. **Apps:** `pnpm --filter @crm/web test` (baseline **1201**), `pnpm --filter @crm/ui test` (**252**).
3. **Guards:** `design-tokens.spec.ts` (both apps) and `table-mobile-labels.spec.ts` must stay green.
4. **Quality:** `pnpm typecheck`, `pnpm lint` (0 problems), `pnpm build`.
5. **Diff:** only the two views, their specs, and this plan. **No portal file, no backend file.**

---

## Done Criteria

- [ ] Both pages have one visible `h1` carrying the record identity.
- [ ] Identity editable behind an explicit affordance; PATCH/blur-commit/revert unchanged; Escape abandons.
- [ ] Customer detail is two-column at `lg`, one column below, main first; all five sections present.
- [ ] KB keeps full-width editor and tabs; version history is a `SectionCard`.
- [ ] Both identity rows wrap without overflow at 360px, LTR and RTL.
- [ ] web + ui suites, typecheck, lint, build green; no backend or portal file touched.
