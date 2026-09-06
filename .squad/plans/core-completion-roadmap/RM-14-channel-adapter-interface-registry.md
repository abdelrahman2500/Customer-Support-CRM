# RM-14 — Channel Adapter Interface + Registry

**Priority:** P1 · **Complexity:** Medium · **Blocked:** No · **Phase:** 4 (Omnichannel Foundation)

## Goal

Formalize the `ChannelAdapter`-shaped interface `docs/architecture/09-
integrations.md` already describes in prose (`EmailAdapter { send(),
parseInbound() }`) as a real TypeScript interface, plus a registry
resolving which adapter (if any) handles a given `ChannelType` — wired
initially only to Live Chat/Web Form's existing behavior, formalized rather
than reimplemented.

## Why it exists

The architecture docs describe this adapter pattern in complete detail; none
of it exists in code (confirmed by the Recon and by a direct search of
`apps`/`packages` for any `ErpAdapter`/`EmailAdapter`/`ChannelAdapter`
symbol — zero hits). Without this seam existing first, each of Phase 5's
provider adapters would otherwise invent its own ad hoc integration point,
directly contradicting the architecture docs' own stated intent ("Only
adapters import vendor SDKs or HTTP clients; business modules depend on
interfaces").

## Dependencies

Builds on `RM-13`'s delivery-status model (an adapter's job is precisely to
take a `ChannelMessage` from `PENDING` to `SENT`/`FAILED`). No dependency on
any specific provider decision — this is exactly the piece that unblocks
Email/WhatsApp/SMS once a vendor is chosen, without re-architecting
anything at that point.

## Backend work

- Define `ChannelAdapter` interface: `send(message: ChannelMessage):
  Promise<{externalMessageId?: string}>`, `parseInbound(payload: unknown):
  ParsedInboundMessage | null` (returns `null` for a payload the adapter
  doesn't recognize, allowing safe multi-adapter registries later).
- `ChannelAdapterRegistry` service: resolves a `ChannelType` to its
  registered adapter (or `undefined` if none registered — the current,
  correct state for `EMAIL`/`WHATSAPP`/`SMS` until Phase 5 registers one).
- Formalize `LIVE_CHAT`/`WEB_FORM`/`AI_CHAT`'s existing behavior as
  explicit no-op/first-party adapters implementing the same interface
  (`send` is a same-process DB write + realtime emit, not a network call;
  `parseInbound` is unused since these channels never receive an external
  payload) — this is a pure refactor of already-correct behavior into the
  new shape, not a behavior change.
- The generic outbound queue `RM-13` introduced now calls
  `ChannelAdapterRegistry.resolve(message.channelType)?.send(message)` —
  if no adapter is registered (Email/WhatsApp/SMS today), the message stays
  `PENDING` with a clear, logged reason ("no adapter configured for this
  channel"), never silently dropped or crashed on.

## Frontend work

None.

## Worker/realtime work

- The `apps/worker` processor stub from `RM-13` is replaced by a real one
  that calls through the registry — still a no-op outcome for
  Email/WhatsApp/SMS today (nothing is registered), but now going through
  the real, permanent code path Phase 5's adapters will extend.

## Schema/migration work

None beyond what `RM-13` already added.

## Tests

- New `channel-adapter-registry.spec.ts` — resolve/no-adapter-registered
  cases.
- Extend `RM-13`'s processor spec to assert the "no adapter configured"
  path leaves a message correctly `PENDING` with a logged reason, not
  `FAILED` (an unconfigured channel is not the same as a failed send).
- Regression: confirm Live Chat/Web Form/AI_CHAT's real, tested behavior
  (existing e2e specs) is completely unchanged after this refactor.

## Acceptance criteria

- A `ChannelAdapter` interface and registry exist, formally matching the
  shape `docs/architecture/09-integrations.md` describes.
- Live Chat/Web Form/AI_CHAT behave identically to before this story,
  proven by the existing test suites passing unchanged.
- Email/WhatsApp/SMS messages correctly stay `PENDING` with a clear reason
  when no adapter is registered — never crash, never silently vanish.

## Definition of Done

- All acceptance criteria verified.
- `pnpm --filter @crm/api test`, `test:e2e`, `pnpm --filter @crm/worker test`,
  `pnpm typecheck`, `pnpm lint`, `pnpm build` pass.
- One dedicated commit, pushed.
