import { createHmac } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { Injectable } from "@nestjs/common";
import type { EnvConfig } from "../../common/config/env.validation";

/** RM-22 — the raw key's own displayed prefix length (`ApiKey.keyPrefix`) —
 * long enough to be visually distinguishable across a branch's keys, far
 * too short to meaningfully narrow a brute-force search of the remaining
 * secret. */
export const API_KEY_PREFIX_LENGTH = 8;

/**
 * RM-22 — the one place `ApiKeysService` (issuing) and `ApiKeyGuard`
 * (authenticating) both compute the same keyed hash, so the two can never
 * silently drift. Mirrors `IdentityService.hashRefreshToken`'s exact
 * algorithm (`createHmac("sha256", secret)`) — see that method's own doc
 * comment, and this class's own doc comment on `API_KEY_HASH_SECRET`
 * (`env.validation.ts`) for why the keying secret falls back to
 * `JWT_REFRESH_SECRET` rather than being required.
 */
@Injectable()
export class ApiKeyHasher {
  constructor(private readonly configService: ConfigService<EnvConfig, true>) {}

  hash(rawKey: string): string {
    const overrideSecret = this.configService.get("API_KEY_HASH_SECRET", { infer: true });
    const refreshSecret = this.configService.get("JWT_REFRESH_SECRET", { infer: true });
    const secret = overrideSecret ?? refreshSecret;
    return createHmac("sha256", secret).update(rawKey).digest("hex");
  }
}
