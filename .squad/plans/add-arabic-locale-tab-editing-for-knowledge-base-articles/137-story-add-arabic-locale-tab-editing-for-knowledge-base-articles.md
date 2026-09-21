# Story 137 — Add Arabic locale-tab editing for Knowledge Base articles

---

## Prerequisites

- **Story 109 completed** — see [../kb-multi-locale/109-story-kb-multi-locale.md](../kb-multi-locale/109-story-kb-multi-locale.md). It shipped the entire translation backend and named this story in its own Non-goals: _"No admin authoring UI in `apps/web`'s KB editor (no locale tab/switcher in the article-edit screen)… A locale-tab editor is additive UX on an unchanged data model, appropriate for a later, separate story."_ This is that story.
- **Story 51** created `ArticleDetailView` and its blur-commit field pattern; **Story 65** appended the read-only `ArticleVersionHistory` section; **RM-27** replaced the category `Input` with a `Select`; **RM-28** appended `AttachmentsCard`. Stories 65 and RM-28 are the two precedents for **appending a self-contained sibling section without touching the existing fields** — follow them.
- **RM-23** established the only `Tabs` usage in this app, in `apps/web/src/components/settings/settings-view.tsx`. Reuse that shape.
- **Story 94** established `useErrorMessage()` and its `forbidden`/`generic` mapping.
- **No backend prerequisite.** The translation endpoints, DTO, permissions, Prisma model, branch scoping and locale fallback are complete and covered by existing API e2e tests. **This story changes none of them.**

---

## Story Goal

The Knowledge Base article detail editor edits only base (English) article content. The backend has supported per-locale translations since Story 109, but a repo-wide search for `translations` across `apps/web/src` and `apps/portal/src` returns **zero** hits — there is no API client function, no hook, and no component. No agent can author Arabic KB content through the product.

Add an **English / Arabic** tabbed editing experience to `ArticleDetailView`:

1. The **English** tab renders the existing editor, behaviourally unchanged.
2. The **Arabic** tab reads the article's translations and lets an agent write the `AR` `title`/`body` through an explicit **Save**.

**Frontend-only.** No backend endpoint, DTO, Prisma model, permission, or fallback behaviour changes.

**Explicitly not in scope:** Arabic full-text search, per-locale versioning, locales beyond `EN`/`AR`, any portal change, translation import/export or bulk management, machine translation, translation history, a translation publication workflow, new shared UI primitives, redesign of the English editor, and migrating the existing raw `<textarea>`/`text-red-600` already in this file.

---

## Context — Read These Files First

