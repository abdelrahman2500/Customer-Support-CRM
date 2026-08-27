import { redirect } from "next/navigation";

/**
 * Story 23 replaces the Story 02 wiring-proof placeholder that used to
 * render here with the real Ticket List at `tickets` — this route now
 * exists only so an old bookmark/link still lands somewhere sensible.
 */
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/tickets`);
}
