# Story 152 — Design System Foundation

> **Planner's verdict: this story is already satisfied. No code change is planned, and none should be made.**
>
> The intake describes the repository as it stood **before** Stories 134, 135, 139 and 142. Every premise in its Description was checked against the current tree and none holds. The evidence is in `## Premise verification` below, measured at commit `ecbb6ba`. Read that section before doing anything else.
>
> Executing a migration story here would either reverse a documented decision or make a change the repository's own guard tests already forbid. The correct outcome is to **close this story as already-delivered**, or to re-scope it against the residue recorded in `## What is genuinely left`.

---

## Prerequisites

- **Story 134 completed** — the semantic spacing/radius/elevation token foundation (DS-A).
- **Story 135 completed** (`f9276c6`) — [../portal-adopts-shared-ui-primitives/00-overview.md](../portal-adopts-shared-ui-primitives/00-overview.md). Migrated the portal's 20 raw red error boxes to `Alert` and added the portal's guard against the pattern returning.
- **Story 139 completed** (`b54867e`) — [../adopt-shared-card-primitive/139-story-adopt-shared-card-primitive.md](../adopt-shared-card-primitive/139-story-adopt-shared-card-primitive.md). Migrated the hand-rolled surface string (70 occurrences) to `Card` across both apps.
- **Story 142 completed** (`9fd85ab`) — [../adopt-empty-state/00-overview.md](../adopt-empty-state/00-overview.md). `EmptyState` adoption across the agent workspace.
- **Story 151 completed** — `FormField` accessibility. Its seven call sites are **out of scope here**, as the intake requires.

---

## Story Goal

The intake's goal — "turn those existing primitives into a reliable foundation" — was the goal of Stories 134/135/139/142, and they achieved it. This story's remaining job is therefore **verification, not migration**:

1. Confirm the foundation is in place and enforced (done below, by measurement).
2. Record why the residual raw containers are **not** migration candidates, so a future reader does not re-open this.
3. Change no code.

**Explicitly not in scope:** any migration of the 12 remaining raw-surface containers, any change to `Card`'s sub-components, any `Card` wrapper added to `QueryStateCard`. Each is addressed with evidence in `## What is genuinely left`.

---

## Context — Read These Files First

1. `apps/web/src/design-tokens.spec.ts` — **lines 85–118**. The guard that already enforces this story's Card criterion. Its own doc comment (**lines 85–95**) states: *"`packages/ui`'s `Card` has existed since Story S-3 but had zero adoption, while this literal surface string was written out 70 times across the two apps. **Every true content surface now renders through `Card`**."* **Lines 91–94** name the deliberate exclusions verbatim: *"the centred auth/error page shells (`rounded-lg … p-8 shadow-sm`), the toast, the dropdown panel, and the `bg-surface-sunk` inline notices. **None of those is a content card.**"* The matcher is `HAND_ROLLED_SURFACE` at **line 96**.
2. `apps/portal/src/design-tokens.spec.ts` — **lines 92–110**. The guard that already enforces this story's Alert criterion: `RAW_ERROR_BOX` at **line 106** and `it("renders errors through the shared Alert, not a hand-rolled red box")` at **line 108**. **Lines 102–105** record `ticket-chat-card.tsx`'s `text-red-700` as a deliberate, documented exemption (a delivery-status label, not an error box).
3. [../adopt-shared-card-primitive/139-story-adopt-shared-card-primitive.md](../adopt-shared-card-primitive/139-story-adopt-shared-card-primitive.md) — **line 43** (`### 2 — CardTitle is not used`) and **line 45**: *"`CardTitle` renders `<h3>`. 37 of the migrated surfaces currently open with `<h2>`, and `portal-home-view.spec.tsx` asserts `level: 2`. Switching would regress the document outline and break tests."* **Line 41** records that `CardHeader`/`CardContent`/`CardFooter` are *deliberately* kept available for later header/footer composition. These are decisions, not oversights.
4. `packages/ui/src/components/query-state-card.tsx` — **lines 125–188**. Note it composes `Alert`, `Button`, `EmptyState` and `SkeletonText` (imports at **lines 3–7**) and reuses `EmptyStateProps` verbatim (**lines 93–94**). Note also that it renders **no** card surface, deliberately — see the comment at **lines 168–169**: *"With no background error there is still no wrapper, no extra element, nothing between the caller and its own markup."*
5. `packages/ui/src/components/card.tsx` — **line 76–78**, `CardTitle`'s `h3`. Read only to confirm the element; **do not change it** (see item 3).
6. `packages/ui/src/components/empty-state.tsx` — **lines 30–85**. Already production-shaped: typed props, icon slot, `title`/`description`/`action`, `className` merge.