1. `apps/web/src/components/knowledge-base/article-detail-view.tsx` — the whole file (287 lines). Specifically: the imports at **lines 1–30**; `ArticleDetailSkeleton` at **58–65**; the early loading/error/null returns at **80–94**; the title `Input` at **132–146** and body `<textarea>` at **209–222** (both **controlled** via `xDraft ?? article.x` with **blur-commit and revert-on-error**); the single shared mutation-error `Alert` at **171–178**; `AttachmentsCard` at **225–236**; and the private `ArticleVersionHistory` at **245–287**. Note `useParams().locale` (line **70**) is used **only** for the back-link href and date formatting — there is **no content locale awareness anywhere**.
2. `apps/web/src/lib/knowledge-base-api.ts` — the whole file (120 lines). Match `updateArticle`'s shape at **97–102** and `listArticleVersions`'s at **118–120**. There is **no translation function** — that is the gap.
3. `apps/web/src/hooks/use-knowledge-base.ts` — the whole file (123 lines). Note `articleQueryKey` at **39**, `articleVersionsQueryKey` at **80–81** (a **separate root key**, not nested under the article key), and `useUpdateArticleMutation` at **113–123** invalidating three keys.
4. `apps/web/src/components/settings/settings-view.tsx` — **lines 1–8** (the `import { Tabs, TabsContent, TabsList, TabsTrigger } from "@crm/ui"` and `import { localeDirection } from "@/i18n/direction"`) and **lines 45–60** (`<Tabs defaultValue="branding" dir={localeDirection(locale)}>` wrapping `TabsList`/`TabsTrigger`/`TabsContent`). This is the only `Tabs` call site in the app; copy its shape.
5. `packages/ui/src/components/tabs.tsx` — **lines 7–22**. `Tabs` is `TabsPrimitive.Root` (Radix), so it accepts `dir`; the doc comment states arrow keys _"follow the document direction, so Left moves to the next tab under `dir="rtl"`"_. That is why `dir` is **required**, not decorative.
6. `apps/api/src/modules/knowledge-base/knowledge-base.controller.ts` — **lines 65–82**. `@Put(":id/translations/:locale")` with `@RequirePermissions("kb:update")` and a `ParseEnumPipe(KbLocale)`; `@Get(":id/translations")` with `@RequirePermissions("kb:read")`.
7. `apps/api/src/modules/knowledge-base/dto/set-article-translation.dto.ts` — the whole file. `title` and `body` are both `@IsString() @MinLength(1)` and **both required**; `locale` is deliberately route-only.
8. `apps/api/src/modules/knowledge-base/knowledge-base.service.ts` — `ArticleTranslationSummary` at **lines 41–49**, `setArticleTranslation` at **339–350** (a Prisma `upsert` on `articleId_locale`), `listArticleTranslations` at **355–358**.
9. `apps/api/test/knowledge-base.e2e-spec.ts` — **lines 447–545**, the `describe("translations")` block. It pins the real contract: 401 unauthenticated, **400** on a non-`KbLocale` segment, **404** unknown article, **`[]`** when no translation is set, set-then-list, locale resolution, base fallback, and _"re-setting the same locale replaces the translation wholesale (upsert), not merge"_.
10. `apps/web/src/hooks/use-error-message.ts` — the whole file (20 lines). `useErrorMessage()` returns `(error, { forbidden, generic }) => string`.
11. `apps/web/src/components/admin/branding-view.tsx` — **line 116**, `showSuccessToast(t("saveSuccess"))`. The success-feedback precedent.
12. `apps/web/src/components/knowledge-base/article-detail-view.spec.tsx` — **lines 1–65** (the `vi.mock` block for `next/navigation`, `next-intl`, `@/hooks/use-knowledge-base`, `@/hooks/use-kb-categories`, `@/hooks/use-attachments`, plus the `queryResult()` helper and `baseArticle` fixture) and the 18 existing `it(...)` titles from **98** to **419**.
13. `apps/web/messages/en.json` — **lines 710–736**, the `knowledgeBase.detail` block ending with the nested `versions` object. New keys go here.
14. Grep `translations` in `apps/web/src` and `apps/portal/src` to confirm for yourself that it returns nothing before you start.

---

## Product rules (from story)

|                                             | Current behaviour                                             | New behaviour                                            |
| ------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------- |
| Base `title`/`body`                         | Controlled, **blur-commit**, partial `PATCH`, revert-on-error | **Unchanged**                                            |
| Category / publish / attachments / versions | As today                                                      | **Unchanged**                                            |
| Arabic `title`/`body`                       | No UI at all                                                  | Explicit **Save**, both fields together, wholesale `PUT` |
| Locale awareness                            | None                                                          | English/Arabic tabs                                      |
| Permissions                                 | `kb:read` / `kb:update`                                       | **Unchanged** — reused                                   |

**The interaction difference is deliberate.** The base editor commits one field at a time because `PATCH /knowledge-base/articles/:id` accepts a partial body. `PUT …/translations/:locale` **requires both `title` and `body`** and replaces them wholesale, so a per-field blur-commit would have to silently resend the other field. Use an explicit Save.

---

## Frontend Tasks

### 1 — API client

**File: `apps/web/src/lib/knowledge-base-api.ts`**

Append below `listArticleVersions` (ends line 120). Mirror the file's existing `apiFetch` style exactly.

