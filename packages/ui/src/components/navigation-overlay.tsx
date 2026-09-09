import { cn } from "../lib/cn";
import { overlayClassName } from "../lib/overlay";
import { Spinner } from "./spinner";

export interface NavigationOverlayProps {
  /** A client-side route transition is in flight. Nothing renders (beyond
   * the always-present status region below) when false. */
  visible: boolean;
  /** Already-translated text for the busy announcement, e.g. "Loading…" —
   * this package has no i18n dependency of its own (see `src/index.ts`'s
   * own doc comment), so every caller passes its own translated string. */
  label: string;
}

/**
 * UX audit — global route-navigation overlay.
 *
 * Deliberately separate from `RouteLoadingSkeleton` (`./skeleton.tsx`):
 * that one is `loading.tsx`'s per-segment Suspense fallback, shaped like the
 * page it replaces; this one is a full-viewport backdrop + centred spinner
 * that appears the instant *any* client-side navigation starts (see each
 * app's own `navigation-overlay-listener.tsx`, which detects that moment)
 * and disappears once the destination has actually committed — both can be
 * on screen at once during a transition, by design, rather than being one
 * merged mechanism.
 *
 * Reuses `overlayClassName` (`../lib/overlay` — the same scrim `Dialog`/
 * `AlertDialog` already use) rather than a second backdrop colour, and
 * `Spinner` rather than a second spinning-indicator implementation.
 *
 * `role="status"`/`aria-live="polite"` on the outer, always-mounted wrapper
 * (mirrors `FetchingIndicator`'s exact convention) rather than on `Spinner`
 * itself — a labelled `Spinner` would add a *second*, nested `status` role
 * announcing the same thing. The label itself is `sr-only`: the visual
 * design calls for a subtle backdrop and a bare spinner, not a paragraph of
 * "Loading…" text across the middle of the screen, but the busy state is
 * still announced to assistive technology exactly the same either way.
 * `aria-busy` toggles on that same wrapper, always present, so its value is
 * meaningful whether or not the backdrop itself is currently rendered.
 */
export function NavigationOverlay({ visible, label }: NavigationOverlayProps) {
  return (
    <div role="status" aria-live="polite" aria-busy={visible}>
      {visible && (
        <div className={cn(overlayClassName, "flex items-center justify-center")}>
          <Spinner className="h-8 w-8 text-ink-muted" />
          <span className="sr-only">{label}</span>
        </div>
      )}
    </div>
  );
}
