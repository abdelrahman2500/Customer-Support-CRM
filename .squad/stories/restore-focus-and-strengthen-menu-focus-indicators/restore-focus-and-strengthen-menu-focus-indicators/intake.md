# Story intake

## Feature

- **Feature name (display):** Restore focus and strengthen menu focus indicators
- **Feature slug (folder under `plans/`):** `restore-focus-and-strengthen-menu-focus-indicators`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:**
- **Work item type:**
- **Status:**
- **Assignee:**
- **Labels:**

## Title

Restore focus and strengthen menu focus indicators

## Description

Improve keyboard focus continuity and focus-indicator visibility in the web application.

The current implementation has two related focus-management defects where keyboard focus is lost when the currently focused control removes itself from the DOM, plus a shared menu/select focus-indicator implementation whose measured contrast is below the WCAG 2.4.11 focus-indicator threshold.

The story should apply existing repository conventions rather than introduce a new focus-management abstraction.

### Focus restoration

When entering inline edit mode on the ticket, customer, and knowledge-base detail pages, the edit input correctly receives focus through `autoFocus`.

When editing is exited through Escape or Enter/save, the focused input is unmounted but no successor receives focus. Focus therefore falls back to the document body.

The story should restore focus to the appropriate persistent control after the edit exits while preserving the existing `autoFocus` behavior.

Affected files:

- `apps/web/src/components/tickets/ticket-detail-view.tsx`
- `apps/web/src/components/customers/customer-detail-view.tsx`
- `apps/web/src/components/knowledge-base/article-detail-view.tsx`

The same focus-removal pattern exists in the Reports "Save current view" form. Both Save and Cancel remove the focused button by setting `showSaveForm` to false. Focus should return to the persistent "Save current view" trigger.

Affected file:

- `apps/web/src/components/reporting/reports-view.tsx`

The existing `ConfirmDialog` implementation provides an established capture-and-restore focus precedent.

### Menu/select focus indicator

`packages/ui/src/lib/menu.ts` currently uses `focus:bg-surface-muted` as the focus indicator for menu/select items while removing the native outline.

The measured contrast between `--surface` and `--surface-muted` is approximately 1.10:1, below the 3:1 WCAG 2.4.11 focus-indicator threshold.

The repository already contains `.focus-ring-always`, whose documentation explicitly identifies select triggers and menu items as intended consumers. The implementation should inspect and use existing design-system conventions where appropriate.

Do not invent a new color/token or change an existing surface token merely to satisfy this story. If the correct visual treatment requires a design decision that cannot be established from existing repository conventions, document the decision/blocker instead of making an arbitrary visual change.

## Acceptance criteria

- [ ] Ticket detail inline edit restores keyboard focus to the appropriate persistent control after Escape.
- [ ] Ticket detail inline edit restores keyboard focus to the appropriate persistent control after Enter/save.
- [ ] Customer detail inline edit restores keyboard focus after Escape and Enter/save.
- [ ] Knowledge-base article detail inline edit restores keyboard focus after Escape and Enter/save.
- [ ] Existing edit-input `autoFocus` behavior remains unchanged.
- [ ] Reports "Save current view" restores focus to its persistent trigger after Save.
- [ ] Reports "Save current view" restores focus to its persistent trigger after Cancel.
- [ ] Menu/select item focus indicators meet the intended accessibility contrast requirement without arbitrarily changing existing design tokens.
- [ ] Existing focus-management conventions are reused where applicable.
- [ ] Tests cover the affected focus-restoration paths.
- [ ] Tests cover the menu/select focus-indicator invariant.
- [ ] No unrelated keyboard-accessibility behavior is changed.

## Attachments

None.

## Dependencies

- **Blocked by / related ids:** Story 165 — completed accessibility/loading thread.
- **Depends on code areas or other stories:** Existing `ConfirmDialog` focus capture/restore implementation; existing `.focus-ring-always` design-system convention.

