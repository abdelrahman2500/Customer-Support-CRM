> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/authentication-v2/authentication-v2/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Authentication v2 (web + portal)
- **Feature slug (folder under `plans/`):** `authentication-v2`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM product redesign roadmap item **PR-2.2**, global Story **214**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-product-redesign`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Authentication v2 (web + portal)
```

---

## Description

```
Story 214 — PR-2.2 of the CRM product redesign (roadmap Phase 2;
visual-direction.md §6 "Login"; decision PD-7).

GOAL
The first screen of the product — for agents and for customers — looks and
behaves the same, carries the ink signature, renders Arabic in the right
face, and helps someone who forgot their password without pretending a
reset flow exists.

CONTEXT (main @ 5d75248)
- apps/web and apps/portal login pages are near-identical copies (Story
  168/175): a split screen with a form card and an accent-gradient brand
  panel (bright in dark mode — deferred from RD-1.4), NativeSelect +
  ThemeSwitcher, the session-expired banner, POST /auth/login or
  /portal/auth/login.
- No forgot/reset-password flow exists in the API (agents: admin reset;
  contacts: agent sets the portal password).
- Deferred RD-1.4 finding: Arabic glyphs on login render in a fallback
  face.
- Story 210/211: chrome tokens, recipes; Card raised = hairline (212).

REQUIRED OUTCOME
1. A shared @crm/ui AuthLayout (form first in the DOM with the only h1;
   ink-chrome brand panel with one brand wash, in both themes) used by
   both logins.
2. A password visibility toggle (PasswordInput + PasswordToggle in a new
   FormField `action` slot, outside the <label>, so the field is named
   "Password" alone).
3. PD-7: a "Forgot your password?" help hint per app, no link.
4. The Arabic face renders: :lang(ar) leads the font stack with Plex Sans
   Arabic.
5. Sign-in behaviour, requests and redirects unchanged.
```

---

## Acceptance criteria

```
- [ ] Existing login specs green unchanged; new cases (toggle, hint,
      chrome panel) in both apps; ui specs for AuthLayout/PasswordInput.
- [ ] The password field's accessible name is exactly "Password".
- [ ] Arabic login renders Plex Sans Arabic (harness check).
- [ ] Every Playwright spec green (sign-in selectors made exact).
- [ ] Harness 390/1280 × en/ar × light/dark for both logins, 0 overflow.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** none.
- **Depends on code areas or other stories:** Stories 168, 175, 181, 210–212.

## Extra notes (optional)

- The dark-mode brand panel is now the same ink panel (closes the RD-1.4 design-review note).

## Technical hints (optional)

- Files: `packages/ui/src/components/{auth-layout,password-input,form-field}.tsx` (+specs), `packages/ui/src/lib/icons.ts`, `packages/ui/src/index.ts`, `packages/config/tailwind-tokens.css`, both login pages (+specs, messages), `apps/web/src/test/token-contrast.spec.ts`, `apps/e2e/tests/*.spec.ts` (sign-in selectors).

## Out of scope

- A real reset flow, self-registration, branding on login (pre-auth branding stays out), any backend change.
