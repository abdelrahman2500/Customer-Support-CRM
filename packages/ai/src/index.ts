/**
 * `@crm/ai` — the framework-neutral AI provider boundary shared by
 * `apps/api` and `apps/worker`. Architecture-boundary refactor extracted
 * from `apps/api/src/modules/ai/` (Story 72) into this package so the
 * two apps depend on exactly one `AiProvider`/`AnthropicAiProvider`/
 * `NullAiProvider` definition instead of duplicating the Anthropic SDK
 * integration — see docs/architecture/02-system-architecture-
 * overview.md ("Shares domain/service code with apps/api via internal
 * packages so business logic is not duplicated").
 *
 * Deliberately contains ONLY the provider contract/implementations.
 * `AiGatewayService`, the `AI_PROVIDER` DI token, `AiModule`, ticket
 * authorization, and `AiPromptLog` persistence all remain in `apps/api`
 * (and, for the worker's own future job-processing wiring, in
 * `apps/worker`) — see each app's own module for that orchestration.
 * This package has no dependency on `@nestjs/*`, Prisma, `TenantContext`,
 * or any app code.
 */
export * from "./ai-provider.interface";
export * from "./types";
export * from "./anthropic-ai-provider";
export * from "./null-ai-provider";
