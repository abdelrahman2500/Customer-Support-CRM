import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { PrismaService } from "../../prisma/prisma.service";
import { TICKET_ON_HOLD_EVENT, TICKET_RESUMED_EVENT } from "../tickets/tickets.events";
import type { TicketOnHoldEvent, TicketResumedEvent } from "../tickets/tickets.events";

/**
 * RM-25 — SLA Pause/Resume. The sole subscriber of `TICKET_ON_HOLD_EVENT`/
 * `TICKET_RESUMED_EVENT`, mirroring `SlaTargetListener`'s exact
 * catch-and-log pattern: a computation/persistence failure here must never
 * turn a successful `POST /tickets/:id/hold`/`resume` request into a
 * failed one (the HTTP response has already returned by the time this
 * runs — `TicketsService` emits and returns immediately, never awaits a
 * listener, the same fire-and-forget shape every other ticket event in
 * this codebase already uses).
 *
 * Both handlers are deliberately silent no-ops — never throw, never log
 * above `warn` — for every case that isn't "a pending target exists and
 * is in the opposite state": a ticket whose classification never matched
 * an `SlaPolicy` has no `SlaTicketTarget` row to pause at all; holding an
 * already-on-hold ticket, or resuming one that isn't on hold, is not an
 * error, just nothing to do.
 */
@Injectable()
export class SlaHoldListener {
  private readonly logger = new Logger(SlaHoldListener.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent(TICKET_ON_HOLD_EVENT)
  async onTicketOnHold(event: TicketOnHoldEvent): Promise<void> {
    try {
      const target = await this.prisma.slaTicketTarget.findUnique({
        where: { ticketId: event.ticket.id },
      });
      if (!target || target.onHoldSince) {
        return;
      }

      await this.prisma.slaTicketTarget.update({
        where: { ticketId: event.ticket.id },
        data: { onHoldSince: new Date() },
      });
    } catch (error) {
      this.logger.error("Failed to place SLA target on hold for ticket.on_hold", error as Error);
    }
  }

  /**
   * Shifts whichever of `responseTargetAt`/`resolutionTargetAt` had not
   * already passed at the moment the hold began (`target.onHoldSince`)
   * forward by the exact held duration — `target.responseTargetAt`/
   * `resolutionTargetAt` are still whatever they were when the hold
   * started (nothing else mutates them while `onHoldSince` is set), so
   * comparing each against `onHoldSince` itself correctly reconstructs
   * "was this one still pending when the hold began", with no extra
   * column needed to record that separately. A target that had already
   * passed `onHoldSince` (already breached before the hold) is left
   * completely untouched — holding never retroactively un-breaches one.
   */
  @OnEvent(TICKET_RESUMED_EVENT)
  async onTicketResumed(event: TicketResumedEvent): Promise<void> {
    try {
      const target = await this.prisma.slaTicketTarget.findUnique({
        where: { ticketId: event.ticket.id },
      });
      if (!target || !target.onHoldSince) {
        return;
      }

      const onHoldSince = target.onHoldSince;
      const heldMs = Date.now() - onHoldSince.getTime();
      const responseTargetAt =
        target.responseTargetAt.getTime() > onHoldSince.getTime()
          ? new Date(target.responseTargetAt.getTime() + heldMs)
          : target.responseTargetAt;
      const resolutionTargetAt =
        target.resolutionTargetAt.getTime() > onHoldSince.getTime()
          ? new Date(target.resolutionTargetAt.getTime() + heldMs)
          : target.resolutionTargetAt;

      await this.prisma.slaTicketTarget.update({
        where: { ticketId: event.ticket.id },
        data: { onHoldSince: null, responseTargetAt, resolutionTargetAt },
      });
    } catch (error) {
      this.logger.error("Failed to resume SLA target for ticket.resumed", error as Error);
    }
  }
}
