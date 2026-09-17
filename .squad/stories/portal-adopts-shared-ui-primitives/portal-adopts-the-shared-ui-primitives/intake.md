> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked. 
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/portal-adopts-shared-ui-primitives/portal-adopts-the-shared-ui-primitives/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Portal adopts the shared UI primitives (DS-B′)
- **Feature slug (folder under `plans/`):** `portal-adopts-shared-ui-primitives`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `135` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story` — design-system adoption
- **Status:** `Planned`
- **Assignee:** `(unassigned)`
- **Labels:** `design-system`, `portal`, `primitive-adoption`, `no-behaviour-change`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
Portal adopts the shared UI primitives
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
Story 135 — Portal adopts the shared UI primitives (DS-B').

Approved from the post-Story-134 UI/UX reconnaissance at commit 59a416b.

GOAL

Bring the portal's existing error/form/table UI onto the already-
established shared UI primitives, WITHOUT changing portal behaviour,
copy, navigation, authentication, realtime behaviour, or introducing new
product flows.

This is a PRIMITIVE-ADOPTION story, not a redesign.

THE GAP, MEASURED AT 59a416b

The portal has barely adopted the shared design system. Files rendering
each primitive (non-spec), web vs portal:

  Alert            35  vs   1
  ConfirmDialog    18  vs   0
  Select           17  vs   0
  Table            17  vs   1
  Checkbox          9  vs   0
  QueryStateCard    5  vs   0
  Badge            28  vs   3
  SortIndicator     2  vs   0

Instead the portal hand-rolls the same semantic states. The two apps
therefore render an error — the same meaning — as two visibly different
objects, and the portal's error box bypasses the --danger-* tokens that
already exist, surviving the token guard only because status families
(amber/red/emerald) are explicitly exempt from it.

TARGET INVENTORY — VERIFIED AT 59a416b, NOT ASSUMED

Every count below was re-measured against the current tree:

  10 files with the raw-red error box
     "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm
      text-red-700"
     1  app/[locale]/(auth)/login/page.tsx
     2  components/chat/chat-widget.tsx
     3  components/knowledge-base/article-detail-view.tsx
     4  components/knowledge-base/article-list-view.tsx
     5  components/portal/notification-history-view.tsx
     6  components/portal/notification-preferences-section.tsx
     7  components/tickets/ticket-attachments-card.tsx
     8  components/tickets/ticket-chat-card.tsx
     9  components/tickets/ticket-detail-view.tsx
    10  components/tickets/ticket-list-view.tsx

  3 files with a raw <textarea>
     1  components/chat/chat-widget.tsx
     2  components/tickets/ticket-chat-card.tsx
     3  components/tickets/ticket-detail-view.tsx

  1 file with a raw <table>
     1  components/portal/notification-history-view.tsx

Note that notification-history-view.tsx appears twice (error box AND
table), and chat-widget.tsx / ticket-chat-card.tsx / ticket-detail-view.tsx
each appear twice (error box AND textarea). Distinct files touched: 10.

  A raw <select> also exists in components/portal/portal-header.tsx. It is
  DELIBERATELY EXCLUDED from this story — see "Investigated and excluded"
  below for the full rationale. portal-header.tsx must not be modified.
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```
ERROR BOXES -> <Alert variant="destructive">
- [ ] All 10 identified files use the shared Alert. Preserved exactly:
      the existing error TEXT, the conditional branches that decide when
      it renders, loading/error behaviour, session-expiry behaviour, and
      any accessibility semantics already present.
- [ ] Zero occurrences of "border-red-200 bg-red-50" remain in
      apps/portal/src.

TEXTAREAS -> <Textarea>
- [ ] All 3 identified files use the shared Textarea. Preserved:
      controlled/uncontrolled behaviour, value/onChange handlers, labels,
      validation, disabled/readOnly, rows/minLength/maxLength and
      equivalent supported props, and existing test selectors.

