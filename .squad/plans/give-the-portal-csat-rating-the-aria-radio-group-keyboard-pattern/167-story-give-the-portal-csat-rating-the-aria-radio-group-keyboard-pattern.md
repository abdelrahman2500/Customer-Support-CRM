# Story 167 — Give the portal CSAT rating the ARIA radio-group keyboard pattern

---

## Prerequisites

- **Story 166** completed (`4c6ccc2`) — the preceding focus/indicator story. No code dependency; this story starts from its HEAD.
- **Story 129** — the repository's recorded decision to use native `<input type="radio">` rather than add a `RadioGroup` primitive, written into [`apps/web/src/components/admin/branding-view.tsx`](../../../apps/web/src/components/admin/branding-view.tsx) ~lines 199–203. This story applies that decision a second time.
- **Story 53 / Story 55** — the portal ticket detail and the CSAT form itself. No contract changes hands here; `CsatForm` is private to one file.
- No coordination needed with any other owner: nothing outside `apps/portal` is touched.

---

## Story Goal

Replace the five hand-built `role="radio"` `<button>`s in the portal's CSAT rating with native `<input type="radio">`, so the browser supplies the ARIA radio-group keyboard pattern instead of the app supplying nothing.

User-visible outcomes:

1. The five ratings become **one** tab stop, not five.
2. Arrow keys move between ratings and select as they move.
3. Selection wraps at both ends.
4. Arrow direction follows the document direction, so Arabic (RTL) behaves correctly.
5. Space selects the focused rating; Enter keeps its form-submit meaning.
6. The rating boxes look exactly as they do now, and the visible focus indicator survives the change.

**Not in scope:** Radix `RadioGroup`, a shared `@crm/ui` `RadioGroup` primitive, any new dependency, custom roving `tabIndex`, custom arrow-key handling, generic composite-widget infrastructure, the visible CSAT design, CSAT copy or translation keys, route-change focus, other portal accessibility findings, backend/API, RBAC, database.

---

## Context — Read These Files First

1. `apps/portal/src/components/tickets/ticket-detail-view.tsx` — **~lines 229–294**, the private `CsatForm`. The rating group is **~lines 261–277**: a `<div role="radiogroup" aria-label={t("detail.csatRatingSelectLabel")} className="flex gap-2">` wrapping `{[1, 2, 3, 4, 5].map(...)}` over `<button type="button" role="radio" aria-checked={rating === value} onClick={() => setRating(value)}>`. Note the `className` template literal on **~line 269** — it carries `focus-ring` and the two-branch selected/unselected token strings that must be preserved verbatim. Note also that `rating` is `useState<number | null>(null)` (**~line 232**) and gates submission at **~lines 240–242** and on the submit `Button`'s `disabled` (**~line 289**).
2. `apps/web/src/components/admin/branding-view.tsx` — **~lines 199–232**. The repository's only native radio group, and the doc comment recording *why* native radios were chosen over a primitive. Read the `<input type="radio" name="navigationLayout" value={option} checked={checked} onChange={...} />` shape inside its wrapping `<label>`. **This story keeps the existing `<div role="radiogroup">` rather than adopting that file's `<fieldset>`/`<legend>`** — see Design decision 2.
3. `apps/web/src/components/admin/branding-view.spec.tsx` — **~lines 258–300**, `describe("navigation layout (Story 129)")`. The repository's only existing radio-role assertions: `getByRole("radio", { name: ... })` with `toBeChecked()` / `not.toBeChecked()`. Match this query style.
4. `apps/portal/src/components/tickets/ticket-detail-view.spec.tsx` — **~lines 1–34** (imports and `vi.mock` blocks; note `useTranslations: () => (key: string) => key`, so every label asserts as its raw key), **~lines 49–72** (`queryResult` helper and `baseTicket`), **~lines 74–104** (the top-level `beforeEach` that mocks every hook), and **~lines 226–281** (the five existing CSAT tests). The file imports only `render, screen` from `@testing-library/react` — it does **not** yet import `userEvent`.
5. `apps/portal/src/components/portal/portal-header.spec.tsx` and `apps/portal/src/components/portal/change-password-section.spec.tsx` — the two portal specs that already use `@testing-library/user-event`. Copy their import form.
6. `packages/ui/src/components/label.tsx` (~line 29) and `packages/ui/src/components/checkbox.tsx` (~line 31) — the repository's existing `peer` / `peer-disabled:` usage, the precedent for driving a sibling's styling from an input's state.
7. `packages/config/tailwind-tokens.css` — **~lines 300–311** for `.focus-ring`'s exact definition (`focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface`). The peer-driven equivalent in this story must use these same tokens and add none.
8. `apps/portal/src/app/[locale]/layout.tsx` — **~line 33**, `<html lang={locale} dir={dir}>`. This is what makes RTL arrow behaviour a real-browser concern.
9. `apps/portal/messages/en.json` / `apps/portal/messages/ar.json` — **~lines 122–128**, `csatPrompt`, `csatRatingSelectLabel`, `csatRatingLabel`. **No key here changes.**

