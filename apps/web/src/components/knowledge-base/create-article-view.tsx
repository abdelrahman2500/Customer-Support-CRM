"use client";

import { useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCreateArticleMutation } from "@/hooks/use-knowledge-base";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

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
  const [category, setCategory] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useCreateArticleMutation();

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    try {
      await mutation.mutateAsync({
        title: title.trim(),
        body: body.trim(),
        ...(category.trim() ? { category: category.trim() } : {}),
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
          <Input value={category} onChange={(event) => setCategory(event.target.value)} />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          {t("create.body")}
          <textarea
            className="flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
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
