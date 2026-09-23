# give-the-portal-csat-rating-the-aria-radio-group-keyboard-pattern — plan overview

Entry point for the **give-the-portal-csat-rating-the-aria-radio-group-keyboard-pattern** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
|-----|------|-------|------------|------------|
| 167 | [167-story-give-the-portal-csat-rating-the-aria-radio-group-keyboard-pattern.md](./167-story-give-the-portal-csat-rating-the-aria-radio-group-keyboard-pattern.md) | Give the portal CSAT rating the ARIA radio-group keyboard pattern | — | Story 129 (native-radio-over-primitive decision), Story 166 (preceding accessibility story, no code dependency) |

## Dependency notes

- **Single-story feature.** The last open finding from the read-only recon that produced [Story 166](../restore-focus-and-strengthen-menu-focus-indicators/00-overview.md); that story deferred it as a separate ARIA composite-widget concern, and this closes it.
- **Applies an existing decision rather than making a new one.** Story 129 recorded, in `apps/web/src/components/admin/branding-view.tsx`, that a small radio group uses native `<input type="radio">` instead of a new `RadioGroup` primitive. Re-verified against the current tree: `@radix-ui/react-radio-group` appears zero times in `pnpm-lock.yaml`, `apps/portal` has no direct Radix dependency, and `@crm/ui` exports no `RadioGroup`. No dependency is added and no shared primitive is introduced.
- **Blast radius is two files**, both under `apps/portal/src/components/tickets/`. Nothing in `packages/ui`, `apps/web` or `apps/api` is touched, so those suites are expected to be byte-for-byte unchanged.
- **One measured constraint the executor must respect.** Planning probed this repository's own jsdom + `user-event` v14 environment at HEAD `4c6ccc2`. One tab stop, arrow movement, wrapping, Space selection, click selection and `sr-only` focusability all behave as the browser does. **RTL arrow mirroring does not** — `{ArrowLeft}` moves backward under `dir="rtl"` just as it does under LTR, where a real browser moves forward. The plan therefore forbids an RTL arrow assertion and meets that acceptance criterion structurally instead, by pinning the native mechanism that delegates direction handling to the browser. The same reasoning is already recorded in `packages/ui/src/components/tabs.tsx`.
- **No i18n work.** `csatPrompt`, `csatRatingSelectLabel` and `csatRatingLabel` already exist in EN and AR, and each rating's accessible name remains its digit, so both catalogues stay byte-identical.
