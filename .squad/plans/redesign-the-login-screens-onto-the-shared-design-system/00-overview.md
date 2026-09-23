# redesign-the-login-screens-onto-the-shared-design-system — plan overview

Entry point for the **redesign-the-login-screens-onto-the-shared-design-system** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
|-----|------|-------|------------|------------|
| 168 | [168-story-redesign-the-login-screens-onto-the-shared-design-system.md](./168-story-redesign-the-login-screens-onto-the-shared-design-system.md) | Redesign the Login screens onto the shared design system | — | Story 134 (token + type-scale vocabulary), Story 141/151 (`FormField`), Story S-3/139 (`Card`, `Button isLoading`, `size="lg"`), Story 95 (`?reason=session-expired`), Story 119 (`languageSwitcher` keys), Story 167 (preceding story, no code dependency) |

## Dependency notes

- **Single-story feature, and the first screen of the CRM UI/UX redesign initiative.** It sets the quality bar for later screens, so its decisions are recorded as decisions (Design decisions 1–7 in the story file), not left implicit in a diff.
- **Spends vocabulary that already exists; adds none.** Story 134 defined `--space-*`, `--radius-*`, `--elevation-*` and a seven-step `fontSize` scale and deliberately applied none of them. Re-measured at HEAD `38b7ab5`: the `fontSize` scale (`caption`…`title`) still has **zero** consumers across `apps/web/src`, `apps/portal/src` and `packages/ui/src`, and `Button`'s `size="lg"` — introduced in Story S-3 explicitly for "a login submit" — has **one** consumer, in `apps/portal`'s ticket list. This story is the first adoption of both. No token is added, renamed or revalued.
- **Blast radius is four production files** — the two `login/page.tsx` and their two specs — plus two new message-catalogue guard specs. Nothing in `packages/ui`, `packages/config`, `apps/api` or any other route is touched, so `@crm/ui`'s suite is expected byte-for-byte unchanged (baseline **268**).
- **No i18n work.** All eleven keys the redesigned screen reads already exist in both locales in both apps, including `common.appName` (`"Customer Support CRM"` / `"Customer Portal"`), which is what supplies each application's identity with no new key, no logo asset and no branding endpoint — the intake's explicit branding constraint.
- **One measured fact the executor must not re-litigate.** `FormField` renders its label as a direct text child of the `<label>` and keeps the control inside it, so `screen.getByText("email").querySelector("input")` — the idiom all 16 existing login tests use — still resolves after the migration. Verified directly against the real component in this repository's jsdom environment at HEAD `38b7ab5`. The plan still switches those queries to `getByLabelText`, but as an improvement Story 151 made possible, **not** as a repair; no existing test may be weakened or deleted to make this story pass.
- **Two limitations are documented rather than fixed**, per CLAUDE.md §4:
  - `Button`'s `isLoading` renders its label inside `<span className="invisible">`, which a real browser excludes from the accessible-name computation — so the submit button would be unnamed for the whole pending window. jsdom cannot observe this (Tailwind CSS is never loaded there), so the plan names the button locally with `aria-label` and asserts it by attribute. Fixing the primitive would touch all 13 `isLoading` call sites and is out of scope.
  - `apps/portal` has no `useNavigatingRouter`, because its navigation-overlay listener exports no `notifyNavigationStart` — it still patches `history.pushState`/`replaceState`, the mechanism `apps/web`'s own listener documents as measured non-functional (Next's App Router installs a competing wrapper on the same methods). Porting that redesign into the portal is portal-wide infrastructure work, not a Login change. The navigation feedback this screen actually shows — the submit button held pending past `push` — is identical in both apps and is preserved.