## Extra notes

Read-only recon was completed at HEAD `042111a`.

Four real findings were identified:

1. Focus is lost when inline edit inputs are removed after Escape/Enter on ticket, customer, and knowledge-base detail pages.
2. Reports save-form Save/Cancel buttons remove themselves while focused.
3. Shared menu/select items use a 1.10:1 focus indicator.
4. Portal CSAT radiogroup lacks composite-widget keyboard behavior.

This story covers findings 1–3 only. Finding 4 is explicitly deferred because it is a separate ARIA composite-widget concern.

The recon also verified no current defects in:

- Keyboard reachability
- Tab order
- Focus traps
- Overlay focus restoration
- Native-control focus indicators
- Route-change focus

There are no existing source-level focus guards. Existing focus behavior is primarily covered by component tests in `packages/ui`.

## Technical hints

- **Repository root:** `.`
- **Primary language:** TypeScript
- **Existing focus restoration precedent:** `packages/ui/src/components/confirm-dialog.tsx`
- **Shared menu classes:** `packages/ui/src/lib/menu.ts`
- **Existing focus-ring convention:** `packages/ui/src/styles/tailwind-tokens.css`
- **Related UI primitives:**

  - `packages/ui/src/components/dropdown-menu.tsx`
  - `packages/ui/src/components/select.tsx`

### Known affected paths

#### Ticket detail

`apps/web/src/components/tickets/ticket-detail-view.tsx`

Inline edit:

- Entering edit mode focuses the input through `autoFocus`.
- Escape removes the input without restoring focus.
- Enter/save removes the input without restoring focus.

#### Customer detail

`apps/web/src/components/customers/customer-detail-view.tsx`

Same inline-edit focus-loss pattern as ticket detail.

#### Knowledge-base article detail

`apps/web/src/components/knowledge-base/article-detail-view.tsx`

Same inline-edit focus-loss pattern as ticket and customer detail.

#### Reports

`apps/web/src/components/reporting/reports-view.tsx`

The Save and Cancel buttons inside the conditional save form remove themselves when `showSaveForm` becomes false.

The persistent "Save current view" trigger is the natural restore target.

#### Shared menu/select focus

`packages/ui/src/lib/menu.ts`

`menuItemClassName` currently removes the native outline and uses `focus:bg-surface-muted`.

The existing `.focus-ring-always` convention should be evaluated before introducing any new visual treatment.

## Implementation constraints

- Reuse existing repository patterns.
- Do not introduce a new focus-management abstraction unless the existing pattern genuinely cannot support the affected cases.
- Preserve current mouse behavior.
- Preserve current edit-mode `autoFocus`.
- Preserve current routing behavior.
- Preserve current RBAC/permission behavior.
- Do not change API behavior.
- Do not change unrelated design tokens.
- Do not add a new color token solely to solve this story without an explicit design-system justification.
- Do not broaden the story into general keyboard accessibility cleanup.

## Out of scope

- Portal CSAT radiogroup keyboard behavior.
- Arrow-key behavior for the CSAT radiogroup.
- Roving tabindex for the CSAT radiogroup.
- Adding or adopting Radix `RadioGroup`.
- `Button isLoading` / disabled-focus behavior.
- Route-change focus management.
- New focus-management primitives.
- General keyboard-accessibility cleanup.
- Unrelated accessibility findings.
- Arbitrary changes to existing color/surface tokens.
- Visual redesign beyond the specific menu/select focus-indicator requirement.

## Verification expectations

The eventual implementation should verify:

- Existing web tests remain green.
- Existing portal tests remain green.
- Existing UI package tests remain green.
- Typecheck passes.
- Lint passes.
- Build passes.
- EN/AR parity remains unchanged.
- No unrelated keyboard or focus behavior regresses.
- The final diff is limited to the Story 166 scope.

No implementation, test, documentation, or design-token changes are implied by this intake file itself.
