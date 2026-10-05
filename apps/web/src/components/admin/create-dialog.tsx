"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  AddIcon,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@crm/ui";

const CloseContext = createContext<() => void>(() => {});

/** Closes the surrounding create dialog (a form calls it once it has succeeded). */
export function useCreateDialogClose(): () => void {
  return useContext(CloseContext);
}

/**
 * Story 227 (PR-4.6) — an admin screen's "create" form, opened from the page
 * header instead of sitting under the list. The trigger and the dialog title
 * share the form's own heading ("New quick reply"). A form that must show a
 * one-time secret after creating (API keys, webhooks) simply does not call
 * `useCreateDialogClose()`; the others close on success.
 */
export function CreateDialog({ label, children }: { label: string; children: ReactNode }) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          <AddIcon aria-hidden="true" className="h-4 w-4" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent size="md" closeLabel={t("form.cancel")} aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        <CloseContext.Provider value={() => setOpen(false)}>{children}</CloseContext.Provider>
      </DialogContent>
    </Dialog>
  );
}
