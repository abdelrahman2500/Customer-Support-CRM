# modern-login-page — plan overview

Entry point for the **modern-login-page** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
|-----|------|-------|------------|------------|
| 175 | [175-story-modern-login-page-redesign.md](./175-story-modern-login-page-redesign.md) | Modern login page redesign | — | Story 168 (the composition replaced), Story 171 (portal `useNavigatingRouter`, kept), Story 170/134 (type scale, spacing tokens), Story 174 (HEAD only) |

## Dependency notes

- **Single-story feature, both apps.** Story 168 put the login screens on the design system but left them a centred form on an empty page — roughly 60% of a desktop viewport was blank and nothing said what the product was. This makes them a full-screen split composition.
- **Authentication was not touched.** Lines 1–~140 of each page — imports, `LOCALES`, all state, `handleSwitchLocale`, `handleSubmit` and every prior Story's doc comment — are carried over verbatim. Only the `return` changed. Same endpoints, redirects, cookies, `setAccessToken`, error paths, session-expired `Alert`, initial focus and loading state.
- **DOM order is form-first; desktop order is flipped with `lg:order-last` on the form column.** That keeps the document outline correct — the form owns the page's single `h1`, and the panel's `h2` follows it — and keeps the keyboard on the form rather than tabbing through a panel with no controls. `order-*` is flex order, so the split mirrors under RTL with nothing to configure.
- **The panel is `hidden lg:flex`, not a shrunken mobile variant.** A marketing panel stacked above a login form is noise on a phone. It is real content, so it is not `aria-hidden`; below `lg` it is simply absent.
- **One design correction found during implementation.** The first pass printed `common.appName` twice — once above "Sign in", once in the panel — both visible simultaneously at desktop. The form column's copy is now `lg:hidden`, so the panel owns the product name from `lg` up and the form column is the only identity on a phone. An existing Story 168 test caught this (`getByText("appName")` found two nodes) and was updated accordingly — the one legitimate test change in this story.
- **Gradient and decoration are token-only.** `from-accent to-accent-hover` running `to-b` (vertical, so it is identical in both reading directions — no RTL asymmetry to correct), with two `aria-hidden` blurred blobs on `bg-accent-foreground/20` and `bg-accent-surface/20` positioned with logical `start-*`/`end-*` insets. No raw colour anywhere; the token layer stores RGB channels precisely so `/nn` works.
- **New translation keys were expected here**, unlike Story 168 which avoided them: product messaging and capability copy cannot be assembled from existing keys. `auth.marketing.*` added to all four catalogues with real Arabic, and both `login-messages.spec.ts` guards extended — including an EN ≠ AR assertion that catches an untranslated copy-paste.
- **Verified in a real browser across 12 combinations** (2 apps × EN/AR × 1440/834/320): no overflow anywhere, correct `dir`, panel shown only at `lg`+, exactly one `h1`, three capabilities, email focused. Story 174's authenticated 23-route × EN/AR 320px sweep still reports 23/23, so this story disturbed nothing behind the login.
