import { describe, expect, it, vi } from "vitest";
import { EmailStatusController } from "./email-status.controller";
import type { EnvConfig } from "../../common/config/env.validation";
import type { ConfigService } from "@nestjs/config";

function buildConfigServiceMock(values: Partial<Pick<EnvConfig, "SMTP_HOST" | "SMTP_FROM">>) {
  return {
    get: vi.fn((key: string) => values[key as keyof typeof values]),
  };
}

function createController(
  configMock: ReturnType<typeof buildConfigServiceMock>,
): EmailStatusController {
  return new EmailStatusController(configMock as unknown as ConfigService<EnvConfig, true>);
}

describe("EmailStatusController", () => {
  describe("getEmailStatus", () => {
    it("reports configured: true when both SMTP_HOST and SMTP_FROM are set", () => {
      const controller = createController(
        buildConfigServiceMock({ SMTP_HOST: "localhost", SMTP_FROM: "support@example.test" }),
      );

      expect(controller.getEmailStatus()).toEqual({ configured: true });
    });

    it("reports configured: false when SMTP_HOST is unset", () => {
      const controller = createController(
        buildConfigServiceMock({ SMTP_FROM: "support@example.test" }),
      );

      expect(controller.getEmailStatus()).toEqual({ configured: false });
    });

    it("reports configured: false when SMTP_FROM is unset", () => {
      const controller = createController(buildConfigServiceMock({ SMTP_HOST: "localhost" }));

      expect(controller.getEmailStatus()).toEqual({ configured: false });
    });

    it("reports configured: false when neither is set", () => {
      const controller = createController(buildConfigServiceMock({}));

      expect(controller.getEmailStatus()).toEqual({ configured: false });
    });

    it("never returns the configured values themselves, only the boolean", () => {
      const controller = createController(
        buildConfigServiceMock({ SMTP_HOST: "smtp.internal.example", SMTP_FROM: "support@example.test" }),
      );

      const result = controller.getEmailStatus();

      expect(Object.keys(result)).toEqual(["configured"]);
    });
  });
});
