import { describe, expect, it } from "vitest";
import { validateEnv } from "./env.validation";

describe("validateEnv", () => {
  it("applies local MinIO defaults when S3 settings are absent", () => {
    const env = validateEnv({
      NODE_ENV: "test",
      PORT: "3001",
      DATABASE_URL: "postgresql://crm:crm_dev_password@localhost:5432/crm?schema=public",
      REDIS_URL: "redis://localhost:6379",
      JWT_ACCESS_SECRET: "12345678901234567890123456789012",
      JWT_REFRESH_SECRET: "12345678901234567890123456789012",
    });

    expect(env).toMatchObject({
      S3_ENDPOINT: "http://localhost:9000",
      S3_ACCESS_KEY: "minioadmin",
      S3_SECRET_KEY: "minioadmin",
      S3_BUCKET: "crm-attachments",
    });
  });
});