---

## Product rules (from story)

| | Current behaviour | New behaviour |
|---|---|---|
| Tab into the group | Focuses rating 1; each of the five is its own tab stop | Focuses the checked rating, or rating 1 when none is checked; **one** tab stop |
| Tab again | Moves to rating 2 | Leaves the group, to the comment `Textarea` |
| Right / Down | Nothing | Moves to the next rating **and selects it** |
| Left / Up | Nothing | Moves to the previous rating and selects it |
| Wrapping | n/a | Last → first, first → last |
| RTL | n/a | Arrow direction mirrors, supplied by the browser |
| Space | Activates the focused button | Selects the focused radio |
| Enter | Activates the focused button | Submits the form (native), **not** custom-bound |
| Mouse click | Selects | **Unchanged** |
| Appearance | 9×9 bordered box, accent fill when selected | **Unchanged** |
| Accessible name | The digit, from the button's text | The digit, from the label's text |

---

## Frontend Tasks

### 1 — Replace the five buttons with native radios

**File: `apps/portal/src/components/tickets/ticket-detail-view.tsx`**

Add a module-level constant beside the other module constants, so the shared `name` that groups the radios is stated once:

```tsx
/** Story 167 — the shared `name` is what makes the browser treat these five
 * inputs as one radio group: one tab stop, arrow-key movement, wrapping, and
 * direction-correct arrows under `dir="rtl"`. Nothing in this file implements
 * any of that. */
const CSAT_RATING_NAME = "csat-rating";
```

Replace the group at **~lines 261–277** with native inputs, keeping the wrapping `<div role="radiogroup">` and its `aria-label` exactly as they are:

```tsx
<div role="radiogroup" aria-label={t("detail.csatRatingSelectLabel")} className="flex gap-2">
  {[1, 2, 3, 4, 5].map((value) => (
    <label key={value} className="cursor-pointer">
      {/* `sr-only`, not hidden: the input stays focusable and in the
          accessibility tree, and the visible box below is styled from it
          through `peer`. `.focus-ring` cannot be used here because the
          focused element is the input while the painted element is the
          span — these are that utility's own four declarations, restated
          as `peer-focus-visible:` variants over the same tokens. */}
      <input
        type="radio"
        name={CSAT_RATING_NAME}
        value={value}
        checked={rating === value}
        onChange={() => setRating(value)}
        className="peer sr-only"
      />
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-md border text-sm font-medium peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-focus peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface ${
          rating === value
            ? "border-accent bg-accent text-accent-foreground"
            : "border-rule-strong bg-surface text-ink-strong hover:bg-surface-sunk"
        }`}
      >
        {value}
      </span>
    </label>
  ))}
