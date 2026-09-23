# portal-navigation-overlay-detection — plan overview

| NN  | Title                                                                         | Depends on                                        |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------------- |
| 171 | Rebuild the portal's navigation-overlay detection on the mechanism that works | Story 168 (which found and documented the defect) |

Written in the past tense, like [redesign-ticket-detail-workspace](../redesign-ticket-detail-workspace/00-overview.md): a mechanical port of an
implementation `apps/web` already designed, measured and shipped, so the
decisions this records were made there rather than here.

## The defect

`apps/portal`'s navigation overlay never appeared for any client-side
navigation, and its own test suite said it worked.

It detected navigation start by patching `window.history.pushState` and
`replaceState`. `apps/web` used to do the same and replaced it — that file's
doc comment records the measurement, taken in a real browser rather than in
tests: Next.js's App Router installs **its own** wrapper on those same two
methods, `window.history.pushState.toString()` in a running page shows Next's
minified function carrying none of our marker state, and whichever patch
"wins" is an implementation-order accident. In practice Next's wins, so our
wrapper never ran for any real `<Link>` or `router.push()` navigation.

The portal kept the abandoned mechanism. Story 168 hit this while redesigning
the login screens: it wanted `useNavigatingRouter` for the portal's submit
and found the hook could not exist there, because the portal's listener
exports no `notifyNavigationStart` to call. That story documented the finding
and deliberately deferred the fix as portal-wide infrastructure work rather
than bundling it into a Login change (CLAUDE.md §4). This is that work.

**The portal's unit tests could not have caught it.** They called
`window.history.pushState` directly, which exercises our patch in isolation
because jsdom has no Next.js runtime installing a competing one. Nineteen
tests passed for the entire time the feature was broken. They were right
about the code and wrong about the world — which is why the replacement suite
is the one `apps/web` wrote, and why none of it touches `history.pushState`.

## What changed

1. **`navigation-overlay-listener.tsx` was replaced** by `apps/web`'s
   implementation, byte-for-byte below its doc comment, so the two cannot
   drift again. Three mechanisms, none of them a patch over a global a
   framework also patches: a bubble-phase `document` click listener that acts
   only when `event.defaultPrevented` is already true (Next's own anchor
   handler sets it exactly when it takes over), an exported
   `notifyNavigationStart` for programmatic navigation, and the `popstate`
   _event_. Completion detection, the already-committed short-circuit, the
   microtask dispatch, the 150ms show-delay and the 10s failsafe are
   unchanged.
2. **`apps/portal/src/hooks/use-navigating-router.ts` was added**, mirroring
   `apps/web`'s: it wraps `push`/`replace` with `notifyNavigationStart` and
   passes `back`/`forward`/`refresh`/`prefetch` through untouched.
3. **All eight navigating files swapped their import** to
   `useNavigatingRouter as useRouter` — a one-line change each, no logic
   touched. Unlike `apps/web`, the portal has no `url-filters.ts`, so there
   is no same-pathname filter-sync `replace()` to exclude and the set is
   complete: login, chat widget, KB article list, change-password, the
   notification toaster, the portal header, the auth-recovery listener and
   the ticket list.
4. **Both specs came from `apps/web`** — the 19-test listener suite and the
   6-test hook suite — replacing the suite that tested the abandoned
   mechanism.
5. **Story 168's deferral note in the portal login page was corrected**; it
   now records that Story 171 removed the constraint.

## Deliberately NOT done

- **No change to `apps/web`.** Its suite is expected byte-for-byte unchanged,
  and was.
- **No change to `NavigationOverlay`** (`@crm/ui`) — the visual half was never
  the problem.
- **No behaviour change at any of the eight call sites.** Every destination,
  guard and error path is as it was; only the import moved.
- **No real-browser re-measurement of Next's patch.** The evidence is
  `apps/web`'s own recorded measurement, and Docker/the dev servers were not
  needed to act on it. What this story can and does prove under test is that
  the portal now detects navigation by the three mechanisms that do not
  depend on winning a patch race.
