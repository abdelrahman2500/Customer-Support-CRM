# Story 151 — Make FormField validation errors programmatically associated with their controls

---

## Prerequisites

- **Story 141 completed** — `FormField` exists as a shared primitive. See [../form-field-primitive/00-overview.md](../form-field-primitive/00-overview.md). This story changes that primitive's internals; it does not change its public prop names.
- **Story 147 completed** — added five of the seven current `FormField` call sites (the two change-password forms, web and portal).
- **Story 148 completed** — added the seventh (`apps/portal/src/components/tickets/ticket-list-view.tsx`).
- No backend, API, permission, or i18n dependency. No coordination with another owner required: `FormField` has exactly **7** call sites, all listed in `## Context` below.

---

## Story Goal

A screen-reader user who focuses a `FormField` with a validation error must hear that the field is invalid and hear the error text as the field's **description**.

Today they hear neither correctly:

1. The control gets no `aria-invalid`, so the field never reports an invalid state.
2. The error is not referenced by `aria-describedby`, so it is only announced by the `role="status"` live region at the instant it appears — a user who tabs back to the field later hears nothing.
3. **Verified by measurement (see `## Design decisions` § 1):** because the hint and error render *inside* the `<label>`, they are currently concatenated into the control's accessible **name**.

Deliver the accessibility contract **once, inside the shared primitive**, so all 7 existing call sites and every future one get it without managing ids.

**Not in scope:** any visual redesign, any change to validation rules or error copy, any ARIA work on components that do not use `FormField` (explicitly including `apps/web/src/components/admin/branding-view.tsx`, which hand-rolls its own `<label>` and is **not** a `FormField` consumer), and the four locale-unaware date sites noted in recon.

---

## Context — Read These Files First

1. `packages/ui/src/components/form-field.tsx` — the whole file (81 lines). Read the doc comment at **lines 15–22** ("Why a `<label>` wrapper") before changing anything: the implicit-labelling decision is deliberate and must survive. The props interface is **lines 39–54**, the `DENSITY` map **lines 56–59**, and the render body **lines 69–80**. Note that `{hint}` (**line 73**) and the error `<span role="status">` (**lines 74–78**) are both emitted *inside* the `<label>` opened at **line 70**.
2. `packages/ui/src/components/form-field.spec.tsx` — the whole file (98 lines). Seven existing tests. Two constrain the restructure directly: **lines 73–87** assert `container.firstElementChild` carries `text-xs` / `text-sm`, and **lines 89–97** assert no physical-direction utility appears anywhere in `container.innerHTML`. **Line 13** asserts `screen.getByLabelText("Subject")` resolves to the nested `<input>`.
3. `packages/ui/src/components/input.tsx` — all 18 lines. `Input` is a `React.forwardRef` that spreads `...props` onto the native `<input>` (**lines 7–15**). This is why injected `aria-*` attributes reach the DOM node. `Textarea` (`packages/ui/src/components/textarea.tsx`, **line 25**: `export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>`) follows the same shape.
4. `packages/ui/src/index.ts` — **lines 120–121**, the existing `FormField` / `FormFieldProps` exports. No new export is required by this story.
5. `apps/web/src/components/settings/change-password-section.tsx` — **lines 117–146**. Three call sites; the second (**lines 126–137**) is the only one in the repo that passes `hint` **and** `error` together, so it is the sharpest test of the restructure.
6. `apps/portal/src/components/portal/change-password-section.tsx` — **lines 92–124**. Three call sites, mirroring the web file.
7. `apps/portal/src/components/tickets/ticket-list-view.tsx` — **lines 134–141**. The seventh call site; passes `className="sm:w-64"` and **no** `error`, so it exercises the no-error path and the `className` merge.
8. `apps/web/src/components/admin/branding-view.tsx` — **lines 140–186**. Read only as **reference**. Its comment at **lines 140–142** independently documents the same accessible-name hazard this story fixes ("inside it, it would become part of the field's own accessible name rather than its description"). **Do not modify this file** — it does not use `FormField`.
9. Grep for `useId` across `packages/ui/src`, `apps/web/src`, `apps/portal/src` — it returns **no** hits. This story introduces the repository's first use of `React.useId`. React is pinned at `^18.3.1` in `packages/ui/package.json` (`peerDependencies` and `devDependencies`), so `useId` is available.
10. `packages/ui/vitest.config.mts` and `packages/ui/src/test/setup.ts` — the test environment (`jsdom`, `globals: false`, explicit `cleanup()` in `afterEach`). Match this; do not introduce a new testing pattern.