```ts
/** Story 109 — one article's content in one locale. Mirrors the backend's
 * own `ArticleTranslationSummary` exactly
 * (`apps/api/src/modules/knowledge-base/knowledge-base.service.ts`). */
export type ArticleLocale = "EN" | "AR";

export interface ArticleTranslationSummary {
  id: string;
  articleId: string;
  locale: ArticleLocale;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors `SetArticleTranslationDto` exactly: both fields required,
 * both non-empty. `locale` is a route segment, never part of the body. */
export interface SetArticleTranslationInput {
  title: string;
  body: string;
}

export function listArticleTranslations(articleId: string): Promise<ArticleTranslationSummary[]> {
  return apiFetch<ArticleTranslationSummary[]>(
    `/knowledge-base/articles/${articleId}/translations`,
  );
}

export function setArticleTranslation(
  articleId: string,
  locale: ArticleLocale,
  input: SetArticleTranslationInput,
): Promise<ArticleTranslationSummary> {
  return apiFetch<ArticleTranslationSummary>(
    `/knowledge-base/articles/${articleId}/translations/${locale}`,
    { method: "PUT", body: JSON.stringify(input) },
  );
}
```

**`createdAt`/`updatedAt` are `string`, not `Date`** — the backend types them as `Date` but they cross the wire as JSON, and every other interface in this file (`ArticleSummary` lines 17–28, `ArticleVersionSummary` 107–116) already models timestamps as `string`.

### 2 — Hooks

**File: `apps/web/src/hooks/use-knowledge-base.ts`**

Add the imports to the existing `@/lib/knowledge-base-api` import block (lines 2–9), then append the hooks.

**The query key must be rooted independently**, exactly as `articleVersionsQueryKey` (line 80–81) is:

```ts
/** Story 137 — a separate root, mirroring `articleVersionsQueryKey`'s own
 * precedent. Nesting this under `["knowledge-base-articles", ...]` would
 * make every unrelated article mutation invalidate it through the bare
 * -prefix invalidation `useUpdateArticleMutation` performs. */
export const articleTranslationsQueryKey = (articleId: string) =>
  ["knowledge-base-article-translations", articleId] as const;

export function useArticleTranslationsQuery(articleId: string) {
  return useQuery({
    queryKey: articleTranslationsQueryKey(articleId),
    queryFn: () => listArticleTranslations(articleId),
  });
}

/**
 * Never applies optimistically (the rule every other mutation hook here
 * follows). Invalidates **only** the translations query: a translation is
 * a separate row and changes nothing about the base article's own
 * `title`/`body`/`status`, so invalidating `articleQueryKey` or the
 * `["knowledge-base-articles"]` list prefix would re-fetch content this
 * mutation cannot have altered.
 */
export function useSetArticleTranslationMutation(articleId: string, locale: ArticleLocale) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SetArticleTranslationInput) =>
      setArticleTranslation(articleId, locale, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: articleTranslationsQueryKey(articleId) });
    },
  });
}
```

### 3 — The tabs and the Arabic panel

**File: `apps/web/src/components/knowledge-base/article-detail-view.tsx`**

#### 3a — Wrap the existing editor in tabs

Add to the imports: `Tabs, TabsContent, TabsList, TabsTrigger` and `Textarea` from `@crm/ui`, `showSuccessToast` from `@crm/ui`, and `localeDirection` from `@/i18n/direction`.

Inside `ArticleDetailView`'s returned `<section>` (line 109), keep the back-link (**114–122**) and the header row (**124–169**) **outside** the tabs — the title `Input`, status `Badge`, publish `Button` and `ConfirmDialog` are article-level, not locale-level. Wrap only from the mutation-error `Alert` (**171**) through `ArticleVersionHistory` (**238**) in:

```tsx
<Tabs defaultValue="en" dir={localeDirection(locale)}>
  <TabsList>
    <TabsTrigger value="en">{t("detail.locales.en")}</TabsTrigger>
    <TabsTrigger value="ar">{t("detail.locales.ar")}</TabsTrigger>
  </TabsList>
  <TabsContent value="en">
    {/* existing category + body + attachments + versions, unmoved */}
  </TabsContent>
  <TabsContent value="ar">
    <ArticleTranslationEditor articleId={articleId} />
  </TabsContent>
</Tabs>
```

**Do not change a single line inside the English content** — same JSX, same handlers, same drafts, same order. Re-indentation is the only permitted edit. `defaultValue="en"` guarantees the English tab is what renders on mount, which is what keeps the existing tests passing.

**Keep the title `Input` outside the tabs.** It edits the base article's title, which is not locale-scoped, and moving it inside would break the existing blur-commit tests at spec lines **199–265**.

#### 3b — Add the Arabic panel

Add a private component below `ArticleVersionHistory`, following that component's own self-contained shape (**245–287**):

