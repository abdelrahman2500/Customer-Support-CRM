> **Source:** manual entry (tracker skipped via `--no-tracker`).
>
> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/admin-branch-branding-live-consumption/admin-branch-branding-live-consumption/intake.md`

---

## Feature

- **Feature name (display):** Administration
- **Feature slug (folder under `plans/`):** `admin-branch-branding-live-consumption`

## Title

```text
Story 82 — Branding — Live Logo/Color Consumption
```

## Description

```text
Story 62 shipped BrandingConfig and an admin-only preview form but
explicitly deferred live consumption elsewhere in the app. This story
closes that gap: a new portal-facing GET /portal/branding endpoint, and
both apps' persistent headers (WorkspaceNav, PortalHeader) rendering a
configured branch logo in place of the plain app-name text, plus the
branch's primaryColor applied to the header's own border via a CSS
custom property with a literal Tailwind fallback. Every currently
unconfigured branch renders identically to today.
```

## Acceptance criteria

```text
- [ ] BrandingService.getBrandingForBranch(branchId) exists and is used
      by both the existing agent-facing GET /branding and a new
      GET /portal/branding.
- [ ] GET /portal/branding exists, @PortalRoute()-gated, read-only,
      returns the caller's own branch's branding (or all-null defaults).
- [ ] WorkspaceNav and PortalHeader both render a configured logo in
      place of the plain app-name text.
- [ ] Both headers apply the branch's primaryColor to their own border
      via a CSS variable + Tailwind arbitrary value with a literal
      fallback, never a hardcoded override.
- [ ] Every currently-unconfigured branch renders a pixel-identical
      header to before this story.
- [ ] No ml-/mr-/left-/right- class introduced anywhere; no change to
      either app's [locale]/layout.tsx (the dir/lang RTL root).
- [ ] Backend and frontend tests cover the new behavior.
- [ ] Typecheck, lint, build, and the relevant test suites pass.
```

## Dependencies

- Story 62 — Administration — Branch Branding (Foundation)
- Story 44 — Agent Workspace Navigation Menu (`WorkspaceNav`)
- Story 52 — Customer Portal Authentication Foundation (`PortalHeader`)
- Story 24 — In-App Notification Delivery (`BranchNotifications`, the
  "one branch-wide consumer wired into the authenticated layout"
  precedent)

All prerequisites are complete; the story is fully unblocked.

## Out of scope

- Any change to `[locale]/layout.tsx` in either app (the `dir`/`lang`
  RTL root).
- A full theming system recoloring every button/accent — only the
  persistent header's own border + logo.
- Realtime push of a branding change to an already-signed-in session.
- Any change to BrandingService's existing agent-facing GET/PATCH
  /branding behavior.
