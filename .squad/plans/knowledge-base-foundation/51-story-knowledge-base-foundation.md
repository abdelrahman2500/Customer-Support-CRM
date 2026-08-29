# Story 51 — Knowledge Base Foundation (Agent Workspace Article Management)

## Prerequisites

- `project-foundation` Stories 01–05: `TenantContext`/`PermissionsGuard`/`RequirePermissions` conventions; the Prisma datasource already provisions `pgvector`/`pg_trgm` extensions anticipating this domain.
- `agent-workspace-sla-policy-admin` Story 31: the direct structural template — a standalone, branch-scoped aggregate root (not a ticket/customer sub-entity) with its own dedicated frontend API client/hooks file, list+create+inline-edit views, and an `isActive`-style toggle pattern.
- `agent-workspace-navigation-menu` Story 44: the `WorkspaceNav` fixed-order nav-item list this story appends to.

---

## Story Goal

Stand up the Knowledge Base domain's first real slice: agents can create, list, view, edit, and publish/unpublish free-text articles (title + body + optional category), scoped to their branch, gated by new `kb:*` permissions. This is the first implementation of any part of the Knowledge Base domain named in `docs/architecture/03-domain-boundaries.md` and gives the domain a real consumer (an Agent Workspace admin screen) rather than adding schema with nothing to use it.

