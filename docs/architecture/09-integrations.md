# Integration Architecture (External Systems)

## Integration Hub

`IntegrationsModule` in the `integrations` schema owns every external connection:

- **Inbound** provider webhooks and polling fallbacks are signature-verified, written to `integrations.webhook_logs`, and translated into `ChannelMessage` or ERP domain events.
- **Outbound** email, SMS, WhatsApp, and ERP work is placed on `integration-sync` and executed by `apps/worker` with retry/backoff and durable attempt logs.

## Adapter pattern

Each system implements a small interface such as `ErpAdapter { syncCustomer(), syncOrder() }` or `EmailAdapter { send(), parseInbound() }`. Only adapters import vendor SDKs or HTTP clients; business modules depend on interfaces. This keeps provider replacement contained.

## Public API

- The versioned REST API (`/api/v1/...`) documented by OpenAPI is the public integration surface; there is no separate integration API.
- Machine-to-machine consumers initially use API keys. OAuth2 client credentials is a future upgrade if required.
- The machine-callable surface is deliberately narrow: today it is one read-only route, `GET /api/v1/integrations/reports/ticket-volume` (Story 133), requiring the `integration:read` scope and confined to the key's own branch through the same `TenantContext.requireBranchScope()` flow human callers use. It is a separate route rather than a decorator on `/api/v1/reports/*` because `PermissionsGuard` runs before `ApiKeyGuard`, so a route cannot carry both `@RequirePermissions(...)` and `@AllowApiKey()`. Widening this surface to further report families, to CSV exports, or to any write endpoint is a deliberate decision per endpoint, not an automatic consequence of holding a key.
- Provider webhooks are unauthenticated but signed according to provider schemes such as Twilio signatures and Meta `X-Hub-Signature-256`; they are rate-limited and logged.

## ERP integration

ERP is another `ErpAdapter` behind the Integration Hub. The specific ERP and protocol (REST, SOAP, or file-based) remain open until a future story names them.
