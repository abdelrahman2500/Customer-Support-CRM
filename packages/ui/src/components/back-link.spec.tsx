import * as React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BackLink } from "./back-link";

describe("BackLink", () => {
  it("renders a focusable link with an RTL-flipping, decorative chevron", () => {
    render(<BackLink href="/en/tickets">Back to tickets</BackLink>);
    const link = screen.getByRole("link", { name: "Back to tickets" });
    expect(link).toHaveAttribute("href", "/en/tickets");
    expect(link).toHaveClass("focus-ring");
    const chevron = link.querySelector("svg")!;
    expect(chevron).toHaveAttribute("aria-hidden", "true");
    expect(chevron.getAttribute("class")).toContain("rtl:rotate-180");
  });

  it("renders the caller's link element via asChild, with the chevron inside it", () => {
    const RouterLink = React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(
      (props, ref) => <a ref={ref} data-router-link="" {...props} />,
    );
    RouterLink.displayName = "RouterLink";
    render(
      <BackLink asChild>
        <RouterLink href="/ar/tickets">العودة إلى التذاكر</RouterLink>
      </BackLink>,
    );
    const link = screen.getByRole("link", { name: "العودة إلى التذاكر" });
    expect(link).toHaveAttribute("data-router-link");
    expect(link).toHaveAttribute("href", "/ar/tickets");
    expect(link).toHaveClass("focus-ring");
    expect(link.querySelector("svg")).not.toBeNull();
  });
});
