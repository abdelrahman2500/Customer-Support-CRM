# design-system-foundation — plan overview

Entry point for the **design-system-foundation** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
|-----|------|-------|------------|------------|
| 152 | [152-story-design-system-foundation.md](./152-story-design-system-foundation.md) | Design System Foundation — **already satisfied; no code change planned** | — | Stories 134, 135, 139, 142 (all complete) |

## Dependency notes

**This feature is already delivered.** The intake for Story 152 describes the repository as it stood before Stories 134, 135, 139 and 142. All six of its Description claims were checked against the tree at commit `ecbb6ba` and none holds:

| Claim | Reality |
|---|---|
| `Card` has "no meaningful consumers" | **65** usages across 39 files |
| Screens recreate `rounded-md border border-rule bg-surface p-4` | **0** occurrences; a guard test fails the build if one returns |
| `EmptyState` has "no current consumers" | **14** usages, plus `QueryStateCard` composes it |
| Portal "still renders raw red error containers" | **0**; Story 135 migrated 20 and added a guard |
| Patterns "implemented independently across web and portal" | One `@crm/ui` package, consumed by both |

The work this story asks for was done by:

- **Story 134** — semantic spacing/radius/elevation tokens (DS-A).
- **Story 135** (`f9276c6`) — [../portal-adopts-shared-ui-primitives/00-overview.md](../portal-adopts-shared-ui-primitives/00-overview.md) — 20 raw red error boxes → `Alert`.
- **Story 139** (`b54867e`) — [../adopt-shared-card-primitive/139-story-adopt-shared-card-primitive.md](../adopt-shared-card-primitive/139-story-adopt-shared-card-primitive.md) — 70 hand-rolled surfaces → `Card`.
- **Story 142** (`9fd85ab`) — [../adopt-empty-state/00-overview.md](../adopt-empty-state/00-overview.md) — `EmptyState` adoption.

Both foundations are enforced against regression by `apps/web/src/design-tokens.spec.ts` (Card surfaces) and `apps/portal/src/design-tokens.spec.ts` (Alert error boxes).

## Why no migration scope was produced

The intake requires the planner to "identify a bounded, representative migration scope and explain why each migration is **equivalent and safe**." Every remaining candidate was examined and **none is equivalent**:

- The 12 residual raw-surface containers are centred auth/error page shells (`rounded-lg`/`p-8`), a dropdown panel, a toast, and `bg-surface-sunk` inline notices. `Card` is `rounded-md`/`p-4`. Migrating them changes pixels. The web guard names all four categories as intentional exclusions.
- `Card`'s five sub-components have 0 consumers **by decision** — Story 139 chose `<Card className="p-surface">` to add no DOM node, and `CardTitle`'s `h3` conflicts with the `h2` convention (49 `h2` vs 3 `h3`).
- `QueryStateCard` renders no card surface **by decision**, documented in its own source.

Producing migration tasks anyway would mean fabricating equivalences the repository's own guards already document as false.

## Deliberately excluded

- Any change under `packages/ui/`, `apps/web/` or `apps/portal/`.
- Re-opening Story 139's `CardTitle` / sub-component decisions without new evidence.
- `FormField` and its seven call sites (Story 151, complete).
- Dark mode, new tokens, page redesigns, and every other item the intake lists as out of scope.