TABLE -> <Table> primitives
- [ ] The identified file uses Table/TableHeader/TableBody/TableRow/
      TableHead/TableCell (the primitive's actual exported API),
      preserving semantic table structure, headers, rows/cells,
      sorting/accessibility behaviour, responsive behaviour and existing
      selectors.

GUARD
- [ ] apps/portal/src/design-tokens.spec.ts gains a focused assertion
      preventing reintroduction of the raw-red error-box class pattern.
- [ ] That assertion is proven to FAIL when the pattern is reintroduced,
      then reverted. A guard that cannot fail is not a guard.

NON-REGRESSION (load-bearing)
- [ ] No web application file changed.
- [ ] components/portal/portal-header.tsx is NOT modified, and its raw
      <select> language switcher is left exactly as it is.
- [ ] No shared primitive implementation changed. If a primitive's API
      genuinely cannot express an existing behaviour, STOP and report it
      rather than widening scope.
- [ ] No error COPY changed anywhere.
- [ ] No new dependency added.
- [ ] Before/after inventory recorded, proving each targeted occurrence
      migrated and no untargeted portal file touched.
- [ ] Portal typecheck / lint / build green; portal test suite green.
- [ ] Session-expiry E2E green; live-chat E2E green.
- [ ] Portal token guard green; RTL physical-direction check still clean.
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

None.

---

## Dependencies

- **Blocked by / related ids:** None. Story 134 (`59a416b`) is complete;
  nothing blocks this story.
- **Depends on code areas or other stories:**
  - **Story 134** — extended the token layer beyond colour. This story
    deliberately does NOT adopt those tokens (see Out of scope): swap the
    components first, spend the tokens in a later story, so each diff stays
    reviewable on its own terms.
  - **`packages/ui`** — `Alert`, `Textarea`, and the
    `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`
    family. All already exist, are exported, and are covered by
    `packages/ui/src/components/*.spec.tsx` (25 files / 207 tests at
    `59a416b`). **Their implementation is not to be modified.**
  - **Story S-1 / DS-1b** — the `--danger-*` token family the migrated
    Alerts will resolve through, already defined in
    `packages/config/tailwind-tokens.css`.
  - **`apps/portal/src/design-tokens.spec.ts`** — the guard this story
    extends (it currently exempts the status families, which is why the
    raw-red pattern survived).

## Extra notes (optional)

- Recommended as the next single bounded story by the post-134 recon,
  ahead of the originally-proposed "DS-B adopt unused primitives",
  because the fresh evidence showed the portal's non-adoption is a larger
  and more user-visible gap than six unused components — and it is the
  same work, concentrated in one app.
- Value here is user-visible: the portal currently shows errors in a
  different visual language from the agent workspace.
- Sequencing rationale, so a later reader does not think these were
  forgotten: `ConfirmDialog` is NOT introduced because the portal has no
  destructive user action (verified — the only `delete` match in
  `apps/portal/src` is a JavaScript `Set.delete`); `ticket-badges.ts`
  consolidation and toaster consolidation are DS-E; `QueryStateCard`/
  `EmptyState` migration is DS-D.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- `apps/web` is the reference implementation: it uses `<Alert>` in 35
  files. Match how it composes them rather than inventing a portal style.
- The `Table` primitive's real exported API, verified at `59a416b`:
  `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`,
  `TableCell`. `TableCell` takes a `label` prop — that is the RM-10
  responsive card-stack mechanism (133 usages across the repo), and the
  migrated portal table should use it so it stays responsive.
- Several targeted files are touched twice (error box AND textarea/table).
  Migrating per-file rather than per-pattern will produce a smaller,
  more reviewable diff.
- Establish the before/after inventory with the same greps used to build
  this intake, so the counts are comparable:
    grep -rlE 'border-red-200 bg-red-50' apps/portal/src --include=*.tsx
    grep -rlE '<textarea' apps/portal/src --include=*.tsx
    grep -rlE '<table'    apps/portal/src --include=*.tsx

## Out of scope

- What this story explicitly does **not** cover:
  - **No web application changes.**
  - **No Story 134 token adoption** (`p-surface`, `rounded-surface`,
    `shadow-resting`, …). Swap components now, spend tokens later.
  - **No component-library redesign.**
  - **No changes to shared primitive implementation** unless absolutely
    required by an existing API limitation — and if one is discovered,
    **STOP and report it** rather than expanding scope.
  - **No portal shell/navigation redesign.**
  - **No `<select>` / language-switcher migration.** Investigated and
    deliberately excluded — see "Investigated and excluded" below.
    `portal-header.tsx` and `workspace-header.tsx` are both untouched.
  - **No `ConfirmDialog` introduction** — the portal has no destructive
    user action (verified at `59a416b`).
  - **No `ticket-badges.ts` consolidation** (DS-E).
  - **No toaster consolidation** (DS-E).
  - **No `QueryStateCard` / `EmptyState` migration** (DS-D).
  - **No dark mode.**
  - **No reporting/chart changes.**
  - **No auth or permission changes.**
  - **No realtime architecture changes.**
  - **No changes to error copy.**
  - **No changes to route structure.**
  - **No changes to Story 129 navigation architecture.**
  - **No new dependency.**

---

## Critical risks

### 1. Session-expiry login flow

`app/[locale]/(auth)/login/page.tsx` is one of the 10 error-box files.
`apps/e2e/tests/session-expiry-and-refresh.spec.ts` pins the exact text:

    Your session has expired. Please sign in again.

The migration must preserve that string and the branch that renders it
(`searchParams.get("reason") === "session-expired"`) exactly. Note that
this particular block is rendered by `<Alert>` already in the web app's
equivalent — check whether the portal's login page uses the raw-red box
for this branch or for its own submit-error branch before touching it.

### 2. Realtime ticket/chat

`components/tickets/ticket-chat-card.tsx` is in scope for BOTH an error
box and a textarea. Do not alter realtime merge/state behaviour. Preserve:

    <ol aria-label="Live Chat">

and the existing sender-label behaviour —
`apps/e2e/tests/agent-customer-live-chat.spec.ts` asserts on both, and on
the composer being reachable via `getByLabel("Type a message...")`.

### 3. Semantic status styling

Do not touch `apps/portal/src/lib/ticket-badges.ts`.

---

## Investigated and excluded — the raw `<select>` language switcher

**DECIDED: out of scope. Not conditional, not deferred within this story.**

An earlier draft of this story listed "replace the 1 identified raw
`<select>`" as scope item 3. Investigation at `59a416b` established that
it is not a portal design-system adoption gap, and it has been removed.

**What it actually is.** The single raw `<select>` in `apps/portal/src` is
the **language switcher** in `components/portal/portal-header.tsx`
(~line 225): a controlled native select with
`aria-label={t("languageSwitcher.label")}`, `value={locale}`, and
`onChange` calling `handleSwitchLocale`.

**Why it is excluded:**

1. **It is the portal language switcher**, not an error/form/table surface
   of the kind this story exists to normalise.
2. **`apps/web` uses the same implementation.**
   `components/workspace/workspace-header.tsx` (~line 231) renders the
   same controlled native `<select>`, with the same `aria-label`, the
   same `border-rule-strong bg-surface` styling and the same `onChange`
   shape.
3. **It is therefore a deliberate cross-app pattern, not portal-only
   design-system drift** — the premise of every other item in this story.
4. **Migrating only the portal would create cross-app inconsistency** — a
   Radix listbox in the portal against a native select in the workspace —
   which is the opposite of this story's goal.
5. **It would alter the current event contract and native picker UX.**
   Radix `Select` reports `onValueChange(value)` rather than
   `onChange(event)`, and replaces the OS-native picker with a custom
   listbox — a real regression on small screens, where the native wheel
   is better.
6. **It sits in the shell header**, which this story's own non-goals
   already exclude ("No portal shell/navigation redesign").

**If both switchers should become `Select`, that is a separate cross-app
story**, taken after an explicit design/UX decision, so the two apps stay
consistent with each other.

**Binding constraint for the implementer:** do not modify
`apps/portal/src/components/portal/portal-header.tsx` for this purpose,
do not modify `apps/web/src/components/workspace/workspace-header.tsx`,
and do not change the locale-switcher implementation, its event contract,
or its native picker behaviour.

---

## Open questions — resolve before implementation

### 1. `notification-history-view.tsx` is touched twice

It carries both an error box and the raw `<table>`. Migrate it once, as a
single coherent change, rather than in two passes.
