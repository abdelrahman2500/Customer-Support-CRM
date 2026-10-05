import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthLayout } from "./auth-layout";
import { TicketsIcon } from "../lib/icons";

/** Story 214 (PR-2.2) — the shared sign-in layout. */
function renderLayout() {
  return render(
    <AuthLayout
      productName="Azm Support"
      title="Sign in"
      controls={<button type="button">Language</button>}
      panel={{
        headline: "Support your customers from one place.",
        subheadline: "Every ticket in one queue.",
        features: [
          { key: "t", icon: TicketsIcon, title: "Unified ticketing", description: "One queue." },
        ],
      }}
    >
      <form aria-label="Sign-in form" />
    </AuthLayout>,
  );
}

describe("AuthLayout", () => {
  it("puts the form column first, owning the only h1, with the panel's h2 after it", () => {
    const { container } = renderLayout();
    const h1 = screen.getByRole("heading", { level: 1, name: "Sign in" });
    const h2 = screen.getByRole("heading", { level: 2 });
    expect(h1.compareDocumentPosition(h2) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(container.querySelector("section")).toHaveClass("lg:order-last");
  });

  it("draws the brand panel on the ink chrome, shown only from lg", () => {
    const { container } = renderLayout();
    const panel = container.querySelector("aside")!;
    expect(panel).toHaveClass("bg-chrome", "on-chrome", "hidden", "lg:flex");
    expect(panel).not.toHaveAttribute("aria-hidden");
  });

  it("names the product above the title below lg, and lists the capabilities", () => {
    renderLayout();
    const names = screen.getAllByText("Azm Support");
    expect(names[0]).toHaveClass("lg:hidden");
    expect(screen.getByRole("list")).toHaveTextContent("Unified ticketing");
    expect(screen.getByRole("button", { name: "Language" })).toBeInTheDocument();
  });

  it("uses only logical-direction classes", () => {
    const { container } = renderLayout();
    for (const element of container.querySelectorAll("[class]")) {
      expect(element.className.toString()).not.toMatch(/(^|\s)(ml|mr|pl|pr|left|right)-/);
    }
  });
});
