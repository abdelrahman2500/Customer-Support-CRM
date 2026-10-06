> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/accessibility-hardening/accessibility-hardening/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Accessibility hardening
- **Feature slug (folder under `plans/`):** `accessibility-hardening`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM product redesign roadmap item **PR-6.1**, global Story **232**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-product-redesign`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Accessibility hardening
```

---

## Description

```
Story 232 — PR-6.1 of the CRM product redesign (roadmap Phase 6).

GOAL
Audit every route of both apps and fix what the audit finds; close or
defer each recon A11Y-* finding with a reason.

REQUIRED OUTCOME
1. axe-core scan of every route (32 web + 8 portal + both logins) at
   1280 (en light, ar dark) and 390 (en dark, ar light): 0 critical/serious.
2. A keyboard walk of the main routes: every Tab stop named and visibly
   focused.
3. Fix: every page gets a document title (none had one — WCAG 2.4.2);
   conditionally rendered inline errors are announced (A11Y-07); the My
   Account sessions table's empty header is named; long webhook failure
   reasons no longer overflow a nowrap badge on a phone.
4. Guards so titles and announced errors stay.
```

---

## Acceptance criteria

```
- [ ] axe: 0 critical/serious on every route in both matrices.
- [ ] Keyboard walk clean.
- [ ] Every recon A11Y finding closed or deferred with a reason.
- [ ] web/portal tests, lint, typecheck, builds, Playwright.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Phases 3–5 (Stories 216–231).
- **Depends on code areas or other stories:** every route; `lib/page-title.ts` (new) in both apps.

## Extra notes (optional)

- The scan is a local harness (axe-core 4.13 injected with Playwright), not a CI gate.

## Technical hints (optional)

- `pageTitle(namespace, key)` returns a `generateMetadata`; the locale layout supplies `%s · <app name>`.

## Out of scope

- Screen-reader testing with a real assistive technology (manual; not available in this environment).
