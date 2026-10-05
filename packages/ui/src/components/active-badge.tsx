import { cn } from "../lib/cn";
import { Badge } from "./badge";

/**
 * Story 227 (PR-4.6) — one active/inactive status, used by every admin list
 * (categories, rules, replies, templates, webhooks, SLA policies, branches).
 * A dot plus the word — never colour alone — in the success tone when active
 * and a quiet neutral when not.
 */
export function ActiveBadge({
  active,
  activeLabel,
  inactiveLabel,
  className,
}: {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
  className?: string;
}) {
  return (
    <Badge variant={active ? "success" : "secondary"} className={className}>
      <span
        aria-hidden="true"
        className={cn("h-1.5 w-1.5 rounded-pill", active ? "bg-success-solid" : "bg-ink-subtle")}
      />
      {active ? activeLabel : inactiveLabel}
    </Badge>
  );
}
