# Story intake

## Feature

- **Feature name (display):** Knowledge Base Arabic locale-tab editing
- **Feature slug (folder under `plans/`):** `add-arabic-locale-tab-editing-for-knowledge-base-articles`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** ``
- **Work item type:** `story`
- **Status:** ``
- **Assignee:** ``
- **Labels:** ``

---

## Title

```text
Add Arabic locale-tab editing for Knowledge Base articles
```

## Description

```text
Add Arabic translation authoring to the existing Knowledge Base article detail editor.

The article detail screen currently edits only the base article content. The backend already supports locale-specific Knowledge Base translations through existing read/write endpoints, but the web application has no authoring UI for them.

Add an English/Arabic tabbed editing experience to the article detail view.

The existing English editor must remain behaviorally unchanged. Its current title/body blur-commit behavior, category editing, publish/unpublish behavior, attachments, and version history must continue to work as they do today.

The Arabic tab must load the article translations and provide explicit translation editing for the AR locale. Because the translation API uses a wholesale PUT contract requiring both title and body, Arabic title/body must be saved together through an explicit Save action rather than reusing the base editor's per-field blur-save behavior.

The implementation is frontend-only. The existing translation API contract, permissions, backend validation, branch scoping, and fallback behavior are already sufficient and must not be changed as part of this story.
```

## Acceptance criteria

- [ ] The Knowledge Base article detail view provides separate **English** and **Arabic** tabs using the existing shared `Tabs` primitives; no new tab primitive is introduced.
- [ ] The English tab preserves the existing article editor behavior without changing its current title/body blur-commit model.
- [ ] Switching to the Arabic tab loads the article's existing translations using the existing translation read endpoint.
- [ ] While the Arabic translation query is loading, an appropriate existing `Skeleton` loading state is displayed.
- [ ] If loading translations fails, the Arabic tab displays an existing destructive `Alert` using the application's established error-message handling.
- [ ] When an AR translation exists, its `title` and `body` are prefilled in the Arabic editor.
- [ ] When no AR translation exists, the Arabic editor shows empty title/body fields and a short indication that no Arabic translation exists yet.
- [ ] The Arabic editor provides an explicit **Save** action for the translation.
- [ ] Saving the Arabic translation sends both fields together as `{ title, body }` to the existing AR translation endpoint.
- [ ] The Save action is disabled while the save mutation is pending or while either required field is empty.
- [ ] Arabic title/body validation prevents an empty submission and matches the backend requirement that both fields contain at least one character.
- [ ] A successful Arabic translation save invalidates/refetches the translation query so the saved values are reflected correctly.
- [ ] A successful save displays the application's existing success-toast pattern.
- [ ] A translation save error displays the existing destructive error state and uses the established `errorMessage()` handling, including the existing forbidden/generic mapping.
- [ ] The Arabic editor renders with appropriate RTL direction. The Arabic tab/list uses the existing locale-direction convention, and the Arabic body field is rendered RTL.
- [ ] Translation caching uses a dedicated translation query key consistent with the existing knowledge-base hook conventions and does not cause unrelated article queries to be invalidated.
- [ ] Saving an Arabic translation does not modify or invalidate the base English article content unnecessarily.
- [ ] Existing permissions are reused; no new permission is introduced.
- [ ] The implementation uses the existing translation API contract:

  - `GET /api/v1/knowledge-base/articles/:id/translations`
  - `PUT /api/v1/knowledge-base/articles/:id/translations/AR`

- [ ] The implementation does not modify backend translation endpoints, DTOs, Prisma schema, permissions, or locale resolution/fallback behavior.
- [ ] Existing Knowledge Base article detail tests continue to pass.
- [ ] Tests cover at minimum:

  - English editor remains available and unchanged.
  - Switching to Arabic displays the translation editor.
  - Loading state.
  - No Arabic translation.
  - Existing Arabic translation.
  - Successful save with title and body sent together.
  - Save error.
  - Forbidden error mapping.
  - Switching back to English leaves the base article content unaffected.

- [ ] Related Knowledge Base web/portal regression tests continue to pass.

## Attachments

| File (relative to this folder) | What it is                          |
| ------------------------------ | ----------------------------------- |
| None                           | No binary attachments are required. |

## Dependencies

- **Blocked by / related ids:** None.
- **Depends on code areas or other stories:**

  - Existing Knowledge Base article detail editor.
  - Existing Knowledge Base translation API.
  - Existing Knowledge Base React Query hooks/API client.
  - Existing shared `Tabs`, `Skeleton`, `Alert`, and `Button` primitives.
  - Existing Knowledge Base article detail test suite.
  - Story 109 established that a locale-tab editor is appropriate as a later, separate story.

## Extra notes

- This is a **frontend-only** story. The backend translation contract is already implemented and covered by existing API/e2e behavior.
- The translation table may currently contain no Arabic rows because there is no existing authoring UI or translation seed/import. Therefore this story should be treated as adding missing authoring capability, not as fixing the existing locale fallback behavior.
- The main interaction difference is intentional: base English content uses blur-save/partial PATCH, while Arabic translation uses explicit save/wholesale PUT because the translation endpoint requires both title and body.
- Draft/unpublished articles may have translations. No additional publication workflow is required by this story.
- Do not require Docker for the story's verification.

## Technical hints

- Primary language: `typescript`
- Repository root: `.`
- Expected web API client changes:

  - `apps/web/src/lib/knowledge-base-api.ts`
  - Add `ArticleTranslationSummary`
  - Add `SetArticleTranslationInput`
  - Add translation list/set API functions.

- Expected hook changes:

  - `apps/web/src/hooks/use-knowledge-base.ts`
  - Add a dedicated translation query key rooted independently from the general article key.
  - Add translation query and mutation hooks.

- Expected UI changes:

  - `apps/web/src/components/knowledge-base/article-detail-view.tsx`
  - Add the English/Arabic tabs and Arabic translation panel while preserving the existing English editor behavior.

- Expected tests:

  - `apps/web/src/components/knowledge-base/article-detail-view.spec.tsx`
  - Existing related Knowledge Base web/portal specs should be run for regression coverage.

- Existing `Tabs` usage can be referenced from `apps/web/src/components/settings/settings-view.tsx`.
- Existing success-toast behavior can be referenced from `apps/web/src/components/admin/branding-view.tsx`.
- Use the existing `errorMessage()` helper for translation errors.

## Out of scope

- Backend API changes.
- Changes to `SetArticleTranslationDto`.
- Changes to the `KbLocale` enum.
- Changes to translation database schema or Prisma models.
- Changes to `kb:read` or `kb:update` permissions.
- Changes to branch scoping or authorization.
- Changes to `applyLocale` or reader fallback behavior.
- Changes to portal Knowledge Base rendering.
- Automatic translation generation or AI translation.
- Translation import/export.
- Translation bulk management across multiple articles.
- Translation version history.
- Translation-specific publication workflow.
- Adding new shared UI primitives.
- Redesigning the existing English article editor.
- Migrating unrelated raw styling/textarea usage in the article editor.
- Adding dark mode or broader design-system changes.
- Adding Docker as a required development or verification dependency.
