> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/locale-aware-date-time-helper/locale-aware-date-time-helper/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Locale-aware date/time helper
- **Feature slug (folder under `plans/`):** `locale-aware-date-time-helper`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM UI/UX redesign roadmap item **RD-1.17**, global Story **194**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-ui-ux-redesign`, `phase-1-design-foundation`, `i18n`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Locale-aware date/time helper
```

---

## Description

```
Story 194 — RD-1.17 "Locale-aware date/time helper" of the CRM UI/UX
redesign track (roadmap: .squad/plans/crm-ui-ux-redesign/00-overview.md §6
"RD-1.17", component row "Date/time formatting"; recon RTL-02; decision D4
"Numerals in Arabic UI: keep current behaviour (Intl ar)"; QA-07).

GOAL
One date/time formatting helper over Intl with the active locale, adopted at
every inline toLocale*String call in both apps, with a guard spec so the
inline calls can't come back.

CONTEXT (verified at HEAD 6812ca2)
- No date helper exists; no relative-time formatting is used anywhere.
- 29 inline call sites: 23 web (incl. 2 in tickets/sla-indicator.tsx added
  by Story 192) and 6 portal. Forms used: toLocaleString(locale) (datetime),
  toLocaleDateString(locale) (date: customer related tickets, portal home and
  ticket list), toLocaleTimeString(locale, {hour:"2-digit",minute:"2-digit"})
  (both chat cards).
- 4 sites pass NO locale, so they follow the browser rather than the UI
  (recon RTL-02): web api-keys-view.tsx (~152), dashboard/tasks-panel.tsx
  (~128), webhook-subscriptions-view.tsx (~166, ~355). These components have
  no locale today; their specs mock next-intl's useTranslations only and do
  not mock next/navigation.
- Every other site reads the locale from useParams() (next/navigation).
- Timezone: no site passes timeZone; the runtime's zone applies. Unchanged.
- D4: keep current behaviour — whatever Intl gives "ar". (Observed: current
  Chromium/Node ICU format "ar" dates with Latin digits; D4's wording expected
  Arabic-Indic. Not changed here; reported.)
- Four specs vi.mock("@crm/ui") — all spread the real module.

REQUIRED OUTCOME
1. One pure helper (no i18n strings, no React): formatDateTime, formatDate,
   formatTime, formatRelative over Intl with an explicit locale; output
   identical to the toLocale*String form it replaces (en unchanged, ar per
   D4); invalid dates don't throw.
2. Adopt it at all 29 sites; the 4 locale-less sites get the active UI
   locale.
3. A guard spec: 0 inline toLocale*String( calls in either app's src.
```

---

## Acceptance criteria

```
- [ ] 0 inline `toLocale(Date|Time)?String(` calls in apps/web/src and
      apps/portal/src outside specs (guard spec).
- [ ] Output unchanged for en at every converted site (helper equivalence
      specs); ar follows Intl "ar" (D4, unchanged).
- [ ] The 4 locale-less sites now follow the UI locale (RTL-02).
- [ ] No timezone-model change; invalid dates do not throw.
- [ ] Helper specs; affected view specs green; web/portal tests, typecheck,
      lint, builds pass; EN/AR pages render dates with 0 overflow at 320px.
- [ ] No backend/API/database/auth/routing change.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** none. Roadmap: RD-1.17 depends on the §12 numeral decision (D4, approved).
- **Depends on code areas or other stories:** Story 192 (SlaIndicator's two date sites).

## Extra notes (optional)

- Downstream: RD-3.x ticket thread and RD-1.12 adoption can use `formatRelative`.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- Files: new `packages/ui/src/lib/format-date.ts` (+spec, index export), the 29 call sites, new `apps/web/src/test/inline-date-format.spec.ts`.

## Out of scope

- Timezone model, numbering-system change (D4), new date UI (pickers), any backend/API/database/auth/routing change.
