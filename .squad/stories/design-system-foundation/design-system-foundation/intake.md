# Story 152 — Design System Foundation

## Feature

- **Feature name (display):** Design System Foundation
- **Feature slug (folder under `plans/`):** `design-system-foundation`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:**
- **Work item type:** Story
- **Status:**
- **Assignee:**
- **Labels:**

## Title

```text
Design System Foundation
```

## Description

```text
Establish a consistent UI foundation for the CRM by standardizing the shared Card, EmptyState, QueryStateCard, and Alert/state patterns before the application screens are redesigned.

The current UI already has semantic design tokens and several shared primitives, but their adoption is inconsistent:

- The shared Card primitive exists but currently has no meaningful consumers.
- Many screens recreate card surfaces with raw combinations such as rounded-md border border-rule bg-surface p-4 and related variants.
- EmptyState exists but has no current consumers.
- QueryStateCard is used only in a small number of places.
- Portal has a shared Alert primitive but multiple screens still render raw red error containers.
- Similar state/surface patterns are implemented independently across web and portal.

This story should turn those existing primitives into a reliable foundation for the upcoming UI/UX redesign.

The implementation must favor reuse of existing primitives and semantic tokens rather than introducing another visual system.

The story is intentionally foundation-focused. It should standardize the reusable building blocks and migrate a bounded set of clearly equivalent existing usages where the migration is mechanical and low-risk. It must not redesign complete application screens in this story.

The result should make future screen-level redesigns faster and more consistent across the web application and portal.
```

## Acceptance criteria

```text
### Card foundation

- [ ] The existing shared Card primitive is reviewed and its API is sufficient for the current CRM use cases.
- [ ] Card-related primitives used by the project are standardized around the existing shared Card implementation rather than introducing a competing card abstraction.
- [ ] Clearly equivalent raw card/surface containers are migrated to the shared Card primitive within the bounded scope identified during planning.
- [ ] Existing semantic design tokens remain the source of truth for Card surfaces, borders, text, spacing, and states.
- [ ] No hard-coded color system is introduced.
- [ ] RTL-safe logical utilities remain intact.

### Empty and query states

- [ ] The existing EmptyState primitive is reviewed and brought into a reusable, production-ready shape for current CRM empty-state use cases.
- [ ] Existing QueryStateCard usage is reviewed for consistency with the EmptyState and Card patterns.
- [ ] Clearly equivalent existing empty/loading/error state implementations are migrated to the shared primitives where the migration is mechanical and within the approved scope.
- [ ] Empty, loading, and error states use a consistent visual structure and spacing.
- [ ] Existing retry/action behavior is preserved.
- [ ] Existing data-fetching and business logic is not changed.

### Alert and error states

- [ ] The existing shared Alert primitive is reviewed.
- [ ] Clearly equivalent raw error/status containers are migrated to the shared Alert pattern within the approved scope.
- [ ] Error semantics, messages, actions, and accessibility behavior are preserved.
- [ ] No business logic or error-handling behavior is changed merely to perform the UI migration.

### Cross-application consistency

- [ ] Web and Portal use the same shared primitives and semantic tokens wherever the underlying UI pattern is equivalent.
- [ ] No duplicated replacement primitive is introduced separately for web and portal.
- [ ] Existing responsive behavior is preserved unless a change is explicitly required by the shared primitive itself.
- [ ] Existing Arabic/English behavior remains unchanged.
- [ ] Existing RTL logical-property conventions remain unchanged.

### Regression safety

- [ ] Existing component APIs remain backward compatible unless a breaking change is explicitly justified in the approved plan.
- [ ] Existing loading, empty, error, and card content remains functionally identical after migration.
- [ ] No API, backend, database, routing, authentication, authorization, or business-rule changes are introduced.
- [ ] Story 151's FormField implementation and all seven FormField call sites remain untouched.
- [ ] Existing automated tests are updated only where required by intentional shared-component changes.
- [ ] Relevant UI, Web, and Portal test suites remain green.
- [ ] Typecheck, lint, and build remain green.

### Scope discipline

- [ ] The final implementation scope is limited to the shared design-system primitives plus the bounded set of mechanical consumer migrations approved by the plan.
- [ ] Complete page redesigns are not included.
- [ ] Dashboard, ticket-detail, customer-detail, navigation-shell, and mobile redesigns are separate follow-up work.
- [ ] No dark-mode implementation is introduced as part of this story.
- [ ] No new spacing/color token system is introduced.
```

## Attachments

| File (relative to this folder) | What it is                     |
| ------------------------------ | ------------------------------ |
| None                           | No binary attachments required |

## Dependencies

- **Blocked by / related ids:** Story 151 — FormField accessibility foundation is complete.
- **Depends on code areas or other stories:**

  - `packages/ui/src/components/`
  - `packages/ui/src/index.ts`
  - `apps/web/src/components/`
  - `apps/portal/src/components/`
  - Existing semantic design-token definitions
  - Existing Card, EmptyState, QueryStateCard, and Alert primitives

## Extra notes

- This is the first story of the broader UI/UX transformation.
- The repository already has a semantic-token foundation and RTL logical-property conventions. Preserve them rather than replacing them.
- The purpose of this story is to establish reusable visual/state primitives before redesigning individual CRM screens.
- Do not attempt to migrate every raw container in the repository automatically. The planner must identify a bounded, representative migration scope and explain why each migration is equivalent and safe.
- Prefer a small number of high-value, representative migrations over a large mechanical rewrite.
- If an existing primitive is insufficient, improve the primitive itself rather than creating a parallel component.
- Visual redesign of individual screens will happen in later stories after this foundation is stable.

## Technical hints

- Repository root: `.`
- Primary language: TypeScript
- Monorepo: pnpm/Turborepo
- UI stack: Next.js App Router, React, Tailwind, shared UI package
- Existing semantic design tokens must remain the source of truth.
- Existing RTL-safe logical utilities must remain the standard.
- Relevant existing primitives include:

  - `Card`
  - `EmptyState`
  - `QueryStateCard`
  - `Alert`

- The planner should inspect actual current implementations and consumers before deciding which files are safe to migrate.
- Search for raw card/surface patterns and raw error/empty/loading containers rather than assuming every visually similar container is equivalent.
- Preserve existing component APIs where practical.
- Do not introduce client-side permission gating as part of this UI work.

## Out of scope

- Full redesign of individual application pages.
- Ticket-detail redesign.
- Customer-detail redesign.
- Dashboard/report redesign.
- Navigation/sidebar/header redesign.
- Mobile UX redesign/pass.
- Dark mode.
- New backend/API/Prisma/database work.
- Authentication or authorization changes.
- Validation/business-rule changes.
- New i18n keys unless an existing primitive change absolutely requires one and the approved plan explicitly identifies it.
- Changes to `FormField` or its seven existing call sites; Story 151 is complete.
- Accessibility work unrelated to these shared primitives.
- The four locale-unaware date sites identified during the previous UI audit.
- Replacing the existing semantic token system.
- Introducing a second Card, Alert, EmptyState, or QueryState abstraction.
- Blind repository-wide search-and-replace of raw Tailwind containers.
- Unbounded visual cleanup of unrelated components.
