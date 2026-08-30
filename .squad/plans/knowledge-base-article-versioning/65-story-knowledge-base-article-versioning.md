# Story 65 — Knowledge Base — Article Version History (Foundation)

## Prerequisites

- `knowledge-base-foundation` Story 51: `KnowledgeBaseArticle`,
  `KnowledgeBaseController`/`KnowledgeBaseService`, `updateArticle`'s
  existing `status === "PUBLISHED"` branch (currently just stamps
  `publishedAt`).

---

## Story Goal

Whenever an article is published, snapshot the content becoming live into
an immutable version row, instead of that moment leaving no trace beyond
the single `publishedAt` timestamp. Closes the gap
`docs/architecture/08-supporting-domains.md` names directly: *"publishing
creates a new version rather than mutating published content"* — explicitly
deferred by Story 51's own plan ("a future, separately-planned story").

**Not in scope**: restore/rollback to a past version (a real mutation
surface with its own open design questions — deferred to a future story
once this read-only history exists to restore *from*); diffing/highlighting
between versions; versioning a `DRAFT`-only edit (only a transition to
`PUBLISHED` creates a version — matches the architecture doc's exact
phrase); Customer Portal exposure (unchanged: the portal only ever reads
the current live article row, exactly as today); any new permission (reuses
`kb:read`).

---

## Context — Read These Files First

1. `apps/api/prisma/schema.prisma` — `KnowledgeBaseArticle` model and its
   own doc comment disclosing "no multi-version publish history."
2. `apps/api/src/modules/knowledge-base/knowledge-base.service.ts` —
   `updateArticle`'s existing `dto.status === "PUBLISHED"` branch (the
   exact site this story extends) and `findArticleInScope` (the exact
   branch-scoping helper the new list method reuses).
3. `apps/api/src/modules/knowledge-base/knowledge-base.controller.ts` — the
   exact route-registration shape (`@Get`, `@RequirePermissions("kb:read")`)
   the new versions route mirrors.
4. `apps/web/src/components/knowledge-base/article-detail-view.tsx` — the
   exact detail view a read-only "Version History" section is appended to,
   no other behavior changed.

---

## Design decisions

1. **One new `KnowledgeBaseArticleVersion` model**, `knowledge_base` schema
   (same schema as `KnowledgeBaseArticle`) — `articleId` FK (cascade
   delete), `versionNumber` (`Int`, 1-based, per-article sequential),
   snapshotted `title`/`body`/`category`, `publishedAt` (the timestamp of
   *this* publish event — distinct from the live article's own mutable
   `publishedAt`), `createdAt`. `@@unique([articleId, versionNumber])`,
   `@@index([articleId])`.
2. **A version is created only inside `updateArticle`'s existing
   `dto.status === "PUBLISHED"` branch**, snapshotting the fully-merged
   post-update values (an agent may change `title`/`body`/`category` and
   publish in the same `PATCH` call — the version must capture what
   actually becomes live, not the stale pre-update row). `versionNumber` is
   `1 + (current max for this articleId, or 0)` — computed from the
   version table itself, not a counter column on the article (mirrors this
   codebase's existing preference for derived values over redundant
   counters, e.g. `AGE_BUCKET_LABELS` computed fresh each call rather than
   cached).
3. **No version on a plain content edit or on unpublishing** — only the
   transition *into* `PUBLISHED` creates a version, matching the
   architecture doc's own exact phrase ("publishing creates a new
   version"); toggling back to `DRAFT` remains exactly as Story 51 built it
   (no version, `publishedAt` left at its last value).
4. **One new read-only route, reusing `kb:read`** — `GET
   /knowledge-base/articles/:id/versions`, scoped through the same
   `findArticleInScope` branch/existence check `getArticle`/`updateArticle`
   already use (a 404 for an unknown/cross-branch article id, identical to
   every existing route on this controller).
5. **Frontend: a read-only list appended to the existing
   `ArticleDetailView`**, not a new route — mirrors how `TicketCsatSection`
   was appended to `TicketDetailView` in Story 55 rather than becoming its
   own page. No portal exposure (Non-Goal).

---

## Implementation Tasks

### Backend

1. **`apps/api/prisma/schema.prisma`** — new `KnowledgeBaseArticleVersion`
   model; add the reverse relation on `KnowledgeBaseArticle`.
2. **Migration** — `add_knowledge_base_article_versions`.
3. **`apps/api/src/modules/knowledge-base/knowledge-base.service.ts`**:
   - `updateArticle`: inside the existing `dto.status === "PUBLISHED"`
     branch, compute the merged post-update field values, look up the
     current max `versionNumber` for the article, and create the version
     row in the same operation (a `$transaction` with the article
     `update`, so a version is never created without the corresponding
     publish actually landing, or vice versa).
   - New `listArticleVersions(id: string): Promise<ArticleVersionSummary[]>`
     — reuses `findArticleInScope` for the 404/branch-scope guarantee,
     returns versions ordered `versionNumber desc`.
