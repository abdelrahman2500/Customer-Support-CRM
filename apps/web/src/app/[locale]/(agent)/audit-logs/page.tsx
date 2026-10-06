import { AuditLogView } from "@/components/audit-logs/audit-log-view";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("workspace.nav", "auditLogs");

export default function AuditLogsPage() {
  return <AuditLogView />;
}
