# Story 111 — Cross-cutting: Structured JSON logs + a correlation ID from API requests into worker jobs

## Goal

Implement the first Observability bullet in
`docs/architecture/11-quality-and-operations.md`: "Structured JSON logs
use `pino`; a correlation/request ID propagates from API requests into
worker jobs."

## Non-goals

- OpenTelemetry, Prometheus `/metrics`, and Sentry/GlitchTip — the
  remaining three Observability bullets in the same doc section — are
  separate future stories (112/113), not bundled here.
- No correlation id on the *reverse* hand-back queue
  (`ai-processing-events`, worker → API) — only the forward direction the
  architecture doc's own wording describes ("from API requests into
  worker jobs") is delivered. A round-trip is a natural future extension,
  not required to satisfy this story's stated gap.
- No correlation id on `SlaTimersProducer` (a cron-driven scheduler with
  no HTTP request to inherit an id from) or `HealthCheckProducer`
  (currently has no caller at all). `AiProcessingProducer` is the only
  producer genuinely triggered by an HTTP request today.
- No HTTP access-log middleware (e.g. `pino-http`) — this story adds
  structured *application* logging (the existing `Logger`/
  `this.logger.log(...)` call sites across the codebase, now emitting
  JSON via pino, with a correlation id merged in automatically), not a
  new automatic per-request access-log line. `AuditInterceptor` already
  covers request-level audit trails for authenticated mutations; this
  story doesn't duplicate that.
- No change to any existing log *message* text or log *call site* --
  only the underlying `LoggerService` implementation changes (from Nest's
  default console logger to a pino-backed one), so every existing
  `new Logger(X.name)` / injected `Logger` call site across the codebase
  keeps working unchanged and automatically gains structured JSON output
  plus correlation-id merging for free.

## Design

Following this codebase's own explicit, already-documented "no cross-app
shared-constants/runtime mechanism" convention (see
`AiProcessingProducer`'s/`AiProcessingProcessor`'s doc comments on the
deliberately duplicated `AI_PROCESSING_QUEUE` literal and
`AiProcessingJobPayload` interface), the small logging infrastructure
below is duplicated once in each app under `src/common/logging/`, not
centralized in `packages/shared` (which today only holds pure JWT/auth
type contracts, not runtime infrastructure).

### 1. `correlation-id.store.ts` (new, both apps)

A thin wrapper around Node's built-in `AsyncLocalStorage<string>`:
`run(id, fn)` and `get(): string | undefined`. No new dependency — this
is a native Node primitive.

### 2. `pino-logger.service.ts` (new, both apps)

