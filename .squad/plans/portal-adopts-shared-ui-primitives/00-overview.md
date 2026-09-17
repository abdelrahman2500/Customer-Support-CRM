# portal-adopts-shared-ui-primitives — plan overview

Entry point for the **portal-adopts-shared-ui-primitives** feature (DS-B′). Stories execute in order by their `NN` prefix.

The portal has barely adopted the shared design system that `apps/web` runs on. It hand-rolls the same semantic states the `@crm/ui` primitives already express, so the two apps render *an error* — the same meaning — as two visibly different objects, and the portal's error box bypasses the `--danger-*` tokens that already exist. This feature closes that gap by swapping components, not by redesigning anything.

## Stories

| NN  | File | Title | Tracker id | Depends on |
|-----|------|-------|------------|------------|
| 135 | [135-story-portal-adopts-shared-ui-primitives.md](./135-story-portal-adopts-shared-ui-primitives.md) | Portal adopts the shared UI primitives — 20 raw-red error boxes across 10 files become `<Alert variant="destructive">` (4 of them with a `<Button variant="outline" size="sm">` retry), 3 raw `<textarea>` become `<Textarea>`, and `design-tokens.spec.ts` gains a focused guard against the raw-red pattern returning. No behaviour, copy, navigation, auth or realtime change. | 135 | Story 134 (`59a416b`) |

## Dependency notes

- **Depends on Story 134** ([../design-system-token-foundation/134-story-extend-the-design-token-layer-beyond-colour.md](../design-system-token-foundation/134-story-extend-the-design-token-layer-beyond-colour.md)) only as a sequencing predecessor. Story 135 deliberately does **not** adopt 134's spacing/radius/elevation tokens — swap the components first, spend the tokens in a later story, so each diff stays reviewable on its own terms.
- **Consumes `packages/ui` read-only.** `Alert`, `Textarea` and the `Table` family already exist and are exported. Their implementation is **not** to be modified. If a primitive's API genuinely cannot express an existing portal behaviour, the executor stops and reports rather than widening scope.
- **Resolves through the Story S-1 `--danger-*` token family** in `packages/config/tailwind-tokens.css`, via `Alert`'s `destructive` variant.
- **Extends the S-1 portal guard** `apps/portal/src/design-tokens.spec.ts` with a second, narrow assertion. The existing `FORBIDDEN` regex is not widened — the status families (amber/red/emerald) stay exempt from it for the reason that file's own doc comment gives.

## Scope corrections recorded during planning

Two claims in the intake were re-measured against the tree at `59a416b` and did not hold. Both are documented in the story file so a later reader does not mistake them for oversights:

1. **The raw `<table>` no longer exists.** `components/portal/notification-history-view.tsx` was already migrated to the shared `Table` primitives by PORTAL-2. The intake's `grep -rlE '<table'` matched only that file's own doc-comment prose. The Table item in Story 135 is therefore **verification-only**.
2. **The error box is 20 occurrences, not 10.** The intake counted files; the work is per occurrence. `chat-widget.tsx` alone carries 5 and `ticket-detail-view.tsx` 4. Four of the 20 are the retry-button variant, which also carries a nested `border-red-300`/`hover:bg-red-50` button that must go with it.

## Deliberately excluded

- **`portal-header.tsx`'s raw `<select>` language switcher** — investigated and excluded, not deferred. `apps/web`'s `workspace-header.tsx` renders the same controlled native `<select>` with the same `aria-label` and styling, so it is a deliberate cross-app pattern rather than portal-only drift. Migrating only the portal would *create* inconsistency, change the event contract (`onValueChange` vs `onChange`) and replace the OS-native picker. If both should become `Select`, that is a separate cross-app story after an explicit UX decision.
- **`ConfirmDialog`** — the portal has no destructive user action (verified: the only `delete` match in `apps/portal/src` is a JavaScript `Set.delete`).
- **`ticket-badges.ts` consolidation and toaster consolidation** — DS-E.
- **`QueryStateCard` / `EmptyState` migration** — DS-D.
- **`TableCell`'s `label` prop** on the existing notification table — adding it would change what renders below 640px, which is a behaviour change this story's non-goals forbid. Flagged as a DS-D/RM-10 follow-up.
