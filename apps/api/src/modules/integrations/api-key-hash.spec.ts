import { describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { ApiKeyHasher } from "./api-key-hash";
import type { ConfigService } from "@nestjs/config";
import type { EnvConfig } from "../../common/config/env.validation";

type MockedConfigService = ConfigService<EnvConfig, true>;

function buildConfigServiceMock(values: Record<string, unknown>) {
  return { get: vi.fn((key: string) => values[key]) };
}

describe("ApiKeyHasher", () => {
  it("hashes with the same algorithm as IdentityService.hashRefreshToken (HMAC-SHA256, hex)", () => {
    const configService = buildConfigServiceMock({ JWT_REFRESH_SECRET: "refresh-secret-value" });
    const hasher = new ApiKeyHasher(configService as unknown as MockedConfigService);

    const result = hasher.hash("raw-key-1");

    expect(result).toBe(createHmac("sha256", "refresh-secret-value").update("raw-key-1").digest("hex"));
  });

  it("uses API_KEY_HASH_SECRET when explicitly configured, not JWT_REFRESH_SECRET", () => {
    const configService = buildConfigServiceMock({
      API_KEY_HASH_SECRET: "dedicated-secret",
      JWT_REFRESH_SECRET: "refresh-secret-value",
    });
    const hasher = new ApiKeyHasher(configService as unknown as MockedConfigService);

    const result = hasher.hash("raw-key-1");

    expect(result).toBe(createHmac("sha256", "dedicated-secret").update("raw-key-1").digest("hex"));
  });

  it("is deterministic — the same raw key always hashes to the same value", () => {
    const configService = buildConfigServiceMock({ JWT_REFRESH_SECRET: "refresh-secret-value" });
    const hasher = new ApiKeyHasher(configService as unknown as MockedConfigService);

    expect(hasher.hash("same-key")).toBe(hasher.hash("same-key"));
  });

  it("produces different hashes for different raw keys", () => {
    const configService = buildConfigServiceMock({ JWT_REFRESH_SECRET: "refresh-secret-value" });
    const hasher = new ApiKeyHasher(configService as unknown as MockedConfigService);

    expect(hasher.hash("key-a")).not.toBe(hasher.hash("key-b"));
  });
});