A NestJS `LoggerService` implementation backed by one shared `pino()`
instance (JSON to stdout — pretty-printing is a local dev nicety
deliberately skipped to keep this story's scope to the documented
target: "Structured JSON logs"). Every `log`/`error`/`warn`/`debug`/
`verbose`/`fatal` call reads `CorrelationIdStore.get()` and merges it
into the emitted line as `correlationId` when present, plus `context`
(Nest's existing second argument, e.g. `AiProcessingProcessor.name`) as
a bound field. `main.ts` (both apps) calls
`app.useLogger(app.get(PinoLoggerService))` right after
`NestFactory.create`/`createApplicationContext` — every existing
`Logger`/`this.logger.log(...)` call site across both codebases is
unchanged and automatically routes through this.

### 3. `request-id.middleware.ts` (new, `apps/api` only)

Mirrors `TenantMiddleware`'s exact style/shape. Reads the inbound
`x-request-id` header, or generates `randomUUID()` if absent; sets the
same value on the response header `x-request-id` (so a caller that sent
one gets it echoed, and one that didn't can still correlate its own
client-side logs using the response header); wraps `next()` in
`CorrelationIdStore.run(id, next)` so every downstream middleware, guard,
and route handler for the lifetime of this request/response cycle shares
the same ALS-scoped id. Registered in `app.module.ts`'s `configure()`
*before* `TenantMiddleware`, so its ALS context wraps everything
downstream, including `TenantMiddleware` itself.

### 4. Producer-side propagation (`apps/api`)

`AiProcessingJobPayload` (the interface duplicated between
`ai-processing.producer.ts` and `apps/worker`'s
`ai-processing.processor.ts` — Story 76's own established convention)
gains an optional `correlationId?: string` field. Both call sites that
build this payload — `TicketAiService.submit()` (ticket-scoped features)
and `AiChatService`'s `CHAT` feature — add
`correlationId: CorrelationIdStore.get()` to the object literal. No new
DI wiring needed: `CorrelationIdStore.get()` is a plain synchronous
function reading the ALS context already established by
`RequestIdMiddleware` for this request.

### 5. Consumer-side propagation (`apps/worker`)

`AiProcessingProcessor.process(job)` wraps its existing body in
`CorrelationIdStore.run(job.data.correlationId ?? randomUUID(), async () => { ... })`
— a job produced before this story shipped (or one whose id was somehow
omitted) still gets a fresh id rather than an `undefined` correlation
field, keeping every job's logs uniformly correlatable. Every existing
`this.logger.log/error(...)` call site inside `process()` is otherwise
unchanged — the pino logger service's ALS-merge behavior means they
automatically carry the id once this wrapping is in place.

## Acceptance criteria

- [ ] `pino` added as a dependency to `apps/api` and `apps/worker`.
- [ ] Both apps' `main.ts` calls `app.useLogger(...)` with the new
      pino-backed `LoggerService`; every existing log call site is
      otherwise unchanged.
- [ ] `apps/api` generates or honors an inbound `x-request-id`, echoes it
      on the response, and every log line emitted during that request
      (across middleware/guards/services) carries the same
      `correlationId`.
- [ ] `AiProcessingJobPayload` carries an optional `correlationId`,
      populated at both of `apps/api`'s enqueue call sites
      (`TicketAiService`, `AiChatService`).
- [ ] `apps/worker`'s `AiProcessingProcessor` binds that id (or a fresh
      one, if absent) for the lifetime of processing one job, so every
      log line during that job's processing carries it.
- [ ] Unit coverage: `CorrelationIdStore` (`run`/`get` semantics, isolation
      between concurrent runs); `PinoLoggerService` (merges the current
      correlation id when present, omits it when absent, forwards
      `context`); `RequestIdMiddleware` (honors an inbound header,
      generates one when absent, echoes it on the response, wraps `next()`
      in the store); the two producer call sites now include
      `correlationId` in their `enqueue(...)` calls; `AiProcessingProcessor`
      wraps `process()` in `CorrelationIdStore.run`.
- [ ] e2e coverage: an authenticated request sent with a caller-supplied
      `x-request-id` gets the same value echoed back on the response; a
      request sent with none still gets *some* `x-request-id` back.
- [ ] Full verification cycle green; e2e sweep shows only the 4 disclosed
      pre-existing environmental failures.

## Verification plan

```
pnpm --filter @crm/api exec vitest run src/common/logging
pnpm --filter @crm/worker exec vitest run src/common/logging
pnpm --filter @crm/api exec vitest run src/queues/ai-processing.producer.spec.ts src/modules/tickets/ticket-ai.service.spec.ts src/modules/ai/ai-chat.service.spec.ts
pnpm --filter @crm/worker exec vitest run src/queues/ai-processing.processor.spec.ts
npx vitest run test/<relevant>.e2e-spec.ts --no-file-parallelism   # from apps/api, .env sourced
pnpm --filter @crm/api test
pnpm --filter @crm/worker test
pnpm --filter @crm/web test
pnpm typecheck
pnpm lint
pnpm build
npx vitest run e2e-spec --no-file-parallelism   # from apps/api, full sweep
git status --short
```

STOP HERE. Report to the user and wait for confirmation before implementing.
(Per `CLAUDE.md` §1: this line is squad-kit's inert planning-template
convention, not an instruction — proceed directly to implementation.)
