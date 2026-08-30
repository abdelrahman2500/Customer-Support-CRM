# Feature overview — Knowledge Base Article Version History

## Why this feature, why now

`docs/architecture/08-supporting-domains.md` states the intended Knowledge
Base design plainly: *"`knowledge_base.articles` has categories/tags,
draft/published workflow, and versioning; publishing creates a new version
rather than mutating published content."* Story 51 (Knowledge Base
Foundation) explicitly deferred this, in its own plan's Design item 5 and
Non-Goals: *"`publishedAt` is a plain last-transition timestamp, not a
version history... a simple, disclosed deviation from 'publishing creates a
new version,' which is out of scope... 'publishing creates a new version'
per `docs/architecture/08-supporting-domains.md` is a future,
separately-planned story."* Story 64 (Article Search) closed the other
disclosed Story 51 gap (full-text search). This story closes the
versioning gap.

## Recon — why this and not something else

- **Communication/Channels, Integrations**: still genuinely blocked — no
  email/SMS/WhatsApp provider or ERP has been named anywhere in the
  repository (`docs/architecture/09-integrations.md`'s own "ERP...remain
  open until a future story names them"). Not eligible per `CLAUDE.md` §2.
- **AI Services**: the *vendor* is already decided in
  `docs/architecture/12-risks-tradeoffs-and-scope.md` ("AI vendor —
  Anthropic Claude behind `AiProvider`"), but no working Anthropic API
  credential exists anywhere in this repository's env configuration (only
  `.squad/secrets.yaml`'s own `anthropicOauthToken` exists, which is
  squad-kit's own tooling credential, not an application secret, and must
  never be repurposed as one — `CLAUDE.md` §6 already treats
  `.squad/secrets.yaml` as never-stage-able). Since the entire value of
  this domain is calling a real LLM, and `CLAUDE.md` §5 requires real
  verification (not fabricated passes), building `AiModule` without ever
  being able to exercise it against the real provider even once is the
  same class of "required external credential... that cannot be inferred
  safely" blocker `CLAUDE.md` §9.B names for Channels. Deferred, not
  selected, until a real `ANTHROPIC_API_KEY` (or equivalent) is added to
  this repository's own `apps/api` env configuration.
- **Reporting & Analytics**: already covers every dimension
  `docs/architecture/08-supporting-domains.md` names — ticket volume
  (Story 56), SLA compliance (Story 56), CSAT (Story 56), agent
  performance (Story 59), ticket aging (Story 60). Selecting a further
  Reporting story now would mean inventing an undocumented dimension,
  which `CLAUDE.md` §2 explicitly warns against.
- **Administration**: audit logs (Story 37) and branding (Story 62) are
  both shipped; no further "system configuration" gap is named concretely
  enough anywhere in the architecture docs to implement without guessing
  scope.
- **Knowledge Base — Article Version History**: concretely named,
  explicitly deferred (not silently missing), requires no external
  decision or credential, extends an existing module's existing boundary
  (no new module), and is comparably sized to Stories 51/64. Selected.

## Scope

A **foundation** slice, mirroring Story 51/64's own restraint:

- Every time an article is published (`status` transitions to
  `PUBLISHED` in `PATCH /knowledge-base/articles/:id`, including a
  re-publish after further edits), the exact content becoming live
  (title/body/category, post-merge with whatever else the same request
  changed) is snapshotted into a new, immutable `KnowledgeBaseArticleVersion`
  row before the live article row is updated.
- A new read-only endpoint lists an article's version history, newest
  first.
- Agent Workspace gets a read-only "Version History" section on the
  existing article detail/edit view.

**Not in scope** (mirrors Story 51/64's own non-goal discipline): no
restore/rollback-to-version mutation (a real feature, but a separate design
question — does restoring itself create a new version? can a DRAFT-only
edit be restored? — deferred to its own future story once this read-only
foundation exists to build on); no diffing/highlighting between versions;
no versioning of DRAFT-only edits (only a `PUBLISHED` transition creates a
version, matching the architecture doc's own exact phrase, "publishing
creates a new version"); no Customer Portal exposure (the portal already
only ever sees the single current published row — unchanged); no new
permission (reuses `kb:read`).

## Dependencies

- `knowledge-base-foundation` (Story 51): `KnowledgeBaseArticle`,
  `KnowledgeBaseController`/`KnowledgeBaseService`, the exact `updateArticle`
  publish-transition branch this story extends.

No other domain depends on this story.
