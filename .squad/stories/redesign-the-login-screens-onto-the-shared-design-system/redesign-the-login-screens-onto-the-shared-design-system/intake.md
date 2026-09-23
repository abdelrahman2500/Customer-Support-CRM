# Story intake

## Feature

- **Feature name (display):** Login UI Redesign
- **Feature slug (folder under `plans/`):** `redesign-the-login-screens-onto-the-shared-design-system`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:**
- **Work item type:**
- **Status:**
- **Assignee:**
- **Labels:**

## Title

Redesign the Login screens onto the shared design system

## Description

Redesign the Web and Portal Login screens as the first polished screen of the CRM UI/UX redesign initiative.

The goal is not merely to replace raw Tailwind classes with existing primitives. The Login experience should receive a **distinctive, modern, polished CRM-quality UI** with strong visual hierarchy, clear branding presence using only assets/information already available to the frontend, excellent responsive behavior, and a consistent visual language between Web and Portal.

The redesign must preserve the existing authentication behavior and product contracts.

### Current state

Both Login pages are self-contained client components with nearly identical structure.

Current problems include:

- Hand-rolled login surface instead of the existing `Card` primitive.
- Hand-rolled form fields instead of `FormField`.
- Raw radius, shadow, spacing, and surface utilities instead of the established design-system tokens.
- Submit state uses disabled/text swapping instead of `Button isLoading`.
- Portal session-expired state uses a hand-rolled paragraph instead of `Alert`.
- Portal Login uses `useRouter` while Web uses `useNavigatingRouter`.
- No pre-auth locale switcher.
- Email input does not receive initial focus.
- The current page has minimal visual identity and hierarchy.
- The current layout is functional but visually generic and does not represent the intended redesigned CRM experience.
- Mobile spacing can be improved, especially at narrow viewport widths.

### Desired direction

The redesigned Login should feel like a deliberate, high-quality product entry point rather than a generic centered form.

The implementation should explore a visually distinctive composition while remaining consistent with the existing CRM design system.

The design should consider:

- Strong visual hierarchy.
- Clear product identity using existing frontend assets/content where available.
- Refined background/surface treatment.
- A visually intentional login panel rather than a generic default card.
- Better spacing and proportions.
- Appropriate use of elevation, borders, radius, and existing surface tokens.
- Clear primary-action emphasis.
- Strong input/form presentation.
- A polished loading state.
- Clear error and session-expired states.
- Responsive behavior from desktop through narrow mobile widths.
- EN and AR layouts.
- RTL correctness.
- Keyboard and focus behavior.
- Visual consistency between Web and Portal while allowing each application's identity/context to remain clear.

Do not create a marketing landing page. The result should remain recognizably a Login screen and should prioritize fast, clear authentication.

### Design-system direction

Prefer existing `@crm/ui` primitives and established tokens:

- `Card`
- `FormField`
- `Input`
- `Button`
- `Alert`
- existing typography
- existing surface tokens
- existing radius tokens
- existing elevation/shadow tokens
- existing spacing vocabulary
- existing focus styles

Do not create a new shared Login component or a new design-system primitive as part of this Story.

If an existing primitive cannot support a necessary visual treatment, document the limitation rather than introducing an unrelated abstraction.

### Branding constraint

Do not add a backend branding API, public branding endpoint, or authentication-independent branding infrastructure as part of this Story.

Use existing frontend assets, logos, product-name information, icons, or visual identity that are already safely available to the unauthenticated frontend.

If the repository does not contain an appropriate logo/asset, use typography, layout, surfaces, and existing visual primitives to establish identity rather than inventing a new backend dependency.

## Acceptance criteria

### Visual redesign

- [ ] Web Login receives a clearly redesigned, polished visual treatment rather than only a mechanical component migration.
- [ ] Portal Login receives the same redesigned visual language while preserving its application-specific authentication context.
- [ ] The final composition has intentional visual hierarchy for product identity, heading, form, primary action, and supporting states.
- [ ] The Login screen does not look like a generic default centered form.
- [ ] The visual treatment remains appropriate for a professional enterprise CRM.
- [ ] Existing design-system tokens are used for surfaces, borders, radius, elevation, spacing, and typography wherever applicable.
- [ ] No arbitrary color values or unrelated raw Tailwind design values are introduced.
- [ ] Existing `Card`, `FormField`, `Input`, `Button`, and `Alert` primitives are reused where applicable.
- [ ] The visual design does not require a new shared Login component or new UI primitive.

### Form experience

- [ ] Both email and password fields use the existing `FormField` treatment appropriate for Login.
- [ ] Email receives initial focus when the page loads.
- [ ] Focus indicators remain clearly visible.
- [ ] Submit uses `Button isLoading`.
- [ ] Loading state has clear visual feedback and preserves the existing pending-navigation behavior.
- [ ] Existing native validation behavior is preserved.
- [ ] Existing form submission behavior is preserved.

### Authentication behavior

- [ ] Web continues using `POST /auth/login`.
- [ ] Portal continues using `POST /portal/auth/login`.
- [ ] Web continues redirecting to the existing tickets destination.
- [ ] Portal continues redirecting to the existing home destination.
- [ ] Existing cookies/session behavior is unchanged.
- [ ] Existing error handling remains functionally equivalent.
- [ ] Existing session-expired behavior remains intact.
- [ ] No authentication, authorization, token, or API behavior is changed.

