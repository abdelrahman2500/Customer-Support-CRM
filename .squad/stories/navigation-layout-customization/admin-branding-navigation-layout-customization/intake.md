**Source:** manual entry (tracker skipped via `--no-tracker`).

> Active tracker for this workspace: `github` — this story is not linked.

> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

- Folder: `.squad/stories/admin/admin-branding-navigation/intake.md`

- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.

- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Admin Branding & Navigation Layout Customization

- **Feature slug (folder under `plans/`):** `admin-branding-navigation`

## Tracker (metadata only)

- **Tracker type:** `github`

- **Work item id:** ``

- **Work item type:** ``

- **Status:** ``

- **Assignee:** ``

- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```text
Admin Branding & Navigation Layout Customization
```

---

## Description

```text
Add an Admin-configurable branding and navigation experience for the CRM.

The Admin should be able to configure the application's basic visual branding and choose the primary navigation presentation used by the Admin interface.

The navigation must support two layouts:

1. Sidebar navigation
2. Top Navbar navigation

The Admin should be able to switch between these layouts from an appropriate Admin settings screen without requiring code changes or redeployment.

The branding configuration should provide a clean, professional UI and establish a foundation for tenant/application branding. At minimum, the design should account for the application name/brand identity and visual presentation consistently across the Admin interface.

The selected navigation layout must be persisted and applied consistently after page navigation and browser refreshes.

The implementation should reuse existing navigation information architecture, permissions, localization, RTL behavior, responsive behavior, loading states, and existing UI primitives where appropriate rather than introducing a parallel navigation system.

The Sidebar and Navbar variants should both feel like intentional first-class designs rather than a simple CSS transformation of the same component.

The final Admin experience should remain visually coherent with the existing CRM design system and should work correctly in both supported locales/directions.

The story should also address responsive behavior:
- Desktop should provide a polished sidebar or navbar experience according to the selected setting.
- Mobile/tablet layouts should remain usable and should not create horizontal overflow or inaccessible navigation.
- Navigation should remain keyboard accessible.
- Active route state should remain clear in both navigation variants.
- Permission-based navigation visibility must continue to work exactly as it does today.

The implementation should avoid duplicating route definitions or permission logic between the two navigation variants. Navigation configuration/data should have a single source of truth, with the selected presentation determining how it is rendered.

If the existing architecture has an appropriate settings/configuration mechanism, extend it rather than creating a separate persistence mechanism unnecessarily.
```

---

## Acceptance criteria

```text
### Branding configuration

- [ ] Admin has a dedicated settings UI for configuring the application's branding.
- [ ] The branding settings use the existing Admin settings architecture where applicable.
- [ ] Branding configuration is persisted and survives page refreshes and new sessions according to the application's existing configuration/persistence model.
- [ ] The configured brand identity is reflected consistently in the Admin UI where branding is currently displayed.
- [ ] Branding UI has appropriate validation, loading, success, and error states.
- [ ] Branding configuration does not expose or require secrets.
- [ ] Existing default branding remains available when no custom branding has been configured.

### Navigation layout setting

- [ ] Admin can choose between:
      - Sidebar
      - Navbar
- [ ] The selected navigation layout is persisted.
- [ ] The selected layout remains active after browser refresh.
- [ ] Changing the setting does not require rebuilding or redeploying the application.
- [ ] The selected layout is applied consistently across Admin routes.
- [ ] The implementation does not duplicate the navigation route/permission definitions for each layout.

### Sidebar UX

- [ ] Sidebar navigation has a polished production-quality visual design.
- [ ] Sidebar clearly communicates the current/active route.
- [ ] Navigation groups and hierarchy remain understandable.
- [ ] Existing permission-based visibility is preserved.
- [ ] Sidebar supports the application's RTL direction correctly.
- [ ] Sidebar is keyboard accessible.
- [ ] Sidebar does not interfere with route loading/pending states.
- [ ] Sidebar behaves correctly on smaller screens, including an appropriate mobile navigation interaction.

### Navbar UX

- [ ] Navbar navigation has a polished production-quality visual design.
- [ ] Navbar clearly communicates the current/active route.
- [ ] Navigation groups and hierarchy remain understandable.
- [ ] Existing permission-based visibility is preserved.
- [ ] Navbar supports the application's RTL direction correctly.
- [ ] Navbar is keyboard accessible.
- [ ] Navbar remains usable when the number of navigation items is large.
- [ ] Navbar behaves correctly on smaller screens without horizontal overflow.

### Shared navigation behavior

- [ ] Both navigation variants use the same underlying route/navigation configuration.
- [ ] Both variants respect the same authorization and permission rules.
- [ ] Active-route behavior is consistent between Sidebar and Navbar.
- [ ] Localization works correctly in both variants.
- [ ] RTL/LTR behavior works correctly in both variants.
- [ ] Navigation remains accessible with keyboard navigation and appropriate ARIA semantics.
- [ ] Existing navigation overlay/loading behavior is not regressed.
- [ ] Route transitions do not produce React warnings or console errors caused by the navigation implementation.
- [ ] Switching navigation modes does not require a full application rebuild.
- [ ] Existing Admin routes remain reachable after the change.

### Visual quality

- [ ] The final Sidebar and Navbar designs are visually consistent with the CRM's existing UI language.
- [ ] Spacing, typography, icons, active states, hover states, focus states, borders, and surfaces are intentionally designed rather than relying on default browser styling.
- [ ] Light/dark appearance behavior remains consistent with the existing application.
- [ ] The navigation does not introduce visual regressions to the Admin content area.
- [ ] The layout works at common desktop, tablet, and mobile breakpoints.
- [ ] No unnecessary duplicated components, route definitions, or styling systems are introduced.

### Verification

- [ ] Existing relevant unit/component tests continue to pass.
- [ ] Relevant E2E coverage is added or updated for:
      - Admin changing navigation layout
      - Persisting the selected layout after refresh
      - Sidebar navigation
      - Navbar navigation
      - Permission-based navigation visibility
- [ ] Both supported locales are verified.
- [ ] Both LTR and RTL layouts are verified.
- [ ] `git diff --check` passes.
- [ ] No unrelated source, schema, or configuration changes are introduced.
```