</div>
```

**Do not** change `rating`'s `useState`, `handleSubmit`, the comment `Textarea`, the error `Alert`, the submit `Button`, the surrounding `SectionCard`, or anything above `CsatForm`.

**Do not** add `onKeyDown`, `tabIndex`, `onClick`, `role="radio"` or `aria-checked` to the inputs. `aria-checked` on a native radio is redundant with `checked` and would be a second source of truth.

### 2 — No other file changes

No `packages/ui` change. No new export, no new primitive. No `package.json` change in any workspace — **no dependency is added**. No i18n key added, removed or reworded in either `en.json` or `ar.json`.

### No backend changes required.

No API, DTO, Prisma, permission or route change. The submitted payload is unchanged: `handleSubmit` still sends `{ rating, comment? }` from the same `rating` state.

---

## Design decisions

### 1 — Native radios, per Story 129

The intake's option 1. Confirmed still correct against the current tree: `@radix-ui/react-radio-group` appears **zero** times in `pnpm-lock.yaml`, `apps/portal` has no direct Radix dependency at all, and `@crm/ui` exports no `RadioGroup`. Options 2 and 3 are rejected for the reasons Story 129 already recorded.

### 2 — Keep `<div role="radiogroup">`, do not adopt `<fieldset>`/`<legend>`

`branding-view.tsx` uses `<fieldset>` with a **visible** `<legend>`. The CSAT group's name (`csatRatingSelectLabel`, "Rating" / "التقييم") is deliberately invisible — the visible prompt is `csatPrompt` above it. Converting to `<fieldset>`/`<legend>` would either surface new visible copy or need an `sr-only` legend, both of which the intake places out of scope. Native radios group by their shared `name` attribute, **not** by a `fieldset`, so the keyboard behaviour is identical either way. The existing wrapper and label therefore stay.

### 3 — `sr-only` input + `peer`-styled span

The intake requires the visual to be unchanged, which rules out a visible native radio control. `sr-only` keeps the input focusable and in the accessibility tree (both verified — see Verification step 1). Because focus then lands on the invisible input, the `.focus-ring` class on the old button would paint nothing; the visible box must be ringed through `peer-focus-visible:`. Those four declarations are `.focus-ring`'s own, over the same `--focus` / `--surface` tokens. **No token, colour or utility is invented.** `peer` itself is already used in `packages/ui` (`checkbox.tsx`, `label.tsx`).

### 4 — The accessible name stays the digit

`<label>` wrapping the input and a `<span>` containing the digit yields the same accessible name the button's text content gave. This is why no i18n key changes.

---

## Edge Cases & Failure Modes

- **No rating selected yet.** `rating` is `null`, so no input is `checked`. Native behaviour: Tab enters the **first** radio, and it is focusable without being checked. The submit `Button` stays `disabled` via its existing `!rating` guard (~line 289). Do not add a default selection — an unselected group is the correct initial state for an unanswered survey.
- **Enter inside the form.** The inputs are inside `<form onSubmit={handleSubmit}>`. Native Enter on a radio submits the form, which runs the existing `handleSubmit`; its `if (!rating) return;` guard (~lines 240–242) already makes an Enter-before-selection a no-op. **Do not bind Enter to selection** — that is explicitly excluded by the acceptance criteria.
- **Two CSAT forms on one page.** Cannot happen: `CsatForm` renders only when `csatQuery.isSuccess && csatQuery.data == null` on a single ticket's detail page (~line 224). The fixed `name` is therefore safe. If that ever changes, the `name` must be made per-ticket.
- **`sr-only` hiding the input from assistive tech.** It does not — `sr-only` clips visually while leaving the element focusable and exposed. Verified in this repository's own jsdom environment (five radios found by role, and `.focus()` lands on an `sr-only` input). Do **not** substitute `hidden`, `display:none` or `visibility:hidden`, each of which would remove the radios from the accessibility tree and from the tab order entirely.
- **Losing the visible focus ring.** The most likely regression: dropping `peer` from the input, or putting the `peer-focus-visible:` variants on the `<label>` instead of the `<span>`. `peer` styles a **later sibling**, so the input must precede the span and both must be inside the label. A test pins the class.
- **`aria-checked` left on the inputs.** Would create a second, drifting source of truth next to `checked`. The rewritten markup must not carry it.
- **RTL arrow direction is not reproducible in jsdom.** See the Test Plan's note. Real browsers mirror Left/Right under `dir="rtl"`; this repository's test environment does not. The executor must **not** write an assertion claiming mirrored behaviour, and must not "fix" the implementation to satisfy one.
- **`user-event`'s `pointer-events` check on an `sr-only` input.** `user.click()` on a visually-clipped input still works in this environment (verified). If a click test ever fails on that basis, click the `<label>` or the visible `<span>` instead — never disable the pointer-events check.

---

## Test Plan

**All tests are unit tests in `apps/portal/src/components/tickets/ticket-detail-view.spec.tsx`.** Add `import userEvent from "@testing-library/user-event";` (the file does not import it yet; `portal-header.spec.tsx` shows the form). Add the new tests as their own nested `describe("CSAT rating keyboard pattern (Story 167)")` beside the existing CSAT tests (~lines 226–281). Every test first mocks a `RESOLVED` ticket exactly as the existing tests do:

```tsx
vi.mocked(useMyTicketQuery).mockReturnValue(
  queryResult({ data: { ...baseTicket, status: "RESOLVED" }, isSuccess: true }) as never,
);
```

1. **Structure.** `getByRole("radiogroup")` exists with accessible name `"detail.csatRatingSelectLabel"`; `getAllByRole("radio")` returns exactly **5**; their accessible names are `"1"`…`"5"`; none is checked initially.
2. **One tab stop.** `await user.tab()` focuses the first radio; a second `await user.tab()` focuses something that is **not** a radio (assert `getAllByRole("radio")` does not contain `document.activeElement`). This is the test that fails against today's five-button implementation.
3. **Arrow forward selects.** Focus the first radio, `await user.keyboard("{ArrowRight}")` → the second radio is focused **and** `toBeChecked()`, and the first is `not.toBeChecked()`. Repeat once with `{ArrowDown}`.
4. **Arrow backward selects.** From the third radio, `{ArrowLeft}` → the second is focused and checked. Repeat once with `{ArrowUp}`.
5. **Wrapping, both directions.** From the first, `{ArrowLeft}` → the **fifth** is focused and checked. From the fifth, `{ArrowRight}` → the **first** is focused and checked.
6. **Space selects.** Focus the third radio (unchecked), `await user.keyboard(" ")` → it is checked.
7. **Mutual exclusivity.** After any selection, exactly one of the five satisfies `toBeChecked()` — assert by filtering `getAllByRole("radio")`, not by reading component state.
8. **Keyboard selection enables submission.** With submit initially disabled (the existing test at ~line 274 covers the disabled case), select a rating by keyboard only and assert `screen.getByText("detail.csatSubmit").closest("button")` is **not** disabled.
9. **Mouse still works.** `await user.click(radios[3])` → that radio is checked and submit is enabled. Mirrors `branding-view.spec.tsx`'s own click assertions.
10. **Focus indicator survives.** The visible `<span>` beside each input carries `peer-focus-visible:ring-2` and `peer-focus-visible:ring-focus`, and the input carries `peer` and `sr-only`. This is the only class-level assertion; it guards Design decision 3, which no behavioural test can reach.
11. **Existing CSAT rules unchanged.** The five existing CSAT tests (~lines 226–281) must pass **unmodified** — form hidden before resolution, shown for `RESOLVED`, shown for `CLOSED`, read-only summary once a response exists, submit disabled until a rating is chosen. Do not edit them.

**Deliberately not tested — RTL arrow mirroring.** Measured in this repository's own environment at HEAD `4c6ccc2`: under `dir="rtl"`, `user-event` v14 moves `{ArrowLeft}` *backward*, identically to LTR. Real browsers move it *forward*. A test asserting mirrored behaviour here would fail; a test asserting the LTR result would pin the wrong contract as if it were correct. The acceptance criterion is instead met **structurally**, by test 12:

12. **RTL correctness by construction.** Assert the mechanism that guarantees it: every rating input is a native `<input type="radio">` sharing one `name`, and `CsatForm` contains **no** `onKeyDown`, no `tabIndex` and no `role="radio"` attribute. Browser-supplied direction handling follows from that and from nothing else. The same reasoning is already recorded in `packages/ui/src/components/tabs.tsx` ~lines 13–17, where Radix is credited with "arrow keys following the document direction, so Left moves to the *next* tab under `dir=\"rtl\"`".

