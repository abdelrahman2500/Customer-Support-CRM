# add-arabic-locale-tab-editing-for-knowledge-base-articles — plan overview

Entry point for the **add-arabic-locale-tab-editing-for-knowledge-base-articles** feature. Stories execute in order by their `NN` prefix.

Story 109 shipped the Knowledge Base translation backend in full — `PUT /knowledge-base/articles/:id/translations/:locale`, `GET /knowledge-base/articles/:id/translations`, the `KnowledgeBaseArticleTranslation` model, and locale resolution with base-content fallback — and deliberately stopped short of an authoring UI. A repo-wide search for `translations` across `apps/web/src` and `apps/portal/src` returns **zero** hits: no API client function, no hook, no component. This feature closes that gap, frontend-only.

## Stories

| NN  | File | Title | Tracker id | Depends on |
|-----|------|-------|------------|------------|
| 137 | [137-story-add-arabic-locale-tab-editing-for-knowledge-base-articles.md](./137-story-add-arabic-locale-tab-editing-for-knowledge-base-articles.md) | Add Arabic locale-tab editing for Knowledge Base articles — English/Arabic tabs on `ArticleDetailView` using the existing shared `Tabs`; the Arabic tab reads the article's translations and writes the `AR` `title`/`body` through an explicit Save. Adds the missing API client functions, a separately-rooted translations query key, and its query/mutation hooks. No backend change. | — | Story 109 (`kb-multi-locale`) |

## Dependency notes

- **Depends on Story 109** ([../kb-multi-locale/109-story-kb-multi-locale.md](../kb-multi-locale/109-story-kb-multi-locale.md)) for the entire contract. That story's own Non-goals name this one: *"A locale-tab editor is additive UX on an unchanged data model, appropriate for a later, separate story."* This is an invited follow-on, not a reopened decision.
- **Consumes the translation API read-only in contract terms** — the endpoints, `SetArticleTranslationDto`, the `KbLocale` enum, `kb:read`/`kb:update`, branch scoping and `applyLocale` fallback are all sufficient as they stand and are **not modified**. The backend behaviour is already pinned by `apps/api/test/knowledge-base.e2e-spec.ts` lines 447–545.
- **Reuses existing shared primitives only** — `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`, `Skeleton`, `Alert`, `Button`, `Input`, `Textarea`, `showSuccessToast`. **No new primitive is introduced.**
- **Follows two in-repo precedents:** `settings-view.tsx` (RM-23) is the app's only existing `Tabs` call site, including its required `dir={localeDirection(locale)}`; `branding-view.tsx` is the `showSuccessToast` precedent. Stories 65 and RM-28 are the precedents for appending a self-contained section to `ArticleDetailView` without touching the existing fields.

## Design decisions recorded during planning

- **Explicit Save for Arabic, blur-commit for English — deliberate, not inconsistency.** The base editor commits one field at a time because `PATCH /knowledge-base/articles/:id` accepts a partial body. `PUT …/translations/:locale` requires **both** `title` and `body` and replaces them wholesale (the e2e suite pins this: *"replaces the translation wholesale (upsert), not merge"*), so a per-field blur-commit would have to silently resend the other field.
- **The translations query key is rooted independently** (`["knowledge-base-article-translations", id]`), mirroring `articleVersionsQueryKey`'s own separate root. Nesting it under `["knowledge-base-articles", ...]` would make every unrelated article mutation invalidate it through the bare-prefix invalidation `useUpdateArticleMutation` already performs.
- **A translation save invalidates only the translations query.** A translation is a separate row and cannot change the base article's `title`/`body`/`status`, so invalidating the article or list keys would re-fetch content the mutation could not have altered.
- **The article title stays outside the tabs**, with the status badge and publish controls: it edits base article state, which is not locale-scoped, and moving it would break the existing blur-commit tests.
- **`defaultValue="en"`** is what keeps all 18 pre-existing `article-detail-view.spec.tsx` cases passing unmodified, since Radix renders only the active panel.
- **Two distinct RTL requirements:** `<Tabs dir=...>` for correct arrow-key order in Arabic UI, and `dir="rtl"` on the Arabic content fields regardless of UI locale — an agent using the app in English still types Arabic into them.

## Deliberately excluded

Arabic full-text search (Story 109 defers it as materially larger), per-locale versioning, locales beyond `EN`/`AR`, any portal change, translation import/export, bulk management across articles, machine translation, translation history, a translation publication workflow, new shared UI primitives, redesign of the English editor, migrating the raw `<textarea>`/`text-red-600` already present in `article-detail-view.tsx`, dark mode, and any Docker dependency for verification.
