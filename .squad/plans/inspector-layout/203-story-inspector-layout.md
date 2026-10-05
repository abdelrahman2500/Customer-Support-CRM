# Story 203 — Inspector layout

> CRM UI/UX redesign roadmap item **RD-3.3**. Intake: [`../../stories/inspector-layout/inspector-layout/intake.md`](../../stories/inspector-layout/inspector-layout/intake.md). Roadmap: [`../crm-ui-ux-redesign/00-overview.md`](../crm-ui-ux-redesign/00-overview.md) Phase 3 "RD-3.3"; recon TW-02, TW-07.

---

## Prerequisites

- **Story 201** (`1d8f30c`): `TicketHeader`, sticky at `lg:top-0`, and the Phase 3 section-survival guard. **Story 202** (`7bf7f29`): header actions.
- `SectionCard` (Story 154), `DescriptionList`/`DescriptionItem` (Story 189).

---

## Story Goal

Turn the ticket page's side column into an **inspector**:

- At `lg` it stays beside the conversation, just under the sticky ticket header, and scrolls on its own.
- It is made of **titled, collapsible sections**: Properties, Customer, SLA, Escalations and CSAT. All are open by default, and the collapse state is client-only.
- The untitled properties card becomes **Properties** (TW-07), which fixes the heading outline. It holds the same five controls plus the full ticket ID.

**Non-goals:**
- control replacement (Combobox, RD-3.4)
- History moving into the timeline (RD-3.6); it stays as it is, not collapsible
- persisting the collapse state
- any API change

---

## Design decisions

1. **`SectionCard` gains `collapsible?: boolean` and `defaultOpen?: boolean` (default `true`).**
   - When `collapsible` is set:
     - the heading contains a `<button type="button" aria-expanded aria-controls={bodyId}>` with the title and a `ChevronDownIcon`, rotated `-rotate-90` when closed (direction-neutral at 0°; while closed the chevron points toward the inline end, like a disclosure triangle, so RTL uses `rtl:rotate-90`);
     - the body is wrapped in `<div id={bodyId} hidden={!open}>`.
   - The button is `focus-ring`, full-width, and `rounded-inner`.
   - Without `collapsible`, the output is **byte-identical** to today (no new node), so the 49 callers and the node-count tests are untouched.
   - This is the WAI-ARIA disclosure pattern; the heading level is unchanged.
2. **Properties.** `<SectionCard title={t("detail.propertiesHeading")} collapsible>` holds:
   - the same `grid … sm:grid-cols-2 lg:grid-cols-1` of the five `Field`s, unchanged (the Playwright `getByLabel("Status")` still resolves to the same `<label>`);
   - then a `DescriptionList` with the full ticket ID (`font-mono`, `dir="ltr"`, `break-all`), useful to copy. The header shows only the short id.
3. **The inspector container** (the side column `div`):
   - `lg:sticky lg:top-[var(--ticket-header-h,0px)] lg:max-h-[calc(100vh - header - page-y gutter)] lg:overflow-y-auto`, plus a small inline padding so focus rings at card edges aren't clipped. The bottom gutter is subtracted because, at the very end of the page, sticky releases at the grid's edge; without it the inspector's top slid 32px under the header (found by the harness);
   - `--ticket-header-h` is set on the page `<section>` from a `ResizeObserver` on the header wrapper (guarded where `ResizeObserver` is undefined, as in jsdom: the variable falls back to `0px`).

   Below `lg`, nothing changes.
4. **Collapsible sections:** Properties, Customer (`CustomerContextPanel` gains a `collapsible` passthrough), SLA, Escalations and CSAT.
5. **New messages:** `tickets.detail.propertiesHeading` ("Properties" / "الخصائص") and `tickets.detail.ticketIdFull` ("Ticket ID" / "معرّف التذكرة").

---

## Context — Read These Files First

1. `packages/ui/src/components/card.tsx` (`SectionCard`, `CardTitle`) and `card.spec.tsx`.
2. `apps/web/src/components/tickets/ticket-detail-view.tsx`: the side column (~420–790) and `Field`.
3. `apps/web/src/components/tickets/customer-context-panel.tsx`.
4. `apps/web/src/components/tickets/ticket-detail-view.spec.tsx`: the guard, plus `.closest(".p-surface")` selectors.

---

## Tasks

1. **`SectionCard` `collapsible`/`defaultOpen`**, plus a spec:
   - the non-collapsible DOM is unchanged;
   - the button carries `aria-expanded`/`aria-controls`;
   - toggling hides and shows the body;
   - keyboard (Enter/Space on the button);
   - the heading name is unchanged;
   - no physical classes.
2. **`CustomerContextPanel`:** a `collapsible` prop, passed through.
3. **`ticket-detail-view.tsx`:**
   - the Properties section;
   - collapsible SLA, Escalations and CSAT;
   - the inspector container classes;
   - the header-height variable;
   - messages.
4. **Specs:**
   - extend the guard: the Properties heading, and each collapsible section's toggle with `aria-expanded="true"` by default;
   - collapsing Properties hides the status field and expanding restores it;
   - the full ticket ID is present;
   - every h2 follows the single h1.

   Update only selectors that the new wrapper changes, with a recorded reason.

---

## Verification Steps

1. ui and web tests, typecheck and lint; prettier only on changed files that were clean at HEAD.
2. Web build; Playwright `agent-resolves-ticket` and `agent-customer-live-chat`.
3. Harness at 320, 768 and 1280 × en/ar × light/dark:
   - 0 overflow;
   - at 1280, after scrolling the page 1500px, the inspector's top is about the header height and the inspector is scrollable (`scrollHeight > clientHeight`, or it fits);
   - collapse and expand via the keyboard;
   - the Status field stays labelled;
   - the RTL chevron.
4. Run `git diff --check`; check the protected checksum; commit path-scoped.

---

## Done Criteria

- [ ] `SectionCard` collapsible (disclosure pattern); non-collapsible output unchanged.
- [ ] A titled Properties section with the same controls plus the full ID; the outline is h1 → h2.
- [ ] The inspector is sticky and scrolls independently at `lg`; the five sections are collapsible and open by default.
- [ ] Guard extended; all specs, the build and Playwright green; harness 0 overflow.
