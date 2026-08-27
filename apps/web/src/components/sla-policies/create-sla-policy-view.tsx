"use client";

import { useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCreateSlaPolicyMutation } from "@/hooks/use-sla-policies";
import type { SlaPolicyPriority } from "@/lib/sla-policies-api";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PRIORITY_OPTIONS: SlaPolicyPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const UNSET_PRIORITY = "__unset__";

/**
 * Story 31 — Create SLA Policy (plan Task 4), mirroring `CreateTicketView`'s
 * plain `useState` shape exactly: no form/validation library. Submits only
 * the existing `CreateSlaPolicyDto` shape through the real `POST
 * /sla-policies` — `departmentId`/`category`/`priority` are optional scoping,
 * both target minutes are required. `departmentId` is a plain text field (no
 * department picker exists anywhere in this codebase yet to reuse).
 *
 * Never optimistic: on success, navigates to the real list, which re-fetches
 * the real, authoritative state — no optimistic row is ever inserted. On a
 * rejected submission every entered value is preserved (state is never
 * cleared on error) so the agent can retry without re-typing.
 */
export function CreateSlaPolicyView() {
  const t = useTranslations("slaPolicies");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();

  const [departmentId, setDepartmentId] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState<string>(UNSET_PRIORITY);
  const [responseTargetMinutes, setResponseTargetMinutes] = useState("");
  const [resolutionTargetMinutes, setResolutionTargetMinutes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useCreateSlaPolicyMutation();

  const parsedResponse = Number(responseTargetMinutes);
  const parsedResolution = Number(resolutionTargetMinutes);
  const responseValid = Number.isInteger(parsedResponse) && parsedResponse >= 1;
  const resolutionValid = Number.isInteger(parsedResolution) && parsedResolution >= 1;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    if (!responseValid || !resolutionValid) {
      setError(t("create.invalidTargets"));
      return;
    }

    try {
      await mutation.mutateAsync({
        ...(departmentId.trim() ? { departmentId: departmentId.trim() } : {}),
        ...(category.trim() ? { category: category.trim() } : {}),
        ...(priority !== UNSET_PRIORITY ? { priority: priority as SlaPolicyPriority } : {}),
        responseTargetMinutes: parsedResponse,
        resolutionTargetMinutes: parsedResolution,
      });
      router.push(`/${locale}/sla-policies`);
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : t("create.createFailed"));
    }
  }

  return (
    <section className="flex max-w-md flex-col gap-4">
      <h1 className="text-lg font-semibold text-slate-900">{t("create.title")}</h1>

      {error && <Alert variant="destructive">{error}</Alert>}

      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          {t("create.department")}
          <Input
            value={departmentId}
            onChange={(event) => setDepartmentId(event.target.value)}
            placeholder={t("create.departmentPlaceholder")}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          {t("create.category")}
          <Input value={category} onChange={(event) => setCategory(event.target.value)} />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          {t("create.priority")}
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNSET_PRIORITY}>{t("create.priorityDefault")}</SelectItem>
              {PRIORITY_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          {t("create.responseTarget")}
          <Input
            type="number"
            value={responseTargetMinutes}
            onChange={(event) => setResponseTargetMinutes(event.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          {t("create.resolutionTarget")}
          <Input
            type="number"
            value={resolutionTargetMinutes}
            onChange={(event) => setResolutionTargetMinutes(event.target.value)}
            required
          />
        </label>

        <Button
          type="submit"
          disabled={mutation.isPending || !responseTargetMinutes || !resolutionTargetMinutes}
          className="self-start"
        >
          {mutation.isPending ? t("create.submitting") : t("create.submit")}
        </Button>
      </form>
    </section>
  );
}
