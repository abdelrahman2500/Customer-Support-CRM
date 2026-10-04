> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/toast-v2/toast-v2/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Toast v2
- **Feature slug (folder under `plans/`):** `toast-v2`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM UI/UX redesign roadmap item **RD-1.13**, global Story **190**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-ui-ux-redesign`, `phase-1-design-foundation`, `packages/ui`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Toast v2
```

---

## Description

```
Story 190 — RD-1.13 "Toast v2" of the CRM UI/UX redesign track (roadmap:
.squad/plans/crm-ui-ux-redesign/00-overview.md §4.2 Toast row, §6
"RD-1.13"; audit: .squad/plans/crm-ui-ux-redesign/recon.md RS-01, A11Y-10).

GOAL
One toast treatment for the whole product: tones beyond "success", a
position that never overflows a 320px viewport, and a live region that
exists before the first toast so the first message is announced — applied
to the shared success toaster and to both apps' notification toasters.

CONTEXT (verified at HEAD 3c2fce2)
- packages/ui/src/components/success-toaster.tsx (SuccessToaster: props
  regionLabel/dismissLabel) + packages/ui/src/lib/toast-store.ts (zustand
  store; add(message), dismiss(id); 5s auto-dismiss; max 3;
  showSuccessToast(message)). Success-only styling (success-border /
  success-subtle). Returns null when empty, so the role=region and each
  item's role=status/aria-live are created together with the first toast —
  screen readers often miss a live region inserted with its content
  (recon A11Y-10).
- Position everywhere: `fixed … end-4 w-full max-w-sm` — at 320px, `w-full`
  (=100vw) plus a 1rem end inset pushes the toast 1rem past the start edge
  (recon RS-01). Same in:
  apps/web/src/components/notifications/notification-toaster.tsx (top,
  SLA/escalation notifications, role=region + per-item role=status,
  returns null when empty) and
  apps/portal/src/components/portal/notification-toaster.tsx (top,
  ticket-update / new-reply notifications, same structure).
- Cards are `rounded-md … shadow-md` (pre-design-language).
- App wrappers apps/web/src/components/ui/success-toaster.tsx and
  apps/portal/src/components/portal/success-toaster.tsx bind translated
  labels to SuccessToaster; `showSuccessToast(...)` call sites across about a dozen screens.
- Specs: packages/ui/src/components/success-toaster.spec.tsx and both apps'
  notification-toaster.spec.tsx each assert "renders nothing when there
  are no toasts/notifications" — the very behaviour A11Y-10 asks to change.

REQUIRED OUTCOME
1. Shared toast styling in @crm/ui (region + card class strings) used by
   SuccessToaster and both notification toasters: 320px-safe position
   (`inset-x-4`, from sm a 24rem column at the end edge), raised surface,
   surface radius, overlay elevation, subtle fade-in.
2. Tones: success | info | warning | error, each with its semantic border
   and a leading icon (never colour-only); the store accepts an optional
   tone; `showSuccessToast` unchanged; an additive `showToast(message,
   { tone })` helper. Error toasts are announced assertively (role=alert);
   others politely.
3. Always-mounted live region: the labelled region and its polite live
   container render even with no toasts (empty), so the first toast is
   announced. Same for both notification toasters.
4. SuccessToaster keeps its name and props (callers unchanged).
```

---

## Acceptance criteria

```
- [ ] No horizontal overflow at 320px with a toast or notification visible
      (both apps); from sm the stack is a 24rem column at the end edge.
- [ ] The labelled region and a polite live container exist before the first
      toast (spec); the first toast is inside an already-present live region.
- [ ] Tones success/info/warning/error render their semantic border + icon;
      error uses role=alert; showSuccessToast callers unchanged (spec).
- [ ] Both notification toasters use the shared region/card styling and the
      always-mounted region; their content, actions and translations are
      unchanged.
- [ ] Specs that asserted "renders nothing when empty" now assert an empty,
      labelled live region with no toast (the intentional A11Y-10 change).
- [ ] Token-only styling (style guard green); @crm/ui translation-free.
- [ ] EN/AR, RTL/LTR, light/dark: the stack sits at the reading-end edge.
- [ ] ui/web/portal tests, typecheck, lint pass; web and portal builds pass.
- [ ] No backend/API/database/auth/routing change; notification content
      unchanged (raw status text is RD-1.16).
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** none. Roadmap: RD-1.13 depends on RD-1.8.
- **Depends on code areas or other stories:** Story 185 (Alert/Badge tones, icons), Story 187 (raised surface, motion). Downstream: RD-1.16 fixes the portal toast's raw status text.

## Extra notes (optional)

- Notification message content and wording are out of scope (RD-1.16).
- Visual evidence with the track's Playwright harness (outside the repo), including a toast triggered at 320px.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- Files: `packages/ui/src/components/success-toaster.tsx` (+spec), `packages/ui/src/lib/toast-store.ts`, new `packages/ui/src/lib/toast.ts` (shared classes), `packages/ui/src/index.ts`, `apps/web/src/components/notifications/notification-toaster.tsx` (+spec), `apps/portal/src/components/portal/notification-toaster.tsx` (+spec).
- Verification: ui/web/portal tests, typecheck/lint, both builds, `git diff --check`.

## Out of scope

- Toast/notification wording, new notification types, persistence, sounds; any new dependency; backend, API, database, auth, routing or business-rule changes.
