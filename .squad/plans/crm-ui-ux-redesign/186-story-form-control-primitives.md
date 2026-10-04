# Story 186 — RD-1.9 Primitives B: form controls

**Objective:** perceivable, consistent form controls at the comfortable size, with a visible invalid state (`00-overview.md` RD-1.9).

**Current implementation:**
- Input, Textarea and the Select trigger each hand-wrote the same 36px `rounded-md border-rule-strong shadow-sm` string. That border is 1.48:1, under WCAG 1.4.11's 3:1 for a control boundary.
- Nothing reacted to `aria-invalid`, which `FormField` already sets.
- Checkbox used an arbitrary `rounded-[0.25rem]`; Checkbox and Select imported lucide directly.
- `FormField` had no required marker.

**Files:** `packages/ui/src/lib/control.ts` (new), `packages/ui/src/lib/icons.ts`, `packages/ui/src/components/{input,textarea,select,checkbox,form-field}.tsx`, specs (new `input.spec.tsx`; `form-field`, `select`, `textarea`).

**Approach:**
- `controlClassName`, shared by all three text controls: `rounded-control`, `border-rule-control` (3.51:1), a hover cue, and `aria-[invalid=true]:border-danger-solid`, with no shadow. Inputs and the Select trigger are 40px.
- `Input` gains `controlSize` (md 40 / sm 32), named so it doesn't clash with native `size`. It also gains an optional decorative `startIcon` and an `endSlot`; when either is used, the caller's `className` sizes the wrapper, and otherwise the input renders exactly as before.
- `Checkbox`: `rounded` + control border. Checkbox and Select icons now come from `icons.ts` (`CheckIcon`, `MinusIcon` added).
- `FormField`: `required` shows an aria-hidden asterisk and sets `aria-required`, deliberately not native `required`, so submit behaviour is unchanged. The error text gets a decorative icon.

**Acceptance criteria:**
- [x] `aria-invalid="true"` visibly changes the border (class asserted); the error text carries an icon.
- [x] FormField's existing ARIA tests stay green; `aria-required` without native validation (spec).
- [x] No raw lucide imports in Checkbox/Select.

**Verification:** ui 38 files / 395 · web 90 / 1414 · portal 48 / 430; typecheck + lint clean. Two specs follow the deliberate border token change (`border-rule-strong` → `border-rule-control`, same "token, not palette" intent). Visual: tickets, ticket, login, branding, portal tickets/login × 320/1280 × en/ar × light/dark — 48 shots, 0 overflow.

**Non-goals:** FormField adoption sweep (RD-7.1); combobox (RD-3.4).
