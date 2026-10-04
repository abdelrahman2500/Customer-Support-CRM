# Story 192 — SlaIndicator

> CRM UI/UX redesign roadmap item **RD-1.15**. Intake: [`../../stories/sla-indicator/sla-indicator/intake.md`](../../stories/sla-indicator/sla-indicator/intake.md). Roadmap: [`../crm-ui-ux-redesign/00-overview.md`](../crm-ui-ux-redesign/00-overview.md) §6 "RD-1.15", decisions D3 (at-risk threshold) and D4 (keep Arabic-Indic digits). Binding semantics: [`docs/architecture/13-design-language.md`](../../../docs/architecture/13-design-language.md) "Status semantics".

---

## Prerequisites

- **Story 185** (`7efabea`, RD-1.8): Badge tones and the `icon` prop; `WarningIcon`/`ErrorIcon`.
- **Story 191** (`4f96bad`, RD-1.14): the ticket status/priority badges that share these rows. Their clusters already `flex-wrap` on the dashboard.
- D3 is approved: the governing target is at risk at ≤ 25% of its window remaining (window measured from ticket creation) or ≤ 60 minutes remaining, whichever comes first. This is presentation only.

---

## Story Goal

One web component, `SlaIndicator`, replaces the three hand-rolled SLA renderings:
- `SlaCell` in the ticket list
- `SlaPresentation` on the dashboard
- the inline SLA card on the ticket detail page

It adds:
- the governing target's name ("Response"/"Resolution");
- the at-risk tier;
- a localized duration (Arabic has no Latin `h`/`m`; digits follow the `Intl` `ar` locale per D4).

**Non-goals:**
- live ticking countdowns
- the reports page's average-resolution duration (it is not an SLA indicator; it keeps `formatRemaining`)
- the portal (shows no SLA)
- any API, backend or business-rule change
- the hold/resume buttons (unchanged)

---

## Design decisions

1. **`deriveSlaStatus(target, now = new Date(), options?: { createdAt?: string | Date })`**:
   - `breached` and `on-track` gain `governing: "response" | "resolution"`. This is the earlier target; a tie means response.
   - `on-track` gains `atRisk: boolean`, computed as `remainingMs <= 60 min || (createdAt && remainingMs <= 0.25 × (targetAt − createdAt))`.
   - With no `createdAt`, or a non-positive window, only the 60-minute rule applies.
   - The new fields are additive. The existing kinds and fields are unchanged.
2. **`splitDuration(ms)`**: a pure function returning `{ hours, minutes }`, or `null` for under a minute.
   - `formatRemaining` keeps its exact output, re-expressed through `splitDuration`. The reports page still uses it.
   - The indicator formats through `common.duration.{hoursMinutes,minutes,lessThanMinute}` with `{hours, number}`/`{minutes, number}`, so digits follow the locale.
   - en: `{hours}h {minutes}m` / `{minutes}m` / `<1m`
   - ar: `{hours} س {minutes} د` / `{minutes} د` / `أقل من دقيقة`
3. **Rendering** (tones per the design language):

   | State | Compact (list, dashboard) | Detail |
   |---|---|---|
   | none | `text-ink-subtle` "No SLA target" | same, in a `<p>` |
   | on-track | neutral `text-ink-strong` "{target} due in {time}" | same, in a `<p>` |
   | at-risk | `Badge variant="warning" icon={WarningIcon}`, a visually hidden "At risk:" prefix, then "{target} due in {time}" | same |
   | breached | `Badge variant="destructive" icon={ErrorIcon}` "{target} breached" | "{target} breached at {time}" (`toLocaleString(locale)`, as today) |
   | on-hold | `Badge variant="secondary"` "On hold" | "On hold since {time}" |

   The detail variant keeps today's `mt-1`/`mt-2` spacing.
4. **New keys** in `tickets.sla`, en and ar:
   - `target.response`, `target.resolution`
   - `dueIn`
   - `breachedTarget`, `breachedTargetAt`
   - `atRisk`

   Existing keys stay (`none`, `onHold`, `onHoldSince`, and the hold actions). `breached`, `breachedAt` and `remaining` are no longer rendered by these views. They are kept: removing catalogue keys is not in scope, and other specs may read them.

