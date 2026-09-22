import { useTranslations } from "next-intl";

/**
 * Story 153 — the one place a `TicketStatus`/`TicketPriority` enum value
 * becomes text a person reads.
 *
 * Before this, the agent workspace rendered the raw enum at 15 sites across
 * 7 files — an Arabic-speaking agent read "IN_PROGRESS" and "URGENT" in
 * Latin capitals, while an Arabic customer reading the same ticket in the
 * portal saw "قيد المعالجة" (Story 148 localised the portal and stopped
 * there).
 *
 * ## Why `common`, and not `tickets`
 *
 * The 8 consuming files span six namespaces (`tickets`, `dashboard`,
 * `customers`, `slaPolicies`, `reporting`, `common`). Scoping these labels
 * to `tickets` — which is what the portal did — would force the other five
 * to carry their own duplicate copies that drift apart. `common` already
 * holds exactly this class of cross-cutting string (`loading`, `updating`,
 * `pagination`, `errors`), so one set serves every caller.
 *
 * Deliberately a thin wrapper around `useTranslations("common")`, mirroring
 * `use-error-message.ts`'s own shape: a call site gets a function, not a
 * second translator to remember to configure.
 *
 * ## What this does NOT do
 *
 * It never touches `ticketStatusBadgeVariant`/`ticketPriorityBadgeVariant`.
 * Those map colour from the RAW enum and must keep doing so — the label is
 * presentation, the enum is the contract. Likewise a `Select`'s option
 * `value` stays the raw enum (it is sent to the API); only its visible text
 * comes from here.
 */
export function useTicketLabels() {
  const t = useTranslations("common");

  return {
    /** `TicketStatus` → localized label. */
    status: (value: string) => t(`ticketStatus.${value}` as Parameters<typeof t>[0]),
    /**
     * `TicketPriority` → localized label.
     *
     * Also serves `TaskPriority`: the two enums have identical members
     * (`LOW`/`MEDIUM`/`HIGH`/`URGENT` — `schema.prisma:547` and `:1818`) and
     * identical user-facing meaning, so a parallel key set would be the same
     * four strings twice.
     */
    priority: (value: string) => t(`ticketPriority.${value}` as Parameters<typeof t>[0]),
  };
}
