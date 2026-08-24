# Testing, Observability, Deployment & Environments

## Testing strategy

- **Unit tests** with Vitest cover NestJS business logic, pure utilities, and isolated React components with Testing Library.
- **API integration tests** use Vitest and Supertest against real Postgres via the Docker test profile or Testcontainers, with one suite per module.
- **E2E tests** use Playwright for a small set of critical flows: an agent resolves a ticket and a customer submits one through the portal.
- Future stories add unit coverage for business rules and at least one API integration test; this foundation story defines tooling only.

## Observability

- Structured JSON logs use `pino`; a correlation/request ID propagates from API requests into worker jobs.
- OpenTelemetry instruments HTTP, Prisma, and BullMQ and exports to self-hostable Grafana Tempo by default.
- Prometheus-format `/metrics` endpoints expose request, queue, and processing metrics for Grafana dashboards.
- Sentry or self-hosted GlitchTip captures unhandled frontend and backend exceptions.
- `/health` provides liveness and `/health/ready` checks DB/Redis readiness for API and worker containers.

## Deployment & environments

- Environments are local (`docker-compose`), staging, and production. Environment variables are validated at boot with `@nestjs/config` and `zod`.
- GitHub Actions runs install, lint, type-check, unit/integration tests, and builds on every PR; merges to main additionally build and push Docker images. Deployment is outside this story.
- Each app ships a Dockerfile. Root `docker-compose.yml` runs Postgres, Redis, MinIO, MailHog, and the four apps locally.
- `prisma migrate deploy` runs explicitly before API/worker startup in non-local environments; migrations never run implicitly at app boot.