---

## Product rules (from story)

| | Current behaviour | New behaviour |
|---|---|---|
| Invalid state | Control receives no `aria-invalid`. | Control receives `aria-invalid="true"` whenever `error` is truthy. |
| Error association | Error rendered in `role="status"`, not referenced by the control. | Error has a generated id and is referenced by the control's `aria-describedby`. |
| Hint association | Hint rendered inside `<label>`, contributing to the accessible **name**. | Hint has a generated id and is referenced by the control's `aria-describedby` as a **description**. |
| Accessible name | `"SubjectKeep it short.Required"` (measured). | `"Subject"`. |
| No error | — | No `aria-invalid`, and no error id in `aria-describedby`. |
| Consumer-supplied `aria-describedby` | Not considered. | Preserved and **prepended**; generated ids are appended to it. |
| Consumer-supplied `aria-invalid` | Not considered. | Wins over the derived value. |

---

## Design decisions

### 1 — The hint and error must move **outside** the `<label>`, and this is measured, not assumed

Rendering `<FormField label="Subject" hint="Keep it short." error="Required"><input /></FormField>` and reading the DOM produces:

```
label.textContent === "SubjectKeep it short.Required"
screen.queryByLabelText("Subject")  // → null (exact match fails)
screen.queryByLabelText(/Subject/)  // → the input (regex match succeeds)
```

An implicit label contributes its entire text subtree to the control's accessible name. So today the hint and error are part of the **name**, not the description. Adding `aria-describedby` without restructuring would make the error serve as *both* name and description — announced twice.

**Therefore:** the `<label>` must wrap **only** the label text and the control. The hint and error move to siblings inside a new outer wrapper element.

This is a strict improvement to the criterion "existing label association and implicit-labeling behavior remain intact": implicit labelling is preserved (the control stays nested in the `<label>`), and `getByLabelText("Subject")` starts working with an exact match where it previously failed.

### 2 — Density and `className` move to the wrapper

The existing spec asserts `container.firstElementChild` carries the density class (**form-field.spec.tsx lines 73–87**). After restructuring, `container.firstElementChild` is the new wrapper. Put `cn("flex flex-col gap-tight", DENSITY[density], className)` on the **wrapper**, and give the inner `<label>` the layout classes it needs to keep the label-above-control stack (`flex flex-col gap-tight`). Both existing density assertions then pass unchanged.

### 3 — `React.useId`, not a consumer-supplied id

`useId` gives a stable, SSR-safe, collision-free base. Derive both ids from one call:

```tsx
const generatedId = React.useId();
const hintId = `${generatedId}-hint`;
const errorId = `${generatedId}-error`;
```

Both apps are Next.js App Router with server rendering, which is exactly the case `useId` exists for. **Do not** use a module-level counter or `Math.random()`.

### 4 — `cloneElement` on a single element child, with a guard

All 7 current call sites pass exactly one element child (an `<Input>`). Inject the ARIA attributes with `React.cloneElement` guarded by `React.isValidElement`. When the child is **not** a single valid element (a fragment, an array, a bare string), render it unchanged and inject nothing — the field degrades to today's behaviour rather than throwing.

`Input` and `Textarea` both spread `...props` onto their native element, so injected attributes reach the DOM. A consumer nesting a Radix `Select` trigger is out of scope by the primitive's own doc comment (**form-field.tsx lines 19–22**) — those keep using `Label` + `htmlFor`.

### 5 — Merge, never overwrite

- **`aria-describedby`**: compose as `[childOwnValue, hint && hintId, error && errorId].filter(Boolean).join(" ")`. Put the child's own value **first** so a consumer's description is announced before the generated ones. When the result is empty, pass `undefined` — **do not** emit `aria-describedby=""`.
- **`aria-invalid`**: if the child already sets `aria-invalid`, that value wins untouched. Otherwise set `true` when `error` is truthy, and `undefined` when not — **do not** emit `aria-invalid="false"`.

### 6 — `role="status"` stays

The live region is Story 141's deliberate choice (polite, not interrupting mid-typing) and `form-field.spec.tsx` **lines 60–71** pins it. Adding `id` and `aria-describedby` is additive; the role does not change.

