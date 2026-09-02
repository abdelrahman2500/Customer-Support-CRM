import { NodeSDK } from "@opentelemetry/sdk-node";
import { IORedisInstrumentation } from "@opentelemetry/instrumentation-ioredis";
import { PrismaInstrumentation } from "@prisma/instrumentation";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

/**
 * Story 112 — docs/architecture/11-quality-and-operations.md: "OpenTelemetry
 * instruments HTTP, Prisma, and BullMQ and exports to self-hostable Grafana
 * Tempo by default." Imported as `main.ts`'s very first line (before even
 * `reflect-metadata`) so every instrumented module (`ioredis`,
 * `@prisma/client`) is patched before anything else `require`s it. No
 * `HttpInstrumentation` here — `apps/worker` has no HTTP listener at all
 * (`NestFactory.createApplicationContext`, see `main.ts`'s own doc
 * comment).
 *
 * Must stay behaviorally aligned with `apps/api/src/tracing.ts`
 * (deliberately duplicated — see this repo's own "no cross-app shared-
 * runtime mechanism" convention, already applied to Story 111's
 * `common/logging/`). Deliberately never imported from any
 * processor/service/spec file — every Vitest unit spec in this app
 * imports an individual processor/service directly, never `main.ts`, so
 * this file's module-patching side effects never run during a test.
 *
 * `IORedisInstrumentation` is the closest sanctioned proxy for
 * "instruments... BullMQ" — see `apps/api/src/tracing.ts`'s own doc
 * comment for why. `PrismaInstrumentation` needs no `previewFeatures`
 * flag on this Prisma version (6.19.3).
 *
 * Honors the standard `OTEL_SDK_DISABLED`/`OTEL_EXPORTER_OTLP_ENDPOINT`
 * env vars via the SDK's own built-in env-var handling. No local Tempo
 * collector is stood up as part of this story — see
 * `apps/api/src/tracing.ts`'s own doc comment on why an unreachable
 * collector endpoint is expected and non-fatal in this dev environment.
 */
const sdk = new NodeSDK({
  serviceName: "crm-worker",
  traceExporter: new OTLPTraceExporter(),
  instrumentations: [new IORedisInstrumentation(), new PrismaInstrumentation()],
});

sdk.start();

process.on("SIGTERM", () => void sdk.shutdown());
process.on("SIGINT", () => void sdk.shutdown());
