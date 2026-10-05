import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StillNeedHelp } from "./still-need-help";

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("StillNeedHelp", () => {
  it("is a labelled aside offering the assistant and a new ticket", () => {
    render(<StillNeedHelp />);

    expect(screen.getByRole("complementary", { name: "help.heading" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "help.askAssistant" })).toHaveAttribute(
      "href",
      "/en/chat",
    );
    expect(screen.getByRole("link", { name: "help.raiseTicket" })).toHaveAttribute(
      "href",
      "/en/tickets#new-ticket",
    );
  });
});