---

## Verification Steps

1. **Frontend runs:** `pnpm --filter @crm/portal test` from the repository root. Baseline measured at HEAD `4c6ccc2`: **44 files, 366 tests passing**. Expect 366 + the new cases, 0 failures. The following jsdom/`user-event` behaviours were measured at that HEAD and the test plan depends on them: one tab stop ✔, `{ArrowRight}` moves and checks ✔, `{ArrowLeft}` wraps first→last ✔, Space checks ✔, click checks ✔, `toBeChecked()` readable ✔, `sr-only` input focusable and exposed by role ✔, RTL arrow mirroring ✘ (not implemented — see Test Plan).
2. **Regression:** `pnpm --filter @crm/web test` (**1243**) and `pnpm --filter @crm/ui test` (**268**), both expected **unchanged** — nothing outside `apps/portal` is touched. A change in either means the edit leaked.
3. **Regression:** `apps/portal/src/design-tokens.spec.ts` passes. Its "no raw `slate-*` or `white` palette class" guard covers the rewritten `className`s; every colour above is a token (`border-accent`, `bg-surface`, `ring-focus`, `ring-offset-surface`).
4. **Backend builds:** `pnpm typecheck`, then `pnpm lint`, then `pnpm build` from the repository root.
5. **Regression — no new dependency:** `git diff --stat -- '**/package.json' pnpm-lock.yaml` is **empty**.
6. **Regression — no i18n drift:** `git diff --stat -- apps/portal/messages` is **empty**.
7. **Regression — scope:** `git diff --stat` shows exactly **2** files: `apps/portal/src/components/tickets/ticket-detail-view.tsx` and its spec. No `packages/ui` file, no `apps/web` file, no `apps/api` file.
8. Re-scan: `grep -n 'role="radio"\|onKeyDown\|tabIndex' apps/portal/src/components/tickets/ticket-detail-view.tsx` returns **no** match inside `CsatForm`.