4. **`apps/api/src/modules/knowledge-base/knowledge-base.controller.ts`** —
   `GET :id/versions`, `@RequirePermissions("kb:read")`.
5. **Tests** — see Test Plan.

### Frontend

6. **`apps/web/src/lib/knowledge-base-api.ts`** — `ArticleVersionSummary`
   type; `listArticleVersions(articleId: string)`.
7. **`apps/web/src/hooks/use-knowledge-base.ts`** —
   `articleVersionsQueryKey(articleId)`; `useArticleVersionsQuery(articleId)`.
8. **`apps/web/src/components/knowledge-base/article-detail-view.tsx`** —
   a read-only "Version History" section below the existing fields:
   version number, publish timestamp, title; loading/error/empty states
   mirroring the view's own existing conventions.
9. **i18n** — `apps/web/messages/{en,ar}.json`:
   `knowledgeBase.detail.versions.title`/`empty`/`error`/`publishedAt`/`version`.
10. **Tests** — see Test Plan.

---

## API contract

- `GET /knowledge-base/articles/:id/versions` — `kb:read` — 404 for an
  unknown/cross-branch article id (identical to `GET :id`); `200` with `[]`
  for an article never published; otherwise version rows newest-first.
- No existing route's request/response shape changes.

## Tests

**Backend unit** (extend `knowledge-base.service.spec.ts`): publishing a
never-before-published article creates version `1` with the correct
(possibly same-call-merged) content; re-publishing after an edit creates
version `2` with the newly-edited content, not stale data; a plain
non-status update creates no version; unpublishing (`status: "DRAFT"`)
creates no version; `listArticleVersions` returns rows newest-first and
throws `NotFoundException` for an unknown/out-of-scope id, mirroring
`getArticle`'s own existing test.

**Backend e2e** (extend `knowledge-base.e2e-spec.ts`): publish → edit →
re-publish produces two versions with the expected snapshotted content and
sequential `versionNumber`; `GET :id/versions` on a never-published article
returns `[]`; 404 for an unknown article id; an Agent-role user without
`kb:read` gets 403 (mirrors the controller's existing permission test).

**Frontend component** (extend `article-detail-view.spec.tsx`): version
history section renders rows once the query succeeds; empty state when no
versions exist; every pre-existing `ArticleDetailView` test passes
unmodified (proves the addition is behavior-preserving by default).

## Regression requirements

Every existing test suite remains green, unweakened — especially every
pre-existing `knowledge-base.service.spec.ts` and `ArticleDetailView` test,
unmodified.

## Migration requirements

One new migration, additive only (`CREATE TABLE`, no column changes to
`knowledge_base_articles`).

## Security risks/mitigations

- **No new permission surface**: reuses `kb:read`.
- **No new injection surface**: plain typed Prisma reads/writes.
- **Branch scoping unchanged**: `listArticleVersions` reuses
  `findArticleInScope`'s exact existing branch-scope/404 guarantee — a
  version row is never reachable outside the parent article's own branch
  scope.
- **Data integrity**: the version row and the article's own `update` are
  written inside one `$transaction`, so a partial write (version created
  but article not updated, or vice versa) cannot occur.

## Verification commands

```
pnpm --filter @crm/api test
pnpm --filter @crm/api test:e2e
pnpm --filter @crm/web test
pnpm --filter @crm/portal test
pnpm typecheck
pnpm lint
pnpm build
git status --short
```

## Done criteria

- [ ] Publishing an article creates a version snapshot; re-publishing after
      an edit creates a further, correctly-sequenced version with the new
      content.
- [ ] A plain edit or an unpublish never creates a version.
- [ ] `GET /knowledge-base/articles/:id/versions` works, `kb:read`-gated,
      404s identically to `GET :id` for an unknown/cross-branch id.
- [ ] Agent Workspace shows a read-only Version History section on the
      article detail view.
- [ ] Both locales translated for every new string.
- [ ] All listed tests exist and pass; every pre-existing test remains
      green, unweakened.
- [ ] Typecheck/lint/build clean, workspace-wide; `git status --short`
      clean before commit.

---

## Non-Goals (explicit)

- Restore/rollback to a past version.
- Diffing/highlighting between versions.
- Versioning a `DRAFT`-only edit or an unpublish transition.
- Any Customer Portal (`apps/portal`) exposure.
- Any new permission key.
- Any README change.