**Not in scope**: full-text or vector search (`tsvector`/`pgvector` — the extensions already exist at the datasource level but are not consumed by this story); multi-version publish history (this story mutates one row in place; "publishing creates a new version" per `docs/architecture/08-supporting-domains.md` is a future, separately-planned story); Customer Portal consumption of any kind (`apps/portal` is untouched); AI Services grounding/retrieval; article deletion; attachments; tags (only a single plain-string `category`, mirroring `Ticket.category`'s own precedent).

---

## Context — Read These Files First

1. `apps/api/prisma/schema.prisma` — datasource `schemas` array (add `"knowledge_base"`); `Branch` model (add the new back-relation); `SlaPolicy` (lines ~326–344) as the closest existing "standalone branch-scoped aggregate root with an `isActive`-style toggle" precedent.
2. `apps/api/src/modules/sla-policies/{sla-policies.controller.ts,sla-policies.service.ts,sla-policies.module.ts,dto/*}` — the exact CRUD/permission/DTO pattern this story's `KnowledgeBaseModule` mirrors field-for-field.
3. `apps/api/prisma/seed.ts` — `PERMISSION_CATALOG`/`ROLE_GRANTS` (add `kb:create`/`kb:read`/`kb:update`, granted to `SuperAdmin` only, same as every existing key; `Agent` stays `[]`, unchanged).
4. `apps/api/src/app.module.ts` — module registration list (add `KnowledgeBaseModule`).
5. `apps/web/src/lib/sla-policies-api.ts` / `apps/web/src/hooks/use-sla-policies.ts` / `apps/web/src/components/sla-policies/{sla-policy-list-view.tsx,create-sla-policy-view.tsx}` (+ specs) — the exact frontend API-client/hooks/list/create pattern this story's KB screens mirror.
6. `apps/web/src/components/workspace/workspace-nav.tsx` (+ spec) — the fixed `NAV_ITEMS` list (append one new entry).
7. `apps/web/src/app/[locale]/(agent)/sla-policies/{page.tsx,new/page.tsx}` — the route-file convention this story's `knowledge-base` routes mirror.
8. `apps/web/messages/{en,ar}.json` — `slaPolicies` namespace as the closest existing shape to mirror for the new `knowledgeBase` namespace.

---

## Design decisions

1. **New Postgres schema `knowledge_base`**, added to the Prisma datasource `schemas` array — the first table to actually use it (previously only reserved by `docs/architecture/03-domain-boundaries.md`).
2. **`KnowledgeBaseArticle`: branch-scoped aggregate root**, mirroring `SlaPolicy`'s exact shape — own `branchId`, no parent entity, no cross-domain FK. `category` is a plain nullable `String` (not a lookup table), mirroring `Ticket.category`'s own precedent — no story has justified a `Category` model yet.
3. **Status is a two-value enum (`DRAFT`/`PUBLISHED`), not a boolean**, since "draft/published workflow" is named explicitly in `docs/architecture/08-supporting-domains.md` and a third state (e.g. archived) is not evidenced anywhere — a boolean would under-model the domain, an open-ended string would over-model it for what's evidenced today.
4. **No separate `/publish` route** — `status` (along with `title`/`body`/`category`) is just another field on the general `PATCH /knowledge-base/articles/:id`, mirroring `UpdateSlaPolicyDto.isActive`'s "toggle via the general update endpoint" convention exactly, rather than inventing a dedicated action endpoint with no other precedent in this codebase.
5. **`publishedAt` is a plain last-transition timestamp, not a version history.** Set to `now()` whenever an update's `status` is `PUBLISHED` (including re-publishing after an edit); left as its last value (not cleared) when `status` is set back to `DRAFT` — a simple, disclosed deviation from "publishing creates a new version," which is out of scope (see Story Goal).
6. **Permissions: three new keys, `kb:create`/`kb:read`/`kb:update`**, added to the existing flat `PERMISSION_CATALOG`/`ROLE_GRANTS` mechanism in `prisma/seed.ts` exactly like every prior domain — granted to `SuperAdmin` only by seed; a deployment grants `Agent` (or any other role) access via the already-existing Role & Permission Management screen (`agent-workspace-role-permission-management` Story 46), the same as `ticket:*`/`sla:*`/`customer:*` today. No delete route exists, so no `kb:delete` key.
7. **No domain event, no realtime.** No other domain subscribes to KB changes yet (Customer Portal and AI Services, KB's only named future consumers, do not exist), so emitting one now would be infrastructure without a real consumer — the same restraint `sla-policy-foundation` Story 10 exercised for its own first story.
8. **Frontend: a dedicated `knowledge-base-api.ts`/`use-knowledge-base.ts` pair**, not folded into `tickets-api.ts`/`use-tickets.ts` — mirrors `sla-policies-api.ts`'s own Story 31 precedent (a distinct domain with no forcing reason to share a file).
9. **New nav entry `Knowledge Base`**, appended as the new last item in `WorkspaceNav`'s fixed `NAV_ITEMS` list (Story 44's own append convention) — no client-side permission gating, consistent with every existing item (`docs/architecture` names no such pattern; a session lacking `kb:read` sees the list screen's own 403 state after navigating, exactly like every other screen today).
10. **List + create + detail/edit views**, mirroring `SlaPolicyListView`/`CreateSlaPolicyView` exactly: list shows title/category/status/updatedAt with a status-toggle button (mirrors `isActive` toggle); create is a small dedicated route (`/knowledge-base/new`); a detail/edit route (`/knowledge-base/:id`) lets an agent edit title/body/category inline (blur-commit, mirroring `SlaPolicyRow`) and toggle publish state — the smallest surface covering create/list/edit/publish without inventing a new UI pattern.

---

## Implementation Tasks

### Backend

1. **`apps/api/prisma/schema.prisma`**:
   - Add `"knowledge_base"` to the datasource `schemas` array.
   - Add `knowledgeBaseArticles KnowledgeBaseArticle[]` to the `Branch` model's relation list.
   - Add:
     ```prisma
     enum KnowledgeBaseArticleStatus {
       DRAFT
       PUBLISHED

       @@schema("knowledge_base")
     }

     /// See docs/architecture/03-domain-boundaries.md ("Knowledge Base") and
     /// docs/architecture/08-supporting-domains.md. Story 51 — foundation
     /// only: branch-scoped CRUD with a draft/published toggle. No
     /// full-text/vector search consumption (the pgvector/pg_trgm
     /// extensions already exist at the datasource level, unused by this
     /// story), no multi-version publish history (`publishedAt` is a plain
     /// last-transition timestamp, overwritten on every re-publish — see
     /// the plan's Design item 5), no Customer Portal or AI consumption yet.
     model KnowledgeBaseArticle {
       id          String                     @id @default(uuid())
       branchId    String                     @map("branch_id")
       branch      Branch                     @relation(fields: [branchId], references: [id])
       title       String
       body        String
       category    String?
       status      KnowledgeBaseArticleStatus @default(DRAFT)
       publishedAt DateTime?                  @map("published_at")
       createdAt   DateTime                   @default(now()) @map("created_at")
       updatedAt   DateTime                   @updatedAt @map("updated_at")

       @@index([branchId])
       @@map("knowledge_base_articles")
       @@schema("knowledge_base")
     }
     ```
2. **Migration** — generated via `prisma migrate dev` against the real local Postgres (confirmed reachable this session), hand-authored/diff-verified only if Docker/Postgres is unreachable at implementation time.
3. **`apps/api/prisma/seed.ts`** — add `"kb:create"`, `"kb:read"`, `"kb:update"` to `PERMISSION_CATALOG`; `SuperAdmin: PERMISSION_CATALOG` already picks them up automatically; `Agent: []` unchanged.
4. **New `apps/api/src/modules/knowledge-base/`**:
   - `dto/create-article.dto.ts`: `title` (`@IsString() @MinLength(1)`), `body` (`@IsString() @MinLength(1)`), `category?` (`@IsOptional() @IsString()`).
   - `dto/update-article.dto.ts`: all of the above as optional, plus `status?` (`@IsOptional() @IsEnum(KnowledgeBaseArticleStatus)`).
   - `knowledge-base.service.ts`: `ArticleSummary` interface (`id`, `branchId`, `title`, `body`, `category`, `status`, `publishedAt`, `createdAt`, `updatedAt`); `createArticle`, `listArticles` (branch-scoped, `orderBy: { updatedAt: "desc" }` — most-recently-touched first, the natural order for a content-admin list, unlike `SlaPolicy`'s `createdAt asc`), `getArticle`/`findArticleInScope` (mirrors `findSlaPolicyInScope`), `updateArticle` (sets `publishedAt: new Date()` whenever `dto.status === "PUBLISHED"`, leaves it untouched otherwise).
   - `knowledge-base.controller.ts`: `@Controller("knowledge-base/articles")`; `POST` (`kb:create`), `GET` list + `GET :id` + `PATCH :id` (`kb:read`/`kb:read`/`kb:update`).
   - `knowledge-base.module.ts`: registers the controller/service + `TenantContext`, exports the service (mirrors `SlaPoliciesModule`).
5. **`apps/api/src/app.module.ts`** — import and register `KnowledgeBaseModule`.
6. **Tests** — see Test Plan.

### Frontend

7. **`apps/web/src/lib/knowledge-base-api.ts`** — `ArticleStatus` type, `ArticleSummary` interface (mirrors the backend exactly), `listArticles`/`getArticle`/`createArticle`/`updateArticle`, `CreateArticleInput`/`UpdateArticleInput`.
8. **`apps/web/src/hooks/use-knowledge-base.ts`** — `articlesQueryKey`/`articleQueryKey`, `useArticlesQuery`/`useArticleQuery`, `useCreateArticleMutation`/`useUpdateArticleMutation` (never-optimistic, mirrors `use-sla-policies.ts` exactly).
9. **`apps/web/src/components/knowledge-base/article-list-view.tsx`** (+ spec) — mirrors `SlaPolicyListView` exactly: loading/error/empty/populated, a row per article (title, category, status badge, updatedAt), publish/unpublish toggle button.
10. **`apps/web/src/components/knowledge-base/create-article-view.tsx`** (+ spec) — mirrors `CreateSlaPolicyView`: title/body/category fields, submit disabled until title+body non-empty, backend-message-or-fallback error, navigates to the list on success.
11. **`apps/web/src/components/knowledge-base/article-detail-view.tsx`** (+ spec) — a new view (no exact single-file precedent, composed from existing patterns): loading/error/not-found states mirroring `TicketDetailView`; editable title/body/category (blur-commit, mirrors `SlaPolicyRow`); a publish/unpublish toggle button (mirrors the SLA row's activate/deactivate button).
12. **`apps/web/src/app/[locale]/(agent)/knowledge-base/{page.tsx,new/page.tsx,[id]/page.tsx}`** — thin route files mirroring the `sla-policies` route files exactly.
13. **`apps/web/src/components/workspace/workspace-nav.tsx`** (+ spec) — append `{ href: "knowledge-base", labelKey: "nav.knowledgeBase" }` as the new last `NAV_ITEMS` entry.
14. **i18n** — new top-level `knowledgeBase` namespace (`list.*`, `create.*`, `detail.*`) plus `workspace.nav.knowledgeBase`, in both `en.json`/`ar.json`.
15. **Tests** — see Test Plan.

---

## API contract

- `POST /knowledge-base/articles` — `kb:create` — body `{ title, body, category? }` — creates a `DRAFT` article, returns `ArticleSummary`.
- `GET /knowledge-base/articles` — `kb:read` — returns `ArticleSummary[]` for the caller's branch, all statuses, ordered `updatedAt` desc, `[]` if none.
- `GET /knowledge-base/articles/:id` — `kb:read` — returns `ArticleSummary`; 404 for out-of-branch/nonexistent.
- `PATCH /knowledge-base/articles/:id` — `kb:update` — body: any of `title`/`body`/`category`/`status`; returns `{ id }`; 404 for out-of-branch/nonexistent; 400 for an invalid `status` enum value or an empty `title`/`body` if provided.

## Authorization / tenant-scoping rules

Identical mechanism to `SlaPoliciesService`: `TenantContext.requireBranchScope()` + `prisma.knowledgeBaseArticle.findFirst({ id, branchId })` inside `findArticleInScope`, 404-masking both "doesn't exist" and "exists in another branch."

## Tests

**Backend unit** (`knowledge-base.service.spec.ts`, mirrors `sla-policies.service.spec.ts`'s mock-`TenantContext`/mock-Prisma shape):
- `createArticle`: creates with `status: DRAFT` by default, scoped to the caller's branch.
- `listArticles`: scopes to branch, orders `updatedAt desc`, returns `[]` for none.
- `getArticle`/`updateArticle`: 404 for an out-of-branch/unknown id.
- `updateArticle`: only includes DTO-provided fields in the `update` call; sets `publishedAt` to a new `Date` only when `status: "PUBLISHED"` is included; leaves `publishedAt` untouched when `status` is omitted or `"DRAFT"`.

**Backend e2e** (`knowledge-base.e2e-spec.ts`, mirrors `tickets.e2e-spec.ts`'s self-contained-fixture/401-403 recipe):
- 401 for all four routes.
- 403 for an Agent-role user (lacks `kb:*`) on all four routes.
- Full lifecycle: create (DRAFT) → list includes it → get → update title/body/category → publish (`status: "PUBLISHED"`, `publishedAt` becomes non-null) → unpublish (`status: "DRAFT"`).
- 404 for an unknown/cross-branch article id (all four routes).
- 400 for an empty `title`/`body` on create, and for an invalid `status` value on update.

**Frontend component**:
- `article-list-view.spec.tsx`: loading/error/empty/populated, publish/unpublish toggle call, 403-vs-generic mutation error, navigate-to-create.
- `create-article-view.spec.tsx`: disabled-until-title-and-body-non-empty, exact payload, backend-message-or-fallback error, navigate-to-list on success.
- `article-detail-view.spec.tsx`: loading/not-found/error/populated, blur-commit edits, publish/unpublish toggle.
- `workspace-nav.spec.tsx`: extend `EXPECTED_LINKS` with the new Knowledge Base entry.

## Regression requirements

Every pre-existing test suite (backend unit/e2e, frontend) remains green, unmodified except the additive `workspace-nav.spec.tsx` link-list extension.

## Migration requirements

One new migration: `CREATE SCHEMA IF NOT EXISTS "knowledge_base"`, the new enum, and the new `knowledge_base_articles` table with its `branch_id` FK/index. No existing table altered.

## Edge cases

- An article with an empty `category` → stored as `null`, rendered via a placeholder (mirrors `SlaPolicy.category`).
- Publishing an already-published article (re-publish after an edit) → `publishedAt` is refreshed to the current time, not left at its original value.
- Unpublishing (`status: "DRAFT"`) → `publishedAt` is left at its last value, not cleared (Design item 5).
- Zero articles for a branch → list returns `[]`, not an error or 404.

## Security risks/mitigations

- **New privilege surface, narrowly scoped**: three new permission keys, gated the same way as every existing domain; `SuperAdmin` gets them via the catalog, `Agent`/other roles get nothing until an admin explicitly grants them via the existing Role & Permission Management screen.
- **Cross-branch leak prevention**: identical `findArticleInScope` mechanism as every other branch-scoped aggregate root; a foreign article id 404s exactly like every sibling endpoint.

## Verification commands

```
pnpm --filter @crm/api test
pnpm --filter @crm/api test:e2e
pnpm --filter @crm/web test
pnpm typecheck
pnpm lint
pnpm build
git status --short
```

Re-confirm the CURRENT baseline pass counts directly before adding new tests (do not assume the Story 50 baseline holds verbatim).

## Done criteria

- [ ] `KnowledgeBaseArticle` model + `knowledge_base` schema exist; migration applied.
- [ ] `POST/GET/GET :id/PATCH :id /knowledge-base/articles` exist, gated by new `kb:create`/`kb:read`/`kb:update` (granted to `SuperAdmin` only by seed).
- [ ] No delete route; no full-text/vector search; no version-history table; no Customer Portal/AI code touched.
- [ ] Agent Workspace gets a new "Knowledge Base" nav item + list/create/detail-edit screens with correct loading/error/empty/populated states and a working publish/unpublish toggle.
- [ ] Both locales translated for every new string.
- [ ] All listed tests exist and pass; every pre-existing test remains green, unweakened.
- [ ] Typecheck/lint/build clean, workspace-wide; `git status --short` clean (not yet committed).

---

## Non-Goals (explicit)

- Full-text (`tsvector`) or vector (`pgvector`) article search.
- Multi-version publish history; article deletion; attachments; tags/multi-category.
- Any Customer Portal (`apps/portal`) or AI Services code.
- Any Communication/Channels, Reporting, or Integrations code.
- Any README change.

---

## Dependencies

See Prerequisites. Hard sequencing: schema/migration → service/controller/permissions → frontend, in that order.

## Known blockers

None known at plan time — Docker/Postgres was confirmed reachable in the prior story's session.
