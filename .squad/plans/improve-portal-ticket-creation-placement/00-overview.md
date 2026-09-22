# improve-portal-ticket-creation-placement — plan overview

| NN  | Title | Depends on |
|-----|-------|------------|
| 157 | Improve portal ticket creation placement | 154 (`SectionCard`) |

## Change

`CreateTicketForm` moved from after the list and its pager to before the list. Its card became a `SectionCard`, and its submit button took `Button size="lg"` — the size Story S-3 introduced for "a page's single primary action" and left unapplied everywhere.

## Why placement, not a dialog

The portal is deliberately simpler than the agent workspace. A dialog would add a mode, a trigger, focus management and a new interaction pattern to a two-field form. Moving one JSX block achieves the goal with no new pattern — which is what "least disruptive UX solution supported by the existing portal architecture" asks for.

## Deliberately excluded

- Any change to the form's fields, validation, submit payload, error handling or i18n.
- The portal's navigation, routing or any other screen.
- `size="lg"` anywhere else — it marks the single primary action, and spending it broadly would remove the distinction it creates.