---

## Done Criteria

- [ ] The five ratings are native `<input type="radio">` sharing one `name`; no `role="radio"`, `aria-checked`, `onKeyDown` or `tabIndex` remains in `CsatForm`.
- [ ] The group is one keyboard tab stop; a second Tab leaves it.
- [ ] Tab into the group focuses the checked rating, or the first when none is checked.
- [ ] Right/Down move to and select the next rating; Left/Up the previous.
- [ ] Selection wraps last→first and first→last.
- [ ] Space selects the focused rating; Enter is not custom-bound.
- [ ] Exactly one rating is checked after any selection.
- [ ] Submit becomes enabled after a keyboard-only selection, and still sends the selected rating through the unchanged `handleSubmit`.
- [ ] Mouse selection still works.
- [ ] The five rating boxes are visually unchanged, and a visible focus ring is present on the focused rating via `peer-focus-visible:` over the existing `--focus` tokens.
- [ ] The existing `<div role="radiogroup">` and its `aria-label` are retained; the accessible name of each rating is still its digit.
- [ ] EN/AR message catalogues byte-identical; no key added, removed or reworded.
- [ ] No dependency added; no `package.json` or `pnpm-lock.yaml` change; no `@crm/ui` `RadioGroup` primitive introduced.
- [ ] RTL correctness is established structurally (test 12) and **no** test asserts jsdom's non-mirroring arrow behaviour as if it were browser behaviour.
- [ ] The five existing CSAT tests pass unmodified; no test weakened, skipped or deleted.
- [ ] portal / web / ui suites, typecheck, lint and build green; diff limited to 2 files.