---

## Premise verification

Every Description claim, checked at commit `ecbb6ba`. Commands are reproducible; counts exclude `.spec.` files.

| # | Intake claim | Measured reality | Verdict |
|---|---|---|---|
| 1 | "The shared Card primitive exists but currently **has no meaningful consumers**." | **65** `<Card` usages across **39** files. | **False** |
| 2 | "Many screens recreate card surfaces with raw combinations such as `rounded-md border border-rule bg-surface p-4`." | **0** occurrences of that string. A guard test (`apps/web/src/design-tokens.spec.ts:96`) fails the build if one returns. | **False** |
| 3 | "**EmptyState exists but has no current consumers.**" | **14** `<EmptyState` usages, plus `QueryStateCard` composes it internally. | **False** |
| 4 | "QueryStateCard is used only in a small number of places." | **6** usages. Literally true, but it is a deliberate wrapper for the loading/error/empty ladder, not a surface every screen needs. | **Misleading** |
| 5 | "Portal has a shared Alert primitive but **multiple screens still render raw red error containers**." | **0** raw red error containers. Story 135 migrated 20; `apps/portal/src/design-tokens.spec.ts:108` guards the pattern. The only two `*-red-*` hits repo-wide are a delivery-status label and a toast border, both documented exemptions. | **False** |
| 6 | "Similar state/surface patterns are implemented independently across web and portal." | Both apps import the same primitives from `@crm/ui`. No duplicate implementation exists. | **False** |

Reproduce:

```bash
grep -rn "<Card"          apps/web/src apps/portal/src --include=*.tsx | grep -v '\.spec\.' | wc -l   # 65
grep -rn "<EmptyState"    apps/web/src apps/portal/src --include=*.tsx | grep -v '\.spec\.' | wc -l   # 14
grep -rn "<QueryStateCard" apps/web/src apps/portal/src --include=*.tsx | grep -v '\.spec\.' | wc -l  # 6
grep -rn "rounded-md border border-rule bg-surface p-4" apps/web/src apps/portal/src --include=*.tsx  # (none)
grep -rnE "bg-red-|text-red-|border-red-" apps/web/src apps/portal/src --include=*.tsx | grep -v '\.spec\.' | wc -l  # 2
```

### Acceptance criteria already met, and by what

| Intake AC group | Satisfied by | Enforced by |
|---|---|---|
| Card foundation | Story 139 (`b54867e`) — 70 surfaces migrated; `Card` tokenised (`rounded-surface`, `bg-surface`, `shadow-resting`) and given `asChild`. | `apps/web/src/design-tokens.spec.ts:98` |
| Empty and query states | Story 142 (`9fd85ab`); `QueryStateCard` composes `EmptyState` + `Alert` + `SkeletonText`. | `packages/ui` suite (242 tests) |
| Alert and error states | Story 135 (`f9276c6`) — 20 raw red boxes → `Alert`. | `apps/portal/src/design-tokens.spec.ts:108` |
| Cross-application consistency | Single `@crm/ui` package; both apps consume it. | Both `design-tokens.spec.ts` guards |
| Tokens / RTL / no hard-coded colour | Story 134 (DS-A) + S-1 token work. | Both guards, incl. the zero-physical-direction-utility rule |

---

## What is genuinely left

Three candidates were examined. **All three are documented deliberate decisions. None should be actioned by this story.**

### 1 — The 12 residual raw-surface containers are not cards

8 centred auth/error/not-found page shells (`rounded-lg … p-8 shadow-sm`), 1 dropdown panel (`ticket-detail-view.tsx:812`, `absolute … z-10 … py-1 shadow-md`), 2 `bg-surface-sunk` inline notices, 1 toast (`notification-toaster.tsx:70`).

None matches `Card`'s geometry: `Card` is `rounded-surface` (= `rounded-md`, 0.375rem) with callers supplying `p-surface` (= `p-4`). The shells are `rounded-lg` + `p-8`. Migrating them would be a **visual change**, not a mechanical equivalence — which the intake itself forbids ("explain why each migration is equivalent and safe"). The web guard names all four categories as intentional exclusions.

### 2 — `Card`'s five sub-components have 0 consumers, and that is deliberate

`CardHeader`, `CardContent`, `CardFooter`, `CardTitle`, `CardDescription` — each **0** usages. Story 139 chose `<Card className="p-surface">` over `<Card><CardContent>` to add no DOM node at 56 sites (`.closest()` selectors and existing tests depend on this), and kept the sub-components available for later composition.