---

## Context — Read These Files First

1. `apps/web/src/lib/sla.ts` (+ `sla.spec.ts`).
2. `apps/web/src/components/tickets/ticket-list-view.tsx` ~79–97 (`SlaCell`) and its use in the SLA column.
3. `apps/web/src/components/dashboard/dashboard-view.tsx` ~83–100 (`SlaPresentation`) and its two uses.
4. `apps/web/src/components/tickets/ticket-detail-view.tsx` ~291 (`slaStatus`) and ~690–715 (the SLA card).
5. `apps/web/messages/{en,ar}.json` `tickets.sla` (~269) and `common`.
6. Views' specs that may read SLA text: `ticket-detail-view.spec.tsx` (`sla.none`), `ticket-list-view.spec.tsx`, `dashboard-view.spec.tsx`.

---

## Tasks

No backend changes required.

1. **`lib/sla.ts`:** `governing`, `atRisk`, the `options.createdAt` parameter, `splitDuration`, and `formatRemaining` via `splitDuration`. Add a doc comment citing D3.
2. **Messages:** add `common.duration.*` and the `tickets.sla` keys from design decision 4, in en and ar.
3. **Create `components/tickets/sla-indicator.tsx`:**
   - `SlaIndicator({ target, createdAt, now?, variant = "compact", className? })`
   - a `useFormatDuration()` helper (local to the file)
4. **Ticket list:** delete `SlaCell` and render `<SlaIndicator target={ticket.slaTarget} createdAt={ticket.createdAt} />`. Remove the unused imports.
5. **Dashboard:** delete `SlaPresentation` and render `<SlaIndicator target={ticket.slaTarget} createdAt={ticket.createdAt} now={now} />` at both sites.
6. **Ticket detail:** replace the four kind branches inside the SLA card with `{slaTargetQuery.isSuccess && <SlaIndicator variant="detail" target={slaTargetQuery.data ?? null} createdAt={ticket.createdAt} />}`.
   - Keep the hold/resume block, which reads `slaStatus.kind`. `slaStatus` stays for that.

---

## Test Plan

1. **`lib/sla.spec.ts`** (extend):
   - `governing` is response/resolution, including a tie;
   - at risk exactly at 60 minutes, not at 61;
   - at 25% of the window, not just above it (a 10h window: 2h30m is at risk, 2h31m is not);
   - with no `createdAt`, only the 60-minute rule applies;
   - `splitDuration` boundaries;
   - `formatRemaining` unchanged.
2. **Create `components/tickets/sla-indicator.spec.tsx`** with real en/ar messages, covering:
   - none
   - on-track (response and resolution label, time)
   - at-risk (warning class, icon, hidden "At risk")
   - breached (danger class, icon, label)
   - on-hold
   - the detail variants with a time
   - Arabic output with no Latin letters, with digits from `Intl.NumberFormat("ar")` (D4 keeps the runtime's `ar` behaviour)
3. **View specs:** run as-is. Update only assertions that read the old "remaining" text; these are an intentional contract change.

---

## Verification Steps

1. `pnpm --filter @crm/web test`, then typecheck and lint for web.
2. Stop the web server, then `pnpm --filter @crm/web build`.
3. Harness (production): the ticket list, dashboard and a ticket detail page at 320 and 1280 × en/ar × light/dark. Check:
   - 0 overflow;
   - no Latin `h`/`m` inside the SLA cells in ar;
   - an icon on breached and at-risk badges.
4. Run `git diff --check`, review the diff, and confirm `qa-review.md` and `stash@{0}` are untouched.

---

## Done Criteria

- [ ] `sla.ts` exposes `governing`/`atRisk` per D3 with boundary specs; `formatRemaining` is unchanged.
- [ ] `SlaIndicator` replaces `SlaCell`, `SlaPresentation` and the detail rendering. It shows the same information plus the target label.
- [ ] The duration is localized (no Latin h/m in ar; locale digits).
- [ ] At-risk and breached carry an icon; at-risk has screen-reader text.
- [ ] Web tests, typecheck, lint and build pass; 0 overflow at 320.
- [ ] No backend, API or business-rule change; no live countdown.
