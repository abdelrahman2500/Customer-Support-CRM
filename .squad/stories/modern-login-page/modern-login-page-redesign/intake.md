# Story intake

## Feature

- **Feature name (display):** Modern login page redesign
- **Feature slug (folder under `plans/`):** `modern-login-page`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:**
- **Work item type:**
- **Status:**
- **Assignee:**
- **Labels:**

## Title

Modern login page redesign

## Description

Story 168 rebuilt both login screens onto the shared design system: a raised `Card` with an accent rail, `FormField` fields, a `text-title` heading and a pre-auth locale switcher, centred on a `bg-surface-sunk` page. That closed the design-system gap but left the composition a centred form on an empty page.

This story makes the login experience read like a polished modern SaaS/CRM product entry point: a full-screen split composition with a branded visual section introducing the product alongside the sign-in card.

### Current state

`apps/web/src/app/[locale]/(auth)/login/page.tsx` and `apps/portal/src/app/[locale]/(auth)/login/page.tsx`, lines ~124–192 in each: a single centred column, `max-w-sm`, on a flat sunk background. Roughly 60% of the viewport is empty at desktop widths, and nothing on the screen says what the product is beyond `common.appName`.

### Desired direction

- Full-screen modern layout.
- A branded visual section on a token-derived gradient with an abstract decorative treatment.
- Short product messaging: one headline plus one supporting line.
- Three concise product capabilities, each with an existing `@crm/ui` icon.
- The sign-in card keeps strong visual hierarchy and becomes the focal point of its column.
- Desktop: split layout. Mobile-first fallback: the visual section is dropped and the form takes the screen.
- Web and portal share the composition; their copy differs (agent-facing vs customer-facing).

## Acceptance criteria

1. Desktop (`lg` and up) renders a split layout: branded visual section on the logical start side, sign-in column on the logical end side.
2. Below `lg` the visual section is not rendered and the sign-in column fills the screen.
3. The visual section carries the product name, a headline, a supporting line and exactly three capabilities with icons.
4. The background uses a gradient built from existing colour tokens only — no raw hex, no arbitrary colour.
5. The sign-in card, its fields, its primary action and the locale switcher behave exactly as before.
6. `POST /auth/login` → `/{locale}/tickets` (web) and `POST /portal/auth/login` → `/{locale}/home` (portal) are unchanged, as are cookies, `setAccessToken` and both error paths.
7. Session-expired behaviour (`?reason=session-expired` → `Alert`) is unchanged.
8. EN and AR both render correctly; all new copy exists in both catalogues.
9. RTL mirrors correctly; no physical-direction utility is introduced.
10. No horizontal overflow at 320px, 834px or 1440px in either locale.
11. Exactly one `h1` per page; the visual section's headline does not compete with it.
12. No dark mode, no new dependency, no new design system, no new `@crm/ui` primitive.
13. Existing login tests pass, updated only where the new DOM legitimately requires it.

## Attachments

None.

## Dependencies

- **Blocked by / related ids:** None. Story 174 (`a21ab9d`) is complete and pushed.
- **Depends on code areas or other stories:**

  - `apps/web/src/app/[locale]/(auth)/login/page.tsx` + its spec.
  - `apps/portal/src/app/[locale]/(auth)/login/page.tsx` + its spec.
  - `apps/web/messages/{en,ar}.json`, `apps/portal/messages/{en,ar}.json` — new `auth.marketing.*` keys.
  - Story 168 — the current login composition this replaces.
  - Story 170/134 — the `text-title` type scale and spacing tokens.
  - Story 171 — the portal's `useNavigatingRouter`, kept.
  - `packages/ui` icons — `TicketsIcon`, `KnowledgeBaseIcon`, `ReportsIcon`, `NotificationsIcon`.

## Extra notes

- **New translation keys are expected here**, unlike Story 168 which deliberately avoided them. Product messaging and capability copy cannot be assembled from existing keys. Arabic must be real translation, not transliteration.
- The gradient must come from `accent`/`accent-hover` (already tokens). Opacity modifiers are legitimate — the token layer stores RGB channels specifically so `/nn` works.
- A gradient direction of `to-b` is preferred over a diagonal so the treatment is identical in both reading directions.

## Technical hints

- Current markup to replace: web lines ~124–192, portal lines ~124–191.
- Locale switcher, `handleSwitchLocale`, `handleSubmit` and all state must be carried over unchanged.
- `common.appName` is "Customer Support CRM" / "Customer Portal" and their Arabic equivalents — already present.
- Existing spec assertions to respect: single `h1` named `title`, `getByText("appName")`, locale-switcher combobox, `aria-busy` submit, no physical-direction classes.

## Out of scope

- Dark mode.
- Any auth, session, cookie, redirect or API change.
- Branding logo fallback / `onError`.
- The authenticated shells.
- New primitives, tokens or dependencies.