---

## Frontend Tasks

No backend changes required. No API, DTO, Prisma, permission, route, or i18n change.

### 1 — Rewrite the `FormField` render body

**File: `packages/ui/src/components/form-field.tsx`**

Extend `FormFieldProps` (**lines 39–54**) with no breaking changes — all existing props keep their names, types and defaults. Replace the component body (**lines 61–81**) with the structure below. Keep the existing file doc comment and **add** a section recording why the hint and error left the `<label>`, citing the measured accessible name.

```tsx
export function FormField({
  label,
  children,
  hint,
  error,
  density = "compact",
  className,
}: FormFieldProps) {
  const generatedId = React.useId();
  const hintId = `${generatedId}-hint`;
  const errorId = `${generatedId}-error`;

  const describedBy =
    [
      React.isValidElement(children)
        ? (children.props as { "aria-describedby"?: string })["aria-describedby"]
        : undefined,
      hint ? hintId : undefined,
      error ? errorId : undefined,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  const control = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        "aria-describedby": describedBy,
        "aria-invalid":
          (children.props as { "aria-invalid"?: boolean | string })["aria-invalid"] ??
          (error ? true : undefined),
      })
    : children;

  return (
    <div className={cn("flex flex-col gap-tight", DENSITY[density], className)}>
      <label className="flex flex-col gap-tight">
        {label}
        {control}
      </label>
      {hint && (
        <span id={hintId} className="text-xs text-ink-subtle">
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} role="status" className="text-xs text-danger-foreground">
          {error}
        </span>
      )}
    </div>
  );
}
```

**Do not** change `DENSITY` (**lines 56–59**), the error's `text-danger-foreground` token, or the `role="status"`.

### 2 — Call sites

**No changes required to any of the 7 call sites.** That is the point of the story — verify by reading them, not by editing them. Confirm after the change that `apps/web/src/components/settings/change-password-section.tsx`, `apps/portal/src/components/portal/change-password-section.tsx` and `apps/portal/src/components/tickets/ticket-list-view.tsx` are untouched in `git status`.

---

## Edge Cases & Failure Modes

- **`error=""` (empty string).** Falsy, so no error `<span>`, no `errorId` in `aria-describedby`, no `aria-invalid`. Already pinned by `form-field.spec.tsx` **lines 32–46**; the new tests must not regress it. Call site: `change-password-section.tsx` passes `undefined`, not `""`, but the primitive must tolerate both.
- **Neither `hint` nor `error`.** `describedBy` computes to `""` and must become `undefined`, so no empty `aria-describedby` attribute lands in the DOM. This is the path `ticket-list-view.tsx` **line 134** takes.
- **Consumer already sets `aria-describedby` on the child.** Preserved and placed first. No current call site does this; the contract exists so a future one is not silently broken.
- **Consumer already sets `aria-invalid` on the child.** Wins, including an explicit `false`. Use `??` (nullish coalescing), **not** `||`, or an explicit `false` would be overwritten.
- **Children is a fragment, an array, or a string.** `React.isValidElement` is false; render unchanged and inject nothing. No throw.
- **Children is a component that does not forward props.** The attributes are passed but silently dropped by that component. Not detectable from inside `FormField`; out of scope. Both primitives used today (`Input`, `Textarea`) do forward.
- **Two `FormField`s on one page.** `useId` guarantees distinct bases, so the ids cannot collide. Worth an explicit test — see Test Plan item 6.
- **SSR/hydration.** `useId` is hydration-safe by design. Both apps render these forms inside `"use client"` components, so this is not exercised server-side today, but the choice must not be downgraded to a counter.
- **Uncertainty to surface to the executor:** the density/`className` split between wrapper and inner `<label>` is the one place the visual result could shift. `gap-tight` now applies at two levels (wrapper and label). If the rendered vertical rhythm changes at any of the 7 call sites, correct it by removing `gap-tight` from the inner `<label>` and relying on the wrapper's — **do not** introduce a new spacing token.

---

## Test Plan

All tests go in **`packages/ui/src/components/form-field.spec.tsx`**, matching the file's existing style (`describe("FormField", ...)`, `render` + `screen`, no `globals`). Keep all 7 existing tests; one gets strengthened.