### Cross-app consistency

- [ ] Portal session-expired messaging uses the existing `Alert` primitive consistently with Web.
- [ ] Portal Login uses the same navigation-feedback behavior as Web where appropriate.
- [ ] Web and Portal share the same visual language without forcing application-specific authentication behavior into a shared component.
- [ ] The two screens remain understandable as separate application entry points.

### Locale and RTL

- [ ] A pre-auth locale switcher is available on both Login screens.
- [ ] The locale switcher reuses existing translation keys.
- [ ] No new translation keys are required unless a concrete implementation need is discovered and documented.
- [ ] English layout is visually coherent.
- [ ] Arabic layout is visually coherent.
- [ ] RTL layout does not depend on physical-direction utilities.
- [ ] Arabic text does not break the intended composition.
- [ ] Locale switching works without requiring manual URL editing.

### Responsive behavior

- [ ] Desktop layout is visually balanced and intentionally composed.
- [ ] Tablet widths remain usable without awkward compression.
- [ ] Narrow mobile widths do not suffer from excessive nested padding.
- [ ] The form remains comfortably usable around 320px viewport width.
- [ ] No horizontal overflow is introduced.
- [ ] Visual hierarchy remains intact on mobile.
- [ ] Decorative/secondary visual elements, if used, degrade gracefully on small screens.

### Accessibility and keyboard behavior

- [ ] Existing semantic heading structure is preserved or improved.
- [ ] Form labels remain programmatically associated.
- [ ] Error announcements remain appropriate.
- [ ] Session-expired messaging remains announced.
- [ ] Keyboard navigation remains fully usable.
- [ ] Focus indicators remain visible against the redesigned surfaces.
- [ ] No decorative element interferes with keyboard or screen-reader interaction.
- [ ] No broad accessibility refactor is introduced as part of this Story.

### Testing

- [ ] Existing Web Login tests continue to pass.
- [ ] Existing Portal Login tests continue to pass.
- [ ] Tests are updated when DOM changes require assertion updates; behavior must remain covered.
- [ ] Tests cover any newly introduced interactive behavior such as locale switching.
- [ ] Tests cover the loading, error, and session-expired states that are affected by the redesign.
- [ ] EN/AR behavior is verified.
- [ ] Typecheck passes.
- [ ] Lint passes.
- [ ] Build passes.
- [ ] No unrelated application tests regress.

## Attachments

None.

## Dependencies

- **Blocked by / related ids:** Story 167 — completed.
- **Depends on code areas or other stories:**

  - `apps/web/src/app/[locale]/(auth)/login/page.tsx`
  - `apps/web/src/app/[locale]/(auth)/login/page.spec.tsx`
  - `apps/portal/src/app/[locale]/(auth)/login/page.tsx`
  - `apps/portal/src/app/[locale]/(auth)/login/page.spec.tsx`
  - `packages/ui`
  - Existing Story 134 design-system token vocabulary.

## Extra notes

This is the first Story of the actual CRM UI/UX redesign initiative.

The objective is to establish a strong visual quality bar for subsequent screens. The implementation should therefore prioritize **intentional UI composition and polish**, not merely mechanical replacement of existing classes.

However, the Story must remain bounded to Login. Do not redesign application shells, dashboards, navigation, ticket screens, customer screens, or other routes as part of this work.

The redesign should be opinionated enough to visibly improve the product, while remaining grounded in the existing design system.

Do not add a password-visibility toggle in this Story unless the implementation plan identifies it as necessary to the intended design and explicitly calls out the additional i18n/test scope. Prefer leaving it out.

Do not introduce arbitrary new colors, gradients, illustrations, or external assets solely to make the page look more impressive. Any visual treatment must fit the established CRM design language.

## Technical hints

- Repo root: `.`
- Primary language: `typescript`
- Web Login:

  - `apps/web/src/app/[locale]/(auth)/login/page.tsx`
  - `apps/web/src/app/[locale]/(auth)/login/page.spec.tsx`

- Portal Login:

  - `apps/portal/src/app/[locale]/(auth)/login/page.tsx`
  - `apps/portal/src/app/[locale]/(auth)/login/page.spec.tsx`

- Shared UI:

  - `packages/ui`

- Design-token vocabulary established by Story 134.
- Existing `Card`, `FormField`, `Button`, `Alert`, and `Input` should be evaluated before considering any new abstraction.
- Portal and Web are separate applications and should remain separate route implementations.
- Root locale layouts already provide typography and `dir`.

## Out of scope

- Backend changes.
- New public branding APIs.
- Changes to authentication endpoints.
- Changes to payloads.
- Changes to cookies or token/session architecture.
- Changes to redirect destinations.
- SSO.
- MFA.
- Remember-me.
- Password reset / forgot-password flow.
- Rate-limit UX.
- New authentication features.
- New shared Login component.
- New `@crm/ui` primitive.
- New design-system package.
- Redesign of Web/Portal application shells.
- Dashboard redesign.
- Ticket/customer/knowledge-base/reporting redesign.
- General accessibility cleanup.
- General responsive audit outside Login.
- Header redesign.
- Post-auth locale switcher redesign.
- New translation system or broad i18n refactor.
- Backend-driven branding.
- Marketing landing page.
- External images/assets introduced solely for decoration.
- Dark-mode implementation.
- Password visibility toggle unless explicitly added to the approved plan.
- Unrelated refactors.
