"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { SegmentedControl } from "@crm/ui";
import { useNavigatingRouter as useRouter } from "@/hooks/use-navigating-router";
import { localeDirection } from "@/i18n/direction";
import { TicketListView } from "@/components/tickets/ticket-list-view";
import { TicketBoardView } from "@/components/tickets/board/ticket-board-view";
import {
  VIEW_STORAGE_KEY,
  readStorage,
  writeStorage,
} from "@/components/tickets/board/board-state";

type TicketsViewMode = "board" | "list";

/**
 * Story 216 (PR-3.1, decision PD-3) — `/tickets` opens on the board; the
 * table is the secondary "List" view. The URL's `view` param wins; without
 * it, the last choice this browser made (a convenience — localStorage, never
 * shared state); otherwise the board. The list rewrites its own URL without
 * `view`, which is why the remembered choice — not the param alone — keeps
 * a list user on the list.
 */
export function TicketsView() {
  return (
    <Suspense fallback={null}>
      <TicketsViewContent />
    </Suspense>
  );
}

function TicketsViewContent() {
  const t = useTranslations("tickets.board");
  const { locale } = useParams<{ locale: string }>();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const param = searchParams.get("view");
  const [remembered, setRemembered] = useState<TicketsViewMode | null>(null);

  useEffect(() => {
    const stored = readStorage(VIEW_STORAGE_KEY);
    setRemembered(stored === "list" || stored === "board" ? stored : null);
  }, []);

  const mode: TicketsViewMode =
    param === "list" || param === "board" ? param : (remembered ?? "board");

  function choose(next: TicketsViewMode) {
    writeStorage(VIEW_STORAGE_KEY, next);
    setRemembered(next);
    router.replace(`${pathname}?view=${next}`);
  }

  const switcher = (
    <SegmentedControl
      aria-label={t("viewLabel")}
      dir={localeDirection(locale)}
      size="sm"
      options={[
        { value: "board", label: t("views.board") },
        { value: "list", label: t("views.list") },
      ]}
      value={mode}
      onValueChange={(value) => choose(value as TicketsViewMode)}
    />
  );

  return mode === "list" ? (
    <TicketListView viewSwitcher={switcher} />
  ) : (
    <TicketBoardView viewSwitcher={switcher} />
  );
}
