# restore-focus-and-strengthen-menu-focus-indicators — plan overview

Entry point for the **restore-focus-and-strengthen-menu-focus-indicators** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
|-----|------|-------|------------|------------|
| 166 | [166-story-restore-focus-and-strengthen-menu-focus-indicators.md](./166-story-restore-focus-and-strengthen-menu-focus-indicators.md) | Restore focus and strengthen menu focus indicators | — | Story 94 (`ConfirmDialog` focus precedent), Story S-1/DS-A (`.focus-ring-always`), Story S-3 (`packages/ui/src/lib/menu.ts`), Stories 156/159 (the three inline edit modes) |

## Dependency notes

- **Single-story feature.** Two defects from one read-only recon at HEAD `042111a`, both in the "keyboard focus the user can see and never loses" theme, shipped together: four controls that unmount themselves while focused, and one shared menu/select focus indicator measured at 1.10:1 against WCAG 2.4.11's 3:1 threshold.
- **No new shared contract.** The story deliberately introduces no focus-management hook or primitive. It follows `ConfirmDialog`'s existing hand-rolled `useRef` + explicit `.focus()` precedent inline in each of the four views, per the intake's own "do not introduce a new focus-management abstraction" constraint.
- **`packages/ui` blast radius is one constant.** Only `menuItemClassName` changes; `DropdownMenuItem` and `SelectItem` inherit the fix with no component edit, and `Popover` (which imports `menuContentClassName` only) is unaffected. `packages/config/tailwind-tokens.css` is not touched — `.focus-ring-always` already exists and already documents menu items as its intended consumer.
- **Deferred by the intake, not by this plan:** the portal CSAT radiogroup's composite-widget keyboard behaviour (recon finding 4) is a separate ARIA concern and is out of scope here. It remains available as a future story.
- Follows **Story 165** (`early-return-loading-accessibility`) in the accessibility thread; no code dependency on it.