```tsx
/** Story 137 — Arabic translation authoring over Story 109's existing
 * endpoints. Explicit save, not the base editor's blur-commit: `PUT
 * .../translations/AR` requires BOTH `title` and `body` and replaces them
 * wholesale (see `SetArticleTranslationDto` and the "replaces the
 * translation wholesale (upsert), not merge" e2e case), so a per-field
 * commit would have to silently resend the other field. */
function ArticleTranslationEditor({ articleId }: { articleId: string }) {
```

Behaviour:

- `const translationsQuery = useArticleTranslationsQuery(articleId);`
- `const mutation = useSetArticleTranslationMutation(articleId, "AR");`
- Resolve the existing row: `translationsQuery.data?.find((row) => row.locale === "AR")`. The endpoint returns **an unordered array of at most two**, never a keyed object — do **not** index by position.
- Drafts use the same `useState<string | null>(null)` + `draft ?? existing?.title ?? ""` shape the base editor uses, so a fresh server value after save flows back in.
- **Loading:** `translationsQuery.isLoading` → `<Skeleton className="h-32 w-full" />` (match `ArticleVersionHistory` line 257's shape).
- **Read error:** `translationsQuery.isError` → `<Alert variant="destructive">` with `errorMessage(translationsQuery.error, { forbidden: t("detail.actionForbidden"), generic: t("detail.translations.loadError") })`.
- **No AR row:** render the empty fields **plus** a short line, `t("detail.translations.none")`. This is the **empty** state, not an error — `GET` returns `[]`, proven by the e2e case _"returns [] for an article with no translations set yet"_.
- **Fields:** a `title` `Input` and a `body` **shared `Textarea`** (`@crm/ui`), both `dir="rtl"`, each with an `aria-label`. Use the shared `Textarea` for the **new** field; the existing English raw `<textarea>` at line 209 stays as-is (out of scope).
- **Save:** a `<Button>` calling `mutation.mutate({ title, body })` with **both fields together**. `disabled={mutation.isPending || !title.trim() || !body.trim()}` — this is the client half of the backend's `@MinLength(1)`.
- **Success:** `onSuccess: () => showSuccessToast(t("detail.translations.saveSuccess"))`.
- **Write error:** `mutation.isError` → its own `<Alert variant="destructive">` with `errorMessage(mutation.error, { forbidden: t("detail.actionForbidden"), generic: t("detail.translations.saveFailed") })`. Reuse the existing `detail.actionForbidden` key; **do not** add a second forbidden string.

### 4 — i18n

**Files: `apps/web/messages/en.json` and `apps/web/messages/ar.json`**

Add to the `knowledgeBase.detail` block (en.json **lines 710–736**), alongside the existing nested `versions` object, in **both** catalogs with real Arabic:

```
detail.locales.en          "English"
detail.locales.ar          "العربية"
detail.translations.heading
detail.translations.titleLabel
detail.translations.bodyLabel
detail.translations.none
detail.translations.save
detail.translations.saving
detail.translations.saveSuccess
detail.translations.saveFailed
detail.translations.loadError
```

For `detail.locales.ar` use the native `"العربية"` in **both** catalogs — a language name is written in its own language, exactly as `workspace.languageSwitcher.options.ar` already does.

### 5 — Backend

**No backend changes required.** Do not touch the controller, service, DTO, Prisma schema, permissions, `applyLocale`, or any API test.

---

## Edge Cases & Failure Modes

- **Existing tests must keep passing untouched.** 18 `it(...)` cases live in `article-detail-view.spec.tsx` (lines 98–419), several asserting on the body field and version rows that now sit inside `TabsContent value="en"`. Radix renders only the active panel, so `defaultValue="en"` is what keeps them green. If any existing test breaks, fix the component — **do not weaken the assertion**.
- **`GET` returns `[]`, never 404, for an article with no translations.** Treat `[]` as empty, never as an error. Enforced by the e2e case at `knowledge-base.e2e-spec.ts` line ~486.
- **Unordered array of at most two.** `listArticleTranslations` does a plain `findMany` with no `orderBy` (service line 357). Find by `locale === "AR"`; never rely on index 0.
- **Wholesale replace.** `PUT` upserts both columns. A save with an untouched title and an edited body still sends both — that is correct, not a bug.
- **Empty-field submission.** Backend rejects with 400 via `@MinLength(1)`. Prevent it client-side by disabling Save; do not rely on the 400.
- **Whitespace-only input.** `"   "` passes `@MinLength(1)` server-side but is meaningless. Trim before the emptiness check **and** before sending.
- **403 from `kb:update`.** A role with `kb:read` but not `kb:update` can open the Arabic tab and load translations but cannot save. The save error must map to `detail.actionForbidden` through `errorMessage()`.
- **Invalid locale segment.** Not reachable from this UI — the locale is a hard-coded `"AR"`, never user input. The backend's `ParseEnumPipe` 400 is a defence-in-depth path this story does not exercise.
- **RTL correctness.** `Tabs` needs `dir` or arrow-key order is wrong in Arabic UI (`tabs.tsx` lines 16–17). Separately, the Arabic **content fields** need `dir="rtl"` regardless of the UI locale — an agent using the app in English still types Arabic into them. These are two distinct requirements; implement both.
- **Draft articles.** Translations can be set on a `DRAFT`. No publication workflow is added; the portal only serves published articles. No special handling.
- **Cache scope.** A translation save must **not** invalidate `articleQueryKey` or the `["knowledge-base-articles"]` prefix. Doing so would re-fetch the article list and version history for a change that cannot affect them.
- **Uncertainty, disclosed:** whether the Arabic body field should force `dir="rtl"` or use `dir="auto"` is not settled by any existing precedent in this repo — no field anywhere currently sets a content direction. The plan specifies `dir="rtl"` because the field's locale is known and fixed; if the executor finds a counter-precedent, report it rather than switching silently.

---

## Test Plan

**File: `apps/web/src/components/knowledge-base/article-detail-view.spec.tsx`**

Extend the existing `vi.mock("@/hooks/use-knowledge-base", ...)` factory (spec lines 24–28) with `useArticleTranslationsQuery` and `useSetArticleTranslationMutation`. Reuse the existing `queryResult()` helper (lines 42–50) and add an idle-mutation helper mirroring `ticket-list-view.spec.tsx`'s own `idleMutation()`. Every existing mock and fixture stays as-is.

1. **Unit — English unchanged.** All 18 existing `it(...)` cases pass **without modification**. This is the load-bearing regression check.
2. **Unit — tabs render.** Both `English` and `Arabic` triggers are present; the English panel is active by default.
3. **Unit — switch to Arabic.** Clicking the Arabic trigger reveals the translation editor and the translations query is consumed.
4. **Unit — loading.** `isLoading: true` renders a skeleton (`container.querySelector(".animate-pulse")`, the assertion style used at spec lines 98–105).
5. **Unit — no AR translation.** `data: []` renders empty fields and `detail.translations.none`, and **not** the error alert.
6. **Unit — existing AR translation.** `data: [{ locale: "AR", title: "عنوان", body: "نص", ... }]` prefills both fields.
7. **Unit — save sends both fields together.** Edit both, click Save, assert the mutation was called once with exactly `{ title, body }`.
8. **Unit — Save disabled.** Disabled while `isPending`, and disabled when either field is empty or whitespace-only.
9. **Unit — save error.** `isError` with a non-403 renders the destructive alert via `detail.translations.saveFailed`.
10. **Unit — forbidden mapping.** `isError` with `new ApiError(403, ...)` maps to `detail.actionForbidden` — mirror the existing 403 test at spec lines 333–348, which already imports `ApiError`.
11. **Unit — read error.** Translations query `isError` renders the destructive alert.
12. **Unit — switch back to English.** The base title/body still render the base article's content, unaffected by Arabic edits.
13. **Regression — no new spec files needed** for the hooks or client: they are thin wrappers over `apiFetch`, matching `listArticleVersions`, which has no dedicated spec either.
14. **Regression suites:** `article-list-view.spec.tsx`, `create-article-view.spec.tsx`, and the portal KB specs (`apps/portal/src/components/knowledge-base/*.spec.tsx`) must stay green untouched.

**No E2E is required.** Every behaviour above is a component concern, and the backend contract is already covered by `apps/api/test/knowledge-base.e2e-spec.ts` lines 447–545. **Do not add Docker as a verification dependency.**

---

## Verification Steps

1. **Baseline first:** from the repo root, `pnpm --filter @crm/web test` — record the real current counts before changing anything rather than assuming a historical number.
2. **Frontend runs:** `pnpm --filter @crm/web test`
3. **Regression:** `pnpm --filter @crm/portal test` (the portal KB views read the same articles; they must be unaffected).
4. **Typecheck:** `pnpm typecheck`
5. **Lint:** `pnpm lint`
6. **Build:** `pnpm build`
7. **i18n parity:** compare the key paths of `apps/web/messages/en.json` and `apps/web/messages/ar.json` — **0** keys missing in either direction, and no new `ar` value left as its English text (`detail.locales.ar` being `"العربية"` in both is the one intended exception, matching `workspace.languageSwitcher.options.ar`).
8. **No physical-direction regressions:** `grep -rnE '\b(ml|mr|pl|pr|text-left|text-right)-[0-9a-z]+' apps/web/src --include=*.tsx` — no **new** occurrences versus `ec4ce8d`. Note `dir="rtl"` is an HTML attribute, not a Tailwind physical utility, and is expected here.
9. **Backend untouched:** `git status --short -- apps/api packages` must be empty.
10. **Scope containment:** `git diff --stat` must list only the six expected files:
    - apps/web/src/lib/knowledge-base-api.ts
    - apps/web/src/hooks/use-knowledge-base.ts
    - apps/web/src/components/knowledge-base/article-detail-view.tsx
    - apps/web/src/components/knowledge-base/article-detail-view.spec.tsx
    - apps/web/messages/en.json
    - apps/web/messages/ar.json

---

## Done Criteria

- [ ] `ArticleDetailView` renders **English** and **Arabic** tabs using the existing shared `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`; **no new primitive** is added.
- [ ] `<Tabs>` receives `dir={localeDirection(locale)}`, matching `settings-view.tsx` lines 45–60.
- [ ] The English tab's editor is behaviourally unchanged: title/body blur-commit with revert-on-error, category `Select`, publish/unpublish + `ConfirmDialog`, `AttachmentsCard`, and `ArticleVersionHistory` all behave exactly as before.
- [ ] The article title `Input`, status badge and publish controls remain **outside** the tabs.
- [ ] Switching to Arabic reads translations via `GET /knowledge-base/articles/:id/translations`.
- [ ] A `Skeleton` renders while the translations query loads.
- [ ] A read failure renders `<Alert variant="destructive">` through `errorMessage()`.
- [ ] An existing AR translation prefills `title` and `body`.
- [ ] `[]` renders empty fields plus a short "no Arabic translation yet" line — **not** an error.
- [ ] An explicit **Save** sends `{ title, body }` **together** to `PUT /knowledge-base/articles/:id/translations/AR`.
- [ ] Save is disabled while pending and while either field is empty or whitespace-only.
- [ ] A successful save invalidates **only** `articleTranslationsQueryKey(articleId)`.
- [ ] A successful save fires `showSuccessToast`.
- [ ] A save failure renders the destructive `Alert`, with 403 mapped to the existing `detail.actionForbidden`.
- [ ] The Arabic `title` and `body` fields render with `dir="rtl"`; the body uses the shared `Textarea`.
- [ ] `articleTranslationsQueryKey` is rooted independently (`["knowledge-base-article-translations", id]`), not nested under `["knowledge-base-articles", ...]`.
- [ ] Saving a translation does not invalidate `articleQueryKey` or the article list prefix.
- [ ] No new permission; `kb:read`/`kb:update` reused.
- [ ] No file under `apps/api` or `packages` is modified; no DTO, Prisma model, `KbLocale`, or `applyLocale` change.
- [ ] No portal file is modified.
- [ ] New copy exists in **both** `en.json` and `ar.json` with real Arabic; web i18n parity stays at 0 missing keys either direction.
- [ ] All 18 pre-existing `article-detail-view.spec.tsx` cases pass **unmodified**.
- [ ] New tests cover: tabs render, switch to Arabic, loading, no translation, existing translation, save sends both fields, Save disabled states, save error, forbidden mapping, read error, switch back to English.
- [ ] Web and portal suites green; typecheck, lint and build green.
- [ ] No Docker required for any verification step.