---

## Attachments

| File (relative to this folder) | What it is              |
| ------------------------------ | ----------------------- |
| None                           | No attachments required |

---

## Dependencies

- **Blocked by / related ids:** None.

- **Depends on code areas or other stories:**

  - Existing Admin settings/configuration architecture.
  - Existing Admin navigation and WorkspaceNav information architecture.
  - Existing localization and RTL infrastructure.
  - Existing authentication/authorization and permission-based navigation visibility.
  - Existing responsive navigation behavior.
  - Existing navigation loading/pending/overlay implementation.
  - Existing UI primitives/design system.

---

## Extra notes (optional)

- The goal is not simply to expose a `sidebar/navbar` boolean. Both navigation modes should have a deliberate, polished UX.
- Preserve the current navigation information architecture and permission behavior.
- Prefer a single source of truth for navigation items and render it through separate presentation components when necessary.
- The setting should be Admin-controlled and persisted rather than being a per-user browser preference unless the existing architecture makes a different model more appropriate.
- Consider future extensibility for additional branding settings without overengineering this story.
- The planner should inspect the current navigation/settings architecture before deciding where persistence and rendering should live.
- Do not remove or weaken existing accessibility, localization, RTL, authorization, or responsive behavior.

## Technical hints (optional)

- Repo/root: `.`
- Primary language: `typescript`
- Frontend: Next.js App Router / React / TypeScript.
- Existing Admin navigation should be treated as the source of truth for route structure and permission visibility.
- Existing settings/configuration persistence should be reused where appropriate.
- Existing navigation components and the recent navigation/loading work should be inspected before implementation.
- Avoid introducing a second independent navigation configuration.
- Keep the implementation compatible with the existing web/portal architecture and do not change customer portal navigation unless explicitly required by the existing architecture.

## Out of scope

- Rebuilding the entire CRM design system.
- Redesigning every Admin page.
- Redesigning the customer portal navigation.
- Introducing a new authentication or authorization model.
- Changing existing roles or permissions.
- Adding new business domains or Admin features unrelated to branding/navigation.
- Building a complete white-label/multi-tenant branding platform.
- Adding arbitrary custom CSS/theme editing by Admin.
- Allowing Admins to inject custom JavaScript, HTML, or CSS.
- Replacing the existing localization system.
- Replacing the existing UI component library.
- Rewriting unrelated navigation/loading infrastructure unless required to safely support the new layout modes.

```

**ملاحظة مهمة:** أنا متعمد أكون واضح في الـ story إن **Sidebar وNavbar لازم يكونوا first-class UI**، مش مجرد `flex-direction` أو نقل نفس العناصر من مكان لمكان. وكمان خليت الـ planner هو اللي يفحص architecture الحالية ويقرر persistence المناسبة بدل ما نفرض عليه DB/schema جديد من البداية.
```
