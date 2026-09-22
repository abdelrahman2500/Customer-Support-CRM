# Story intake

## Feature

- **Feature name (display):** Form Field Accessibility
- **Feature slug (folder under `plans/`):** `form-field-accessibility`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:**
- **Work item type:**
- **Status:**
- **Assignee:**
- **Labels:**

## Title

```text
Make FormField validation errors programmatically associated with their controls
```

## Description

```text
Improve the shared FormField primitive so validation errors are programmatically associated with the corresponding form control.

The current shared primitive renders validation errors in a role="status" element, but does not automatically expose the invalid state or associate the error message with the control.

Current behavior:
- FormField renders the validation message visually.
- The associated control does not automatically receive aria-invalid.
- The validation message is not automatically connected through aria-describedby.
- Only a small number of individual call sites currently implement aria-invalid/aria-describedby manually.

The implementation should establish the accessibility contract at the shared FormField level so adopting call sites receive correct validation semantics consistently.

The solution must preserve existing FormField behavior and implicit-labeling semantics.

The implementation should use generated/stable IDs where necessary so aria-describedby can reference the correct validation message without requiring every consumer to manually manage IDs.

The accessibility behavior should work for both the web and portal applications through the shared UI package.
```

## Acceptance criteria

```text
- [ ] FormField exposes the invalid state to the associated form control when a validation error is present.
- [ ] The associated form control receives aria-invalid="true" when the field has a validation error.
- [ ] The validation message has a stable/generated id when rendered.
- [ ] The associated form control receives aria-describedby referencing the validation message when a validation error is present.
- [ ] aria-describedby is not unnecessarily added when there is no validation message.
- [ ] Existing FormField label association and implicit-labeling behavior remain intact.
- [ ] The solution works for the shared FormField primitive used by both web and portal applications.
- [ ] Existing FormField consumers do not need to manually generate IDs merely to obtain the standard validation accessibility behavior.
- [ ] Existing explicit aria-describedby usage is preserved and is not accidentally overwritten.
- [ ] Existing explicit aria-invalid usage is preserved according to the component's established prop/attribute contract.
- [ ] Tests cover the presence of aria-invalid when an error exists.
- [ ] Tests cover the association between the control's aria-describedby and the rendered validation message.
- [ ] Tests cover the no-error state.
- [ ] Existing UI package tests remain green.
- [ ] Web and portal typechecks/builds remain green.
- [ ] No broad ARIA retrofit is introduced for unrelated components.
```

## Attachments

None.

## Dependencies

- **Blocked by / related ids:** None.
- **Depends on code areas or other stories:**

  - `packages/ui/src/components/form-field.tsx`
  - Existing FormField consumers in `apps/web`
  - Existing FormField consumers in `apps/portal`
  - Existing UI component tests
  - Existing accessibility/testing conventions in the repository

## Extra notes

- Recon identified this as a confirmed P1 accessibility gap.
- The current primitive renders the error using `role="status"` but does not automatically connect the error to its control.
- Repository-wide recon found only 2 existing `aria-invalid` usages and 2 existing `aria-describedby` usages, both in `branding-view.tsx`; the shared primitive should become the consistent mechanism for validation errors.
- This is intended as a focused shared-primitive improvement, not a broad accessibility rewrite.
- Preserve the repository's existing accessibility, i18n, RTL, and design-token conventions.
- Do not introduce client-side permission gating or unrelated UI changes.

## Technical hints

- Primary package: `packages/ui`
- Primary file: `packages/ui/src/components/form-field.tsx`
- Primary language: TypeScript/React
- Prefer generated IDs through the existing React conventions rather than requiring consumer-managed IDs.
- Consider how `aria-describedby` should behave when consumers already provide their own description IDs.
- Verify the primitive's actual API and all current consumers before deciding the exact implementation shape.
- Follow existing test conventions rather than introducing a new testing framework or pattern.

## Out of scope

- Redesigning the FormField visual appearance.
- Replacing the existing validation-message component.
- Broad ARIA remediation across unrelated components.
- Retrofitting every existing form manually if the shared primitive can provide the behavior.
- Redesigning forms in web or portal.
- Changing validation rules or error messages.
- Changing i18n content.
- Changing authentication, authorization, API behavior, or backend validation.
- Adding automated accessibility tooling unrelated to this story.
- Fixing the four locale-unaware date formatting sites identified in the recon; that may be handled separately.
- React 19 or Tailwind 4 upgrades.
