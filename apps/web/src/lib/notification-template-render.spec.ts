import { describe, expect, it } from "vitest";
import { renderNotificationTemplate } from "./notification-template-render";

describe("renderNotificationTemplate", () => {
  it("substitutes {ticketId}, shortened to 8 characters", () => {
    const result = renderNotificationTemplate("Ticket {ticketId}", {
      ticketId: "12345678-abcd",
    });

    expect(result).toBe("Ticket 12345678");
  });

  it("substitutes {targetType}", () => {
    const result = renderNotificationTemplate("{targetType} at risk", {
      ticketId: "ticket-1",
      targetType: "response",
    });

    expect(result).toBe("response at risk");
  });

  it("substitutes {targetType} as an empty string when missing", () => {
    const result = renderNotificationTemplate("[{targetType}]", {
      ticketId: "ticket-1",
      targetType: null,
    });

    expect(result).toBe("[]");
  });

  it("substitutes {targetType} as an empty string when undefined", () => {
    const result = renderNotificationTemplate("[{targetType}]", {
      ticketId: "ticket-1",
    });

    expect(result).toBe("[]");
  });

  it("substitutes every occurrence of a repeated placeholder", () => {
    const result = renderNotificationTemplate("{ticketId} / {ticketId}", {
      ticketId: "ticket-1",
    });

    expect(result).toBe("ticket-1 / ticket-1");
  });

  it("leaves an unrecognized placeholder verbatim", () => {
    const result = renderNotificationTemplate("Hello {unknown}", { ticketId: "ticket-1" });

    expect(result).toBe("Hello {unknown}");
  });

  it("returns plain text unchanged when it has no placeholders", () => {
    const result = renderNotificationTemplate("Just plain text", { ticketId: "ticket-1" });

    expect(result).toBe("Just plain text");
  });
});
