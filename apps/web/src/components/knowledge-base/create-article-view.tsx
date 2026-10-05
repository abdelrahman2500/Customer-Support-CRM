"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useNavigatingRouter as useRouter } from "@/hooks/use-navigating-router";
import { useCreateArticleMutation } from "@/hooks/use-knowledge-base";
import { useKbCategoriesQuery } from "@/hooks/use-kb-categories";
import { useErrorMessage } from "@/hooks/use-error-message";
import {
  Button,
  Card,
  FormActions,
  FormField,
  FormSection,
  Input,
  PageHeader,
  Textarea,
} from "@crm/ui";
import { missingReason } from "@/lib/form-reason";
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
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();
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
      setError(
        errorMessage(submitError, {
          forbidden: t("create.createForbidden"),
          generic: t("create.createFailed"),
        }),
      );
    }
  }

  // Story 225 (PR-4.4) — what still blocks the submit, said beside it.
  const reasonId = useId();
  const missing = [
    ...(title.trim() ? [] : [t("create.articleTitle")]),
    ...(body.trim() ? [] : [t("create.body")]),
  ];

  return (
    <section className="flex max-w-3xl flex-col gap-section">
      <PageHeader title={t("create.title")} description={tCommon("form.requiredHint")} />

      <form onSubmit={handleSubmit}>
        <Card className="flex flex-col gap-section p-surface">
          <FormSection title={t("create.sectionArticle")} columns={2}>
            <FormField label={t("create.articleTitle")} required density="comfortable">
              <Input value={title} onChange={(event) => setTitle(event.target.value)} required />
            </FormField>
            <FormField label={t("create.category")} density="comfortable">
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
            </FormField>
          </FormSection>

          <FormSection title={t("create.sectionContent")}>
            <FormField label={t("create.body")} required density="comfortable">
              <Textarea
                rows={8}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                required
              />
            </FormField>
          </FormSection>

          <FormActions
            error={error}
            reason={missing.length > 0 ? missingReason(tCommon, locale, missing) : undefined}
            reasonId={reasonId}
          >
            <Button
              type="submit"
              disabled={mutation.isPending || !title.trim() || !body.trim()}
              aria-describedby={missing.length > 0 ? reasonId : undefined}
            >
              {mutation.isPending ? t("create.submitting") : t("create.submit")}
            </Button>
            <Button type="button" variant="ghost" asChild>
              <Link href={`/${locale}/knowledge-base`}>{tCommon("form.cancel")}</Link>
            </Button>
          </FormActions>
        </Card>
      </form>
    </section>
  );
}
