> **Source:** autonomous Next-Story Recon (no tracker), per `CLAUDE.md`.

# Story intake

## Feature

- **Feature name (display):** Administration — Branch Branding (Foundation)
- **Feature slug:** `admin-branch-branding`

## Description

```text
Recon after Story 61 (per the Feature Progress Audit) found "branding" as the only remaining
concrete, unblocked gap in the entire CRM: Notifications, Reporting, and SLA & Automation's v1
scopes are all now closed, and Channels/AI/Integrations remain externally blocked. Deliberately
scoped to config + in-form preview only — no live CSS-variable consumption in either frontend app's
shared layout, which the architecture's own risk log flags as hazardous (RTL/i18n regressions).
```

## Acceptance criteria

```text
- GET/PATCH /branding exist, gated by new branding:read/update permissions, branch-scoped.
- GET defaults to all-null when unconfigured (never 404); PATCH upserts any subset of
  logoUrl/primaryColor/secondaryColor.
- A new Agent Workspace "Branding" screen shows a form + a live, in-form-only preview.
- English and Arabic translations exist for every new string.
- Backend unit and e2e tests, and a frontend component test, cover the new surface.
- Every pre-existing test suite remains green, unweakened.
```

## Dependencies

- **Blocked by / related ids:** `audit-log-read-endpoint` Story 37 (the `admin` module this joins).

## Out of scope

- Live CSS-variable/logo consumption in either app's shared layout, "system configuration", logo
  file upload, per-department branding.
- Any README change.
