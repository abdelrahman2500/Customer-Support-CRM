import { Injectable, Optional } from "@nestjs/common";
import type { IncomingHttpHeaders } from "node:http";

/**
 * RM-21 — the outcome of one `WebhookVerifier.verify()` call. `verified:
 * false` always carries a `rejectReason` — `WebhookInboundLogsService`
 * stores it verbatim for admin visibility.
 */
export interface WebhookVerificationResult {
  verified: boolean;
  rejectReason?: string;
}

/**
 * RM-21 — one provider's own signature scheme (HMAC header format, hashing
 * algorithm, whatever a real provider's docs specify). `verify()` receives
 * the exact raw request bytes (`rawBody`) — never a re-serialized/re-parsed
 * body — because a signature is computed over the exact bytes the provider
 * sent, and re-serializing JSON is not guaranteed to reproduce them
 * byte-for-byte.
 */
export interface WebhookVerifier {
  verify(rawBody: Buffer, headers: IncomingHttpHeaders): WebhookVerificationResult;
}

/**
 * RM-21 — resolves a `providerKey` (the `:providerKey` route segment) to
 * its registered `WebhookVerifier`, mirroring `apps/worker`'s
 * `ChannelAdapterRegistry` shape exactly: a `Map`-backed registry, `resolve`
 * returns `undefined` for anything unregistered.
 *
 * Ships with zero registered verifiers — there is no real inbound provider
 * to receive from yet (mirrors RM-14's own "the registry exists, nothing is
 * registered in it yet" precedent). A future provider-specific story
 * constructs a real `WebhookVerifier` and adds it here (or via DI, the way
 * `ChannelsModule` conditionally provides `EMAIL_ADAPTER`); a test
 * registers one directly via this class's own constructor —
 * `Test.createTestingModule(...).overrideProvider(WebhookVerifierRegistry)
 * .useValue(new WebhookVerifierRegistry([["test-provider", verifier]]))`.
 */
@Injectable()
export class WebhookVerifierRegistry {
  private readonly verifiers: Map<string, WebhookVerifier>;

  // `@Optional()` is required, not decorative: Nest's DI otherwise tries to
  // resolve a provider for the `Array` design-type of this parameter (there
  // is none, `Array` is a plain JS type, not a token) and throws at boot —
  // confirmed the hard way, this broke real `AppModule` bootstrap
  // (`integrations.e2e-spec.ts`, no override) until this was added.
  constructor(@Optional() verifiers: Array<[string, WebhookVerifier]> = []) {
    this.verifiers = new Map(verifiers);
  }

  resolve(providerKey: string): WebhookVerifier | undefined {
    return this.verifiers.get(providerKey);
  }
}
