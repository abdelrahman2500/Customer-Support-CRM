# Story 204 — Combobox primitive and assignee picker

> CRM UI/UX redesign roadmap item **RD-3.4**. Intake: [`../../stories/combobox-and-assignee-picker/combobox-and-assignee-picker/intake.md`](../../stories/combobox-and-assignee-picker/combobox-and-assignee-picker/intake.md). Roadmap: [`../crm-ui-ux-redesign/00-overview.md`](../crm-ui-ux-redesign/00-overview.md) Phase 3 "RD-3.4"; recon TW-08.

---

## Prerequisites

- **Story 203** (`f8dff90`, RD-3.3): the inspector's Properties section.
- **Story 202** (`7bf7f29`): the shared `updateAssignee` handler.
- **Story 187**: `Popover` and the menu/overlay classes. **Story 189**: `Avatar`. **Story 186**: `controlClassName`.

**Unassign recon (required by the roadmap).** `UpdateTicketDto.assignedToUserId` is `@IsOptional() @IsUUID() string`, and `TicketsService.update` calls `requireUserInScope(dto.assignedToUserId)` for any value that is `!== undefined`. A `null` therefore fails the scope lookup: **the PATCH does not cleanly accept `null`**. Per the roadmap, the "Unassigned"/clear option is dropped, and there is no backend change.

---

## Story Goal

1. **`Combobox` in `@crm/ui`:** a searchable single-select with the ARIA 1.2 combobox-with-listbox semantics. Keyboard-first and RTL-correct.
2. **The ticket's assignee field uses it.** Each option shows the agent's avatar, name and **presence as text**. The current agent comes first, marked "(you)". It sends the same `PATCH` and shows the same toast as today, via `updateAssignee`.

**Non-goals:**
- unassign (see recon)
- team scoping or server-side search
- replacing the other four `Select`s
- any backend change

---

## Design decisions

1. **API:**

   ```ts
   interface ComboboxOption { value: string; label: string; description?: string; leading?: ReactNode }
   interface ComboboxProps {
     options: ComboboxOption[]; value?: string; onValueChange(value: string): void;
     "aria-label": string; placeholder: string; searchLabel: string; emptyText: string;
     disabled?: boolean; className?: string;
   }
   ```

2. **The trigger** is a `<button type="button" role="combobox" aria-haspopup="listbox" aria-expanded aria-controls={listboxId} aria-label>`.
   - It uses the `Select` trigger look (`controlClassName`, `focus-ring-always`, h-10, chevron) and shows the selected option's `leading` + `label`, or the placeholder.
   - Click, ArrowDown or ArrowUp opens it.
3. **The panel** is a Radix `Popover` with `align="start"`, as wide as the trigger (`w-[var(--radix-popover-trigger-width)]`), using `menuContentClassName`. It contains:
   - an `<input role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls={listboxId} aria-activedescendant aria-label={searchLabel}>`, autofocused;
   - a `<ul role="listbox" id={listboxId} aria-label={aria-label}>` of `<li role="option" id aria-selected>` items.
4. **Keys in the input:**

   | Key | Action |
   |---|---|
   | ArrowDown / ArrowUp | move the active option, clamped |
   | Home / End | first / last |
   | Enter | select the active option |
   | Escape | close (Radix); focus returns to the trigger |
   | typing | filters by label or description (case-insensitive, `toLocaleLowerCase`) and resets the active option to the first match |

   The pointer moves the active option on hover and selects on click. Selecting calls `onValueChange` only when the value changes, then closes.
5. **Option content:**
   - `leading` (an aria-hidden avatar), the `label`, and the `description` as `text-caption text-ink-subtle`;
   - the option's accessible name is its text, so presence is announced ("Jane Online · Online");
   - active state: `bg-surface-muted`; the selected item gets a check icon.
6. **Assignee options:**
   - each user's `label` is the full name, or the full name + " (you)" (`detail.assigneeYou`) for the current agent;
   - `description` is `detail.presenceOnline`/`presenceOffline`;
   - `leading` is `<Avatar size="sm" presence decorative>`;
   - the current agent is sorted first.

   The trigger is still named `detail.assignedAgent`, inside the same `Field` label, so the Playwright, guard and presence specs keep working.

---

## Context — Read These Files First

1. `packages/ui/src/components/{select,popover}.tsx`, `packages/ui/src/lib/{control,menu,icons}.ts`.
2. `apps/web/src/components/tickets/ticket-detail-view.tsx`: the assignee `Field` (Properties section) and `updateAssignee`.
3. `apps/web/src/components/tickets/ticket-detail-view.spec.tsx`: "assignee presence (RM-06)" (~970–1012), the A11Y-2 names case, the Story 202 header actions.
4. `apps/api/src/modules/tickets/dto/update-ticket.dto.ts` and `tickets.service.ts` ~420: the recon reference (read only).

---

## Tasks

1. **`packages/ui/src/components/combobox.tsx`** (`"use client"`), plus an index export and `combobox.spec.tsx`. The spec covers:
   - roles and attributes;
   - opening on click and ArrowDown;
   - filtering, with the empty state;
   - arrows, Home, End and Enter selecting;
   - `aria-activedescendant` following;
   - Escape closing and focus returning to the trigger;
   - `onValueChange` not called for the same value;
   - disabled;
   - logical classes only.
2. **Messages:** `tickets.detail.assigneeSearch` ("Search agents" / "ابحث عن وكيل") and `detail.assigneeYou` ("you" / "أنت").
3. **`ticket-detail-view.tsx`:** replace the assignee `Select` with `Combobox`. Its `disabled` stays `mutation.isPending || usersQuery.isLoading`; the placeholder is "Unassigned" or "Loading…" as today; `onValueChange={updateAssignee}`.
4. **Detail spec:**
   - the existing presence cases stay unchanged;
   - new: typing filters, Enter assigns through `updateAssignee` (payload + toast), and the current agent is first and marked "(you)".
   - the guard is unchanged (the combobox name is the same).

---

## Verification Steps

1. ui and web tests, typecheck and lint; prettier only on changed files that were clean at HEAD.
2. Web build; Playwright `agent-resolves-ticket` and `agent-customer-live-chat`.
3. Harness at 320, 768 and 1280 × en/ar × light/dark:
   - open the assignee picker via the keyboard (focus the trigger, ArrowDown), type to filter, check the active descendant moves, Escape, and focus returns to the trigger;
   - the panel is inside the viewport;
   - 0 overflow.

   Selection is not committed live, to avoid changing seeded data; specs cover it.
4. Run `git diff --check`; check the protected checksum; commit path-scoped.

---

## Done Criteria

- [ ] `Combobox` in `@crm/ui` with full keyboard and ARIA behaviour, plus a spec.
- [ ] The assignee picker shows avatar, name and presence text, with the current agent first and "(you)"; the payload is unchanged.
- [ ] Unassign is dropped per the recon, recorded.
- [ ] Existing specs pass; new specs; Playwright and build green; harness 0 overflow.