1. **`aria-invalid` is set when an error is present.** Render with `error="Required"`; assert the control has `aria-invalid` `"true"`. *(Acceptance: "control receives aria-invalid=true".)*
2. **No `aria-invalid` when there is no error.** Render with no `error`; assert the attribute is absent — not `"false"`.
3. **`aria-describedby` points at the error, and the referenced node holds the message.** Render with `error="Required"`; read the control's `aria-describedby`, split on whitespace, and assert one of the ids resolves via `document.getElementById` to the element with text `"Required"`. Assert the association, not a hard-coded id string.
4. **`aria-describedby` points at the hint too, when both are present.** Render with `hint` and `error`; assert both ids appear and both resolve to the right text.
5. **No `aria-describedby` attribute at all when neither hint nor error is given.** Guards against `aria-describedby=""`.
6. **Two fields on one page get distinct ids.** Render two `FormField`s each with an error; assert their controls' `aria-describedby` values differ.
7. **A consumer's own `aria-describedby` survives.** Render `<input aria-describedby="external-help" />` with an `error`; assert the final value contains both `"external-help"` and the generated error id.
8. **A consumer's own `aria-invalid` wins.** Render `<input aria-invalid={false} />` with an `error`; assert the control reports `"false"`.
9. **Strengthen the existing implicit-label test (currently `form-field.spec.tsx` lines 6–14).** Add `hint` and `error` to the render and assert `screen.getByLabelText("Subject")` still resolves with an **exact** match. This is the regression guard for § 1 and fails against the pre-change component.
10. **Non-element child does not throw.** Render `<FormField label="X" error="e">plain text</FormField>`; assert it renders and no `aria-*` injection is attempted.

Do **not** add tests to `apps/web` or `apps/portal` — the behaviour lives entirely in the shared primitive, and neither app's suite has a `FormField`-specific spec today.

---

## Verification Steps

1. **UI package tests:** from `packages/ui`, run `npx vitest run src/components/form-field.spec.tsx`. Expect every existing test plus the new ones green.
2. **Full UI suite (regression):** from the repo root, `pnpm --filter @crm/ui test`. Baseline before this story is **230 passed**; expect 230 + the tests added above, with **no** failures.
3. **Regression — consumers:** `pnpm --filter @crm/web test` (baseline **1178 passed**) and `pnpm --filter @crm/portal test` (baseline **354 passed**). Both must stay green with no spec edits; `change-password-section.spec.tsx` in both apps queries fields via `getByLabelText` with anchored patterns and is the most likely place a regression would surface.
4. **Typecheck:** from the repo root, `pnpm typecheck`. `cloneElement` with a generic props record is the one place this can fail; resolve with the cast shown in Frontend Task 1 rather than `any`.
5. **Lint:** from the repo root, `pnpm lint`. Must stay at **0 problems**.
6. **Build:** from the repo root, `pnpm build`. All 6 tasks must succeed.
7. **Diff audit:** `git status --short` must show **only** `packages/ui/src/components/form-field.tsx` and `packages/ui/src/components/form-field.spec.tsx`. Any change under `apps/` means the primitive did not carry the contract.

---

## Done Criteria

- [ ] The control receives `aria-invalid="true"` when `error` is truthy.
- [ ] The control receives no `aria-invalid` attribute when there is no error.
- [ ] The validation message carries a generated, stable id.
- [ ] The control's `aria-describedby` references the validation message when an error is present.
- [ ] `aria-describedby` is absent entirely — not empty — when there is no hint and no error.
- [ ] The hint is referenced as a description rather than contributing to the accessible name.
- [ ] `screen.getByLabelText("Subject")` resolves with an exact match even when `hint` and `error` are present.
- [ ] Implicit labelling is preserved: the control remains nested inside the `<label>`.
- [ ] A consumer-supplied `aria-describedby` on the child is preserved and appears first.
- [ ] A consumer-supplied `aria-invalid` on the child wins, including an explicit `false`.
- [ ] Ids are unique across two `FormField`s rendered on the same page.
- [ ] A non-element child renders without throwing.
- [ ] None of the 7 existing call sites is modified.
- [ ] `packages/ui` (230+), `apps/web` (1178), `apps/portal` (354) suites green; `pnpm typecheck`, `pnpm lint` (0 problems) and `pnpm build` all pass.
- [ ] No ARIA change to any component that does not use `FormField` — `branding-view.tsx` in particular is untouched.
