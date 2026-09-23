# Story intake

## Feature

- **Feature name (display):** Give the portal CSAT rating the ARIA radio-group keyboard pattern
- **Feature slug (folder under `plans/`):** `give-the-portal-csat-rating-the-aria-radio-group-keyboard-pattern`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:**
- **Work item type:**
- **Status:**
- **Assignee:**
- **Labels:**

## Title

Give the portal CSAT rating the ARIA radio-group keyboard pattern

## Description

Improve the keyboard behavior of the portal CSAT rating control so that it follows the native radio-group interaction pattern.

The current CSAT widget is a hand-built composite widget:

- A `div` with `role="radiogroup"`
- Five `<button>` elements with `role="radio"`
- Correct `aria-label`
- Correct `aria-checked`
- No `tabIndex` management
- No arrow-key handling

Because the elements are native buttons, all five ratings are currently independent tab stops. Arrow keys do nothing.

The widget remains operable with Tab + Space/Enter, so this is an accessibility behavior mismatch rather than a keyboard-access blocker.

### Affected component

`apps/portal/src/components/tickets/ticket-detail-view.tsx`

Private component:

`CsatForm`

### Current behavior

- Tab reaches rating 1.
- Each of the five ratings is a separate tab stop.
- Arrow keys do nothing.
- Space/Enter activate the focused button.
- `aria-checked` reflects the selected rating.
- No rating is selected initially.
- The comment textarea follows the five individual rating tab stops.

### Desired behavior

Use native radio inputs so the browser provides the standard radio-group keyboard behavior without introducing a new JavaScript focus-management implementation or dependency.

The existing visual presentation should remain unchanged.

The existing rating state should continue to drive the submitted CSAT value and visual selected state.

The existing `div role="radiogroup"` and accessible label should remain unless implementation investigation demonstrates a concrete reason to change them.

## Implementation direction

Use native:

`<input type="radio">`

with:

- a shared `name`
- appropriate `value`
- `checked`
- `onChange`
- the existing rating state
- the existing visible rating presentation

The native radio input may be visually hidden using the repository's existing accessible-hidden pattern while keeping the existing visible rating UI.

Do not implement custom roving `tabIndex` or custom arrow-key handling unless the repository's existing implementation makes native radios genuinely unsuitable.

Do not add Radix `RadioGroup`.

Do not add a new shared `RadioGroup` primitive.

### RTL

The portal layout uses RTL for Arabic locales.

Native radio behavior should be preferred because the browser handles radio-group keyboard behavior without requiring custom Left/Right mapping.

The implementation must preserve correct behavior in both LTR and RTL locales.

## Acceptance criteria

- [ ] The CSAT rating is implemented using native radio inputs or an equivalent native radio-group mechanism.
- [ ] The five ratings form one keyboard tab stop rather than five independent tab stops.
- [ ] Tabbing into the group focuses the checked rating when a rating exists.
- [ ] When no rating exists, entering the group focuses the first rating according to native radio behavior.
- [ ] Right/Down arrow navigation moves to and selects the next rating.
- [ ] Left/Up arrow navigation moves to and selects the previous rating.
- [ ] Navigation wraps from the last rating to the first and from the first to the last.
- [ ] Arrow-key behavior works correctly for the portal's RTL layout.
- [ ] Space selects the focused rating.
- [ ] Enter is not custom-bound to radio selection.
- [ ] Exactly one rating is selected after a rating has been chosen.
- [ ] The existing submit behavior continues to use the selected rating.
- [ ] The CSAT submit button becomes enabled after a rating is selected through keyboard interaction.
- [ ] Existing mouse selection continues to work.
- [ ] Existing visual appearance of the five rating controls is preserved.
- [ ] Existing accessible naming is preserved.
- [ ] Existing EN/AR translations are unchanged unless a concrete accessibility issue requires a change.
- [ ] Tests cover the keyboard interaction and selection behavior.
- [ ] No new dependency is introduced.
- [ ] No shared `RadioGroup` primitive is introduced.
- [ ] No unrelated portal behavior is changed.

## Attachments

None.

## Dependencies

- **Blocked by / related ids:** Story 166 — completed.
- **Depends on code areas or other stories:** `CsatForm` in `apps/portal/src/components/tickets/ticket-detail-view.tsx`; existing radio implementation precedent in `apps/web/src/components/admin/branding-view.tsx`.

## Extra notes

Read-only recon was completed at HEAD `4c6ccc2`.

The recon confirmed the original finding remains present.

The repository has no hand-rolled composite keyboard widget and no existing `RadioGroup` primitive in `@crm/ui`.

The repository's only native radio-group implementation is in:

`apps/web/src/components/admin/branding-view.tsx`

The existing repository decision recorded there favors native radio inputs instead of adding a RadioGroup primitive for small radio groups.

The recon identified three implementation options:

1. Native `<input type="radio">` — preferred because browser behavior supplies the required keyboard interaction and RTL handling without custom JavaScript.
2. Local roving `tabIndex` + `onKeyDown` — possible but introduces custom focus and RTL behavior that the browser already provides for native radios.
3. Radix `RadioGroup` — not currently available and would require introducing a new dependency/shared primitive for a single portal consumer.

This story should use option 1 unless implementation discovers a concrete repository constraint that prevents it.

The recon also found that the existing portal test suite has no assertions using `role="radio"` or `role="radiogroup"` and does not currently test CSAT rating selection through keyboard or mouse interaction.

## Technical hints

- **Repository root:** `.`
- **Primary language:** TypeScript
- **Affected component:** `apps/portal/src/components/tickets/ticket-detail-view.tsx`
- **Affected test:** `apps/portal/src/components/tickets/ticket-detail-view.spec.tsx`
- **Existing radio precedent:** `apps/web/src/components/admin/branding-view.tsx`
- **Existing radio tests:** `apps/web/src/components/admin/branding-view.spec.tsx`
- **Portal RTL layout:** `apps/portal/src/app/[locale]/layout.tsx`
- **Shared UI package:** `packages/ui`

## Testing requirements

Add focused tests to the existing portal ticket-detail spec.

At minimum verify:

1. The CSAT group exposes five radios.
2. The group has one keyboard entry point.
3. Arrow navigation moves and selects ratings.
4. Navigation wraps in both directions.
5. RTL behavior is correct.
6. Space selects the focused rating.
7. Only one rating is selected at a time.
8. Keyboard selection enables submission.
9. Mouse selection still works.
10. Existing CSAT visibility rules remain unchanged.

Prefer accessible queries such as:

- `getByRole("radiogroup")`
- `getAllByRole("radio")`

and state assertions such as:

- `toBeChecked()`
- focus assertions

Avoid testing implementation details such as internal React state.

## Verification expectations

The eventual implementation should verify:

- Portal tests pass.
- Portal typecheck passes.
- Portal lint passes.
- Full repository typecheck/lint/build remain green.
- EN/AR parity remains unchanged.
- No new dependency is added.
- No API/backend work is introduced.
- No shared UI primitive is introduced.
- No unrelated portal behavior changes.

## Out of scope

- Adding Radix `RadioGroup`.
- Adding a new `@crm/ui` `RadioGroup` primitive.
- Hand-rolled generic composite-widget infrastructure.
- Changing the visible CSAT design.
- Changing CSAT copy or translation keys without a concrete requirement.
- Route-change focus management.
- General keyboard-accessibility cleanup.
- Other portal accessibility findings.
- Backend/API changes.
- RBAC or permission changes.
- Database or migration changes.
