/**
 * Story S-5 — the shared icon vocabulary.
 *
 * `lucide-react` was already a dependency of this package and was already
 * the de-facto choice (`Check`/`Minus` in `Checkbox`, `X` in `Dialog`,
 * `Check`/`ChevronDown`/`ChevronUp` in `Select`), but nothing named *which*
 * glyph means "delete" or "retry". The result was a split convention: the
 * S-3 `Dialog` closes with a real `X` icon while all three toaster dismiss
 * buttons used a `×` character, which is a multiplication sign that screen
 * readers may read aloud and that no font renders at a predictable weight.
 *
 * This module fixes the choice once, by role rather than by glyph name. A
 * caller imports the meaning — `DeleteIcon`, `RetryIcon` — so swapping the
 * underlying glyph later is a one-line change here instead of a search
 * across two applications. It is also the reason not to add a second icon
 * library: every role below already has a Lucide answer.
 *
 * ## Sizing
 *
 * `h-4 w-4` is the convention for an icon sitting inline with `text-sm`
 * body copy or inside a `h-9`/`h-10` control — that is what `Checkbox`,
 * `Dialog`, `Select` and `Spinner` already use, and matching it is what
 * keeps an icon optically centred against the 4px rhythm. Icons inherit
 * their colour from `currentColor`, so they take the surrounding text
 * token and need no colour class of their own.
 *
 * ## Decorative vs meaningful
 *
 * An icon that sits beside a text label is decorative and must carry
 * `aria-hidden` — the label already names the control. An icon that is the
 * *only* content of a control needs the control itself to carry an
 * `aria-label`; that is the pattern `Dialog`'s close button and
 * `SuccessToaster`'s dismiss button both follow.
 *
 * ## Direction
 *
 * `ChevronLeftIcon`/`ChevronRightIcon` are physical, not logical. A
 * previous/next affordance must not use them raw under RTL: either pick the
 * glyph from the document direction, or keep one glyph and flip it with
 * Tailwind's `rtl:rotate-180`. `ChevronDownIcon`/`ChevronUpIcon` are
 * direction-neutral and safe as-is, which is why `Select` uses them.
 */
export {
  // Data controls
  Search as SearchIcon,
  Filter as FilterIcon,
  ArrowUpDown as SortIcon,
  ArrowUp as SortAscIcon,
  ArrowDown as SortDescIcon,

  // Row and record actions
  Pencil as EditIcon,
  Trash2 as DeleteIcon,
  Plus as AddIcon,
  RefreshCw as RetryIcon,

  // Navigation
  ChevronDown as ChevronDownIcon,
  ChevronUp as ChevronUpIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  ExternalLink as ExternalLinkIcon,
  Menu as MenuIcon,
  X as CloseIcon,

  // Semantic states. These pair with the matching `Alert`/`Badge` variant
  // and the S-1 semantic token families of the same names.
  CircleCheckBig as SuccessIcon,
  TriangleAlert as WarningIcon,
  CircleAlert as ErrorIcon,
  Info as InfoIcon,
} from "lucide-react";

/** The shape every icon above satisfies, for a component that accepts one. */
export type { LucideIcon } from "lucide-react";
