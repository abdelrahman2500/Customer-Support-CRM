# Story 54 — Customer Portal — Knowledge Base Browsing

## Prerequisites

- `knowledge-base-foundation` Story 51: `KnowledgeBaseArticle`, `KnowledgeBaseService`, `KnowledgeBaseModule` (exports `KnowledgeBaseService`).
- `customer-portal-authentication-foundation` Story 52: `PortalService`, `AudienceGuard`/`@PortalRoute()`, the JWT's `branchId` claim (already the Contact's Customer's branch).
- `customer-portal-ticket-submission-tracking` Story 53: `apps/portal`'s TanStack Query wiring, nav pattern.

---

## Story Goal

Let an authenticated portal Contact browse and read their branch's **published** Knowledge Base articles. Closes the "Knowledge Base browsing" line of `docs/architecture/08-supporting-domains.md`'s Customer Portal section, and gives Knowledge Base (Story 51) its second real consumer (`docs/architecture/03-domain-boundaries.md`: articles are "consumed by the agent app, customer portal, and AI layer").

**Not in scope**: full-text/vector search (Story 51's own disclosed deferral, untouched here); portal-side article authoring (agent-only, unchanged); CSAT/feedback (separate future story); draft article visibility of any kind.

---

## Context — Read These Files First

1. `apps/api/src/modules/knowledge-base/knowledge-base.service.ts` — `ArticleSummary`, `listArticles`/`getArticle`/`findArticleInScope` — the exact shape this story's new, additive, published-only methods mirror.
2. `apps/api/src/modules/knowledge-base/knowledge-base.module.ts` — confirms `KnowledgeBaseService` is already exported, so `PortalModule` can import `KnowledgeBaseModule` directly (same pattern Story 53 used for `TicketsModule`).
3. `apps/api/src/modules/portal/portal-tickets.controller.ts` — the exact `@PortalRoute()`/`request.user` pattern this story's new controller mirrors — but this story reads `branchId` straight off the JWT claims (no extra DB lookup needed, unlike Story 53's `customerId`, which isn't in the JWT).
4. `apps/web/src/components/knowledge-base/{article-list-view.tsx,article-detail-view.tsx}` — the agent-facing precedent (list/detail shape); this story's portal equivalents are read-only, simpler subsets (no edit controls, no publish toggle).
5. `apps/portal/src/components/tickets/{ticket-list-view.tsx,ticket-detail-view.tsx}` + `hooks/use-portal-tickets.ts` — the exact plain-HTML/Tailwind + TanStack Query conventions this story's portal KB screens/hooks mirror.

---

## Design decisions

1. **New, additive `KnowledgeBaseService` methods — the existing agent-facing methods are untouched.** `listPublishedArticlesForBranch(branchId)` and `getPublishedArticleForBranch(id, branchId)`, both filtering `status: "PUBLISHED"` — a draft article must 404 identically to a nonexistent or cross-branch one (never confirming it exists).
2. **Scope is the Contact's Customer's branch, read directly from the JWT's existing `branchId` claim** — no new controller-level contact lookup needed (Design item in `00-overview.md`).
3. **Ordering: `publishedAt` descending** (most-recently-published first) — the natural "what's new" order for a customer-facing browse list; every returned row is guaranteed `status: PUBLISHED`, so `publishedAt` is never null in this result set.
4. **No new module** — `PortalModule` imports `KnowledgeBaseModule` and a new `PortalKnowledgeBaseController` injects `KnowledgeBaseService` directly (no intermediate service layer needed, unlike Story 53's `PortalTicketsService`, since no contact-to-customerId resolution step is required here).
5. **Read-only frontend** — the portal's list/detail views have no edit/publish controls at all (unlike the agent's `ArticleDetailView`).

---

## Implementation Tasks

### Backend

1. **`apps/api/src/modules/knowledge-base/knowledge-base.service.ts`** — add (do not modify existing methods):
   - `listPublishedArticlesForBranch(branchId: string): Promise<ArticleSummary[]>` — `findMany({ where: { branchId, status: "PUBLISHED" }, orderBy: { publishedAt: "desc" } })`.
   - `getPublishedArticleForBranch(id: string, branchId: string): Promise<ArticleSummary>` — `findFirst({ where: { id, branchId, status: "PUBLISHED" } })`, 404 otherwise.
2. **New `apps/api/src/modules/portal/portal-knowledge-base.controller.ts`** — `@Controller("portal/knowledge-base/articles")`, both routes `@PortalRoute()`, reading `branchId` from `request.user`.
3. **`apps/api/src/modules/portal/portal.module.ts`** — `imports` gains `KnowledgeBaseModule`; `controllers` gains `PortalKnowledgeBaseController`.
4. **Tests** — see Test Plan.

### Frontend (`apps/portal`)

5. **`apps/portal/src/lib/knowledge-base-api.ts`** — `PortalArticleSummary`, `listPublishedArticles`/`getPublishedArticle`.
6. **`apps/portal/src/hooks/use-portal-knowledge-base.ts`** — `usePublishedArticlesQuery`/`usePublishedArticleQuery`.
7. **`apps/portal/src/components/knowledge-base/{article-list-view.tsx,article-detail-view.tsx}`** — read-only, mirror the ticket views' loading/error/empty/populated shape.
8. **`apps/portal/src/app/[locale]/(customer)/knowledge-base/{page.tsx,[id]/page.tsx}`**.
9. **`apps/portal/src/components/portal/portal-header.tsx`** — add a nav link to `/knowledge-base`.
10. **i18n** — new `apps/portal` `knowledgeBase` namespace, both locales.
11. **Tests** — see Test Plan.

---

## API contract

- `GET /portal/knowledge-base/articles` — `@PortalRoute()` — published articles for the caller's branch, `publishedAt` desc, `[]` if none.
- `GET /portal/knowledge-base/articles/:id` — `@PortalRoute()` — one published article; 404 for a draft, cross-branch, or nonexistent id, indistinguishable.

## Tests

**Backend unit** (extend `apps/api/src/modules/knowledge-base/knowledge-base.service.spec.ts`): `listPublishedArticlesForBranch` scopes/filters/orders correctly; `getPublishedArticleForBranch` 404s for a draft article in-branch, a published article in a different branch, and an unknown id.

**Backend e2e** (new `apps/api/test/portal-knowledge-base.e2e-spec.ts`): 401 without a token and for an agent-audience token; a draft article is invisible (404 + absent from the list) until published via the existing agent route; a published article appears in the list and its detail is fetchable; a published article belonging to a different branch's portal contact 404s.

**Frontend component** (`apps/portal`): loading/error/empty/populated states for both the list and detail views.

## Regression requirements

Every existing test suite remains green, unweakened — especially `knowledge-base.service.spec.ts`'s existing agent-facing tests (only additive methods) and every Story 51-53 test.

## Migration requirements

None — no schema change.

## Security risks/mitigations

- **No draft leakage**: every new query includes `status: "PUBLISHED"`; a 404 never distinguishes "exists but is a draft" from "exists in another branch" from "doesn't exist."
- **No new privilege surface**: reuses the existing `AudienceGuard`/`@PortalRoute()` mechanism; no RBAC key involved.

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

- [ ] `KnowledgeBaseService` gains two additive, published/branch-scoped methods; no existing method changed.
- [ ] `GET /portal/knowledge-base/articles[/​:id]` exist, gated by `@PortalRoute()`, never exposing a draft.
- [ ] `apps/portal` has a read-only KB list + detail view, reachable from nav.
- [ ] Both locales translated for every new string.
- [ ] All listed tests exist and pass; every pre-existing test remains green, unweakened.
- [ ] Typecheck/lint/build clean, workspace-wide; `git status --short` clean before commit.

---

## Non-Goals (explicit)

- Full-text/vector search; portal-side authoring; CSAT/feedback.
- Any README change.