`CardTitle` renders `h3` while the apps use `h2` **49** times against `h3` **3** times. Changing it to `h2`, or deleting it, would reverse Story 139's recorded decision and — per that plan's line 45 — break `portal-home-view.spec.tsx`'s `level: 2` assertion. **No new evidence justifies re-opening it.**

### 3 — `QueryStateCard` renders no card surface, and that is deliberate

Despite its name it wraps nothing on the success path. Adding a `Card` would change the DOM and visuals at all 6 call sites — a redesign, which this story explicitly excludes.

**If a future story wants any of these**, it needs its own evidence and its own plan. This one does not supply either.

---

## Implementation tasks

**No frontend changes required. No backend changes required. No changes to `packages/ui`, `apps/web`, or `apps/portal`.**

The foundation this story asks for exists, is adopted, and is guarded. The only action is the decision recorded in `## Done Criteria`.

---

## Edge Cases & Failure Modes

- **An executor takes the intake literally and migrates the 8 page shells to `Card`.** Trigger: reading the Description without the measurements above. Result: a visual regression (`rounded-lg`/`p-8` → `rounded-md`/`p-4`) on login, error and not-found in **both** apps. Prevented by `## What is genuinely left` § 1.
- **An executor "fixes" `CardTitle` to `h2`.** Trigger: treating 0 consumers as neglect. Result: reverses Story 139 § 2; `portal-home-view.spec.tsx`'s `level: 2` assertion is the tripwire. Prevented by § 2.
- **An executor deletes the unused `Card` sub-components.** They are public exports of `packages/ui` (`packages/ui/src/index.ts`). Removal is a breaking package-API change with no internal consumer to justify it, and contradicts Story 139 line 41.
- **An executor wraps `QueryStateCard` in a `Card`.** Changes DOM at 6 call sites; contradicts the component's own documented "no wrapper" contract at `query-state-card.tsx:168–169`.
- **The two remaining `*-red-*` hits are mistaken for violations.** `ticket-chat-card.tsx:91` (`text-red-700`, delivery status) is exempted by name in `apps/portal/src/design-tokens.spec.ts:102–105`; `notification-toaster.tsx:105` (`border-red-200`) is a toast border. Neither is an error container, and both guards pass today.
- **Uncertainty to surface:** the intake's Description does not match any commit in this repository's history since `ecbb6ba`. Whether it was drafted against an older checkout or another branch is **unknown** and cannot be determined from the repository. Resolve with the author before re-scoping.

---

## Test Plan

**No new tests.** The behaviour this story would have introduced is already covered:

1. `apps/web/src/design-tokens.spec.ts` — `it("renders content surfaces through the shared Card, not a hand-rolled string")` (**line 98**). Already fails the build on a regression.
2. `apps/portal/src/design-tokens.spec.ts` — `it("renders errors through the shared Alert, not a hand-rolled red box")` (**line 108**). Same.
3. `packages/ui/src/components/empty-state.spec.tsx`, `query-state-card.spec.tsx`, `card.spec.tsx`, `alert.spec.tsx` — the primitives' own unit coverage, part of the 242-test `@crm/ui` suite.

Adding tests for a change that is not being made would be noise.

---

## Verification Steps

Run these to confirm the foundation is intact — they are a **status check**, not a post-change regression run.

1. **Guards:** from the repo root, `pnpm --filter @crm/web test -- design-tokens` and `pnpm --filter @crm/portal test -- design-tokens`. Both must pass, proving the Card and Alert foundations are still enforced.
2. **Primitives:** `pnpm --filter @crm/ui test`. Baseline **242 passed**.
3. **Consumers:** `pnpm --filter @crm/web test` (**1178**) and `pnpm --filter @crm/portal test` (**354**).
4. **Regression:** `pnpm typecheck`, `pnpm lint` (0 problems), `pnpm build`.
5. **Diff:** `git status --short` must show **no** change under `packages/` or `apps/`. If it shows any, this story was mis-executed.

---

## Done Criteria

- [ ] The `## Premise verification` table has been read and its commands re-run, confirming all six Description claims are false or misleading at the current commit.
- [ ] No file under `packages/ui/`, `apps/web/` or `apps/portal/` is modified by this story.
- [ ] Story 151's `FormField` and its seven call sites are untouched.
- [ ] The three residual candidates in `## What is genuinely left` are confirmed as deliberate decisions, not actioned.
- [ ] Both `design-tokens.spec.ts` guards pass, demonstrating the Card and Alert foundations are enforced.
- [ ] A decision is recorded: **close Story 152 as already-delivered**, or re-scope it with new evidence that does not contradict Stories 135/139/142.

**STOP HERE. Report to the user and wait for confirmation — this story requires a scoping decision, not an implementation.**
