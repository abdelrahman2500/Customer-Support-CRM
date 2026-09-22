# form-field-accessibility — plan overview

Entry point for the **form-field-accessibility** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
|-----|------|-------|------------|------------|
| 151 | [151-story-form-field-accessibility.md](./151-story-form-field-accessibility.md) | Make FormField validation errors programmatically associated with their controls | — | Story 141 (`FormField` primitive), Stories 147/148 (its 7 call sites) |

## Dependency notes

Story 141 created `FormField` in [../form-field-primitive/00-overview.md](../form-field-primitive/00-overview.md) and established the implicit-labelling contract this story must preserve. Stories 147 and 148 added all seven current call sites — three in `apps/web`, four in `apps/portal`.

The work is confined to `packages/ui`. Because both apps consume the same primitive, one change covers them; **no call site is edited**, and a diff touching `apps/` means the contract was not delivered in the right place.

## Decision settled by measurement before planning

`FormField` renders `hint` and `error` *inside* the `<label>`. Rendering the component and reading the DOM gives:

```
label.textContent === "SubjectKeep it short.Required"
screen.queryByLabelText("Subject")  // → null (exact match fails)
```

An implicit label contributes its whole text subtree to the accessible name, so the hint and error are currently part of the control's **name**. Adding `aria-describedby` on top of that would announce the error twice — as name and as description. The story therefore moves the hint and error out of the `<label>` and into a wrapper, which also repairs exact-match `getByLabelText`.

This was verified against the real component before planning, not inferred.

## Deliberately excluded

- Any visual redesign of `FormField`, and any change to `DENSITY`, the `--danger-*` token, or `role="status"`.
- `apps/web/src/components/admin/branding-view.tsx` — it hand-rolls its own `<label>` and is **not** a `FormField` consumer. Its existing manual `aria-invalid` / `aria-describedby` stay as they are.
- Broad ARIA remediation of components that do not use `FormField`.
- Controls the primitive's own doc comment already excludes (a Radix `Select` trigger, a checkbox with its label beside it) — those keep `Label` + `htmlFor`.
- Validation rules, error copy, i18n content, and the four locale-unaware date sites noted in recon.
