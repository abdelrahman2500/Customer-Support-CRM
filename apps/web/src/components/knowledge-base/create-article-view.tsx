"use client";

import { useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCreateArticleMutation } from "@/hooks/use-knowledge-base";
import { useKbCategoriesQuery } from "@/hooks/use-kb-categories";
import { ApiError } from "@/lib/api";
import { Alert, Button, Input } from "@crm/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@crm/ui";

/** RM-27 — the free-text category `Input` became a `Select` sourced from
 * `useKbCategoriesQuery`, mirroring `CreateTicketView`'s own
 * `UNSET_CATEGORY` sentinel exactly. */
const UNSET_CATEGORY = "__unset__";

/**
 * Story 51 — Create Article, mirroring `CreateSlaPolicyView`'s plain
 * `useState` shape exactly: no form/validation library. Submits only the
 * existing `CreateArticleDto` shape through the real `POST
 * /knowledge-base/articles` — always created as `DRAFT` (the backend
 * default; there is no create-time publish option, mirroring the plan's
 * "publish via the general update endpoint" design).
 *
 * Never optimistic: on success, navigates to the real list, which re-fetches
 * the real, authoritative state. On a rejected submission every entered
 * value is preserved so the agent can retry without re-typing.
 */
export function CreateArticleView() {
  const t = useTranslations("knowledgeBase");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [categoryId, setCategoryId] = useState<string>(UNSET_CATEGORY);
  const [error, setError] = useState<string | null>(null);

  const mutation = useCreateArticleMutation();
  const categoriesQuery = useKbCategoriesQuery();

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    try {
      await mutation.mutateAsync({
        title: title.trim(),
        body: body.trim(),
        ...(categoryId !== UNSET_CATEGORY ? { categoryId } : {}),
      });
      router.push(`/${locale}/knowledge-base`);
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
          {t("create.articleTitle")}
          <Input value={title} onChange={(event) => setTitle(event.target.value)} required />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          {t("create.category")}
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger aria-label={t("create.category")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNSET_CATEGORY}>{t("create.categoryDefault")}</SelectItem>
              {(categoriesQuery.data ?? []).map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          {t("create.body")}
          <textarea
            className="flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-ink-subtle focus-ring"
            rows={6}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            required
          />
        </label>

        <Button
          type="submit"
          disabled={mutation.isPending || !title.trim() || !body.trim()}
          className="self-start"
        >
          {mutation.isPending ? t("create.submitting") : t("create.submit")}
        </Button>
      </form>
    </section>
  );
}
