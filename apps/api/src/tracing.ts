import { NodeSDK } from "@opentelemetry/sdk-node";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { IORedisInstrumentation } from "@opentelemetry/instrumentation-ioredis";
import { PrismaInstrumentation } from "@prisma/instrumentation";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

/**
 * Story 112 — docs/architecture/11-quality-and-operations.md: "OpenTelemetry
 * instruments HTTP, Prisma, and BullMQ and exports to self-hostable Grafana
 * Tempo by default." Imported as `main.ts`'s very first line (before even
 * `reflect-metadata`) so every instrumented module (`http`, `ioredis`,
 * `@prisma/client`) is patched before anything else `require`s it — the
 * standard OpenTelemetry Node.js requirement.
 *
 * Deliberately never imported from any service/controller/spec file: every
 * Vitest unit/e2e spec in this repository imports `AppModule` or an
 * individual service/controller directly, never `main.ts` — so this file
 * (and its module-patching side effects) never runs during a test. This
 * mirrors `main.ts`'s own pre-existing CORS/`RedisIoAdapter` setup, which
 * is equally untested by the automated suite and instead verified by
 * manual/smoke testing (see this story's own verification notes).
 *
 * `IORedisInstrumentation` is the closest sanctioned proxy for
 * "instruments... BullMQ" — no dedicated, stable BullMQ OpenTelemetry
 * instrumentation package exists. BullMQ's own job `add`/processing calls
 * are themselves `ioredis` commands under the hood, so this still gives
 * Redis-command-level visibility into queue activity (enqueue, poll,
 * complete) without depending on an unstable/nonexistent package.
 *
 * `PrismaInstrumentation` needs no `previewFeatures` flag on this Prisma
 * version (6.19.3) — confirmed against `@prisma/instrumentation`'s own
 * usage docs, which show a plain `generator client` block with no
 * `tracing` preview feature.
 *
 * Honors the standard `OTEL_SDK_DISABLED`/`OTEL_EXPORTER_OTLP_ENDPOINT`
 * env vars via the SDK's own built-in env-var handling — no custom on/off
 * logic needed here. No local Tempo collector is stood up as part of this
 * story (see the plan doc's Non-Goals) — the exporter's own default
 * (`http://localhost:4318/v1/traces`) simply has nothing listening in this
 * dev environment today, and OpenTelemetry Node exporters are designed to
 * fail open (log via the internal diag logger and retry, never throw or
 * crash the host process) when their collector endpoint is unreachable.
 */
const sdk = new NodeSDK({
  serviceName: "crm-api",
  traceExporter: new OTLPTraceExporter(),
  instrumentations: [
    new HttpInstrumentation(),
    new IORedisInstrumentation(),
    new PrismaInstrumentation(),
  ],
});

sdk.start();

process.on("SIGTERM", () => void sdk.shutdown());
process.on("SIGINT", () => void sdk.shutdown());
