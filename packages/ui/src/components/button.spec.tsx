import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "./button";

describe("Button", () => {
  it("renders its children and is activatable", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("keeps every pre-S-3 variant and size available", () => {
    for (const variant of ["default", "outline", "ghost", "destructive"] as const) {
      const { unmount } = render(<Button variant={variant}>x</Button>);
      expect(screen.getByRole("button")).toBeInTheDocument();
      unmount();
    }
    for (const size of ["default", "sm", "lg"] as const) {
      const { unmount } = render(<Button size={size}>x</Button>);
      expect(screen.getByRole("button")).toBeInTheDocument();
      unmount();
    }
  });

  // Demo hardening — a quiet destructive action: danger text, no solid fill.
  it("renders destructive-quiet as danger text without the solid fill", () => {
    render(<Button variant="destructive-quiet">Deactivate</Button>);

    const button = screen.getByRole("button", { name: "Deactivate" });
    expect(button).toHaveClass("text-danger-foreground");
    expect(button).not.toHaveClass("bg-danger-solid");
  });

  describe("loading state", () => {
    it("marks the button busy and disabled", () => {
      render(<Button isLoading>Save</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-busy", "true");
      expect(button).toBeDisabled();
    });

    /** The double-submit guard this state exists for. */
    it("does not fire onClick while loading", () => {
      const onClick = vi.fn();
      render(
        <Button isLoading onClick={onClick}>
          Save
        </Button>,
      );

      fireEvent.click(screen.getByRole("button"));
      expect(onClick).not.toHaveBeenCalled();
    });

    /** The label must stay in the DOM so the button keeps its width — a
     * spinner swapped in for the text would resize it mid-click. */
    it("keeps the label rendered so the button cannot change size", () => {
      render(<Button isLoading>Save changes</Button>);

      expect(screen.getByRole("button")).toHaveTextContent("Save changes");
    });

    /**
     * Story 169 — the label must stay in the accessibility tree too, not just
     * in the DOM. It used to be hidden with `invisible`
     * (`visibility: hidden`), which the accessible-name computation excludes
     * — so a pending button announced as "busy" with no name at all.
     * `opacity: 0` is visually identical and is not an exclusion criterion.
     *
     * Asserted at class level deliberately: jsdom loads no Tailwind CSS, so
     * `invisible` computes to nothing here and an accessible-name assertion
     * would pass against the very bug this pins.
     */
    it("hides the label with opacity, never with visibility, so it keeps its accessible name", () => {
      render(<Button isLoading>Save changes</Button>);

      const label = screen.getByText("Save changes");
      expect(label).toHaveClass("opacity-0");
      expect(label).not.toHaveClass("invisible");
    });

    it("is not busy or disabled when not loading", () => {
      render(<Button>Save</Button>);

      const button = screen.getByRole("button");
      expect(button).not.toHaveAttribute("aria-busy");
      expect(button).toBeEnabled();
    });

    it("stays disabled when disabled is set independently of loading", () => {
      render(<Button disabled>Save</Button>);

      expect(screen.getByRole("button")).toBeDisabled();
      expect(screen.getByRole("button")).not.toHaveAttribute("aria-busy");
    });

    /** `Slot` merges onto a single child, so the spinner cannot be added. The
     * button must still render rather than crash. */
    it("ignores loading when asChild is set", () => {
      render(
        <Button asChild isLoading>
          <a href="/somewhere">Go</a>
        </Button>,
      );

      const link = screen.getByRole("link", { name: "Go" });
      expect(link).toBeInTheDocument();
      expect(link).not.toHaveAttribute("aria-busy");
    });
  });
});

describe("Button design-language API (Story 185)", () => {
  it("is comfortable by default: 40px, control radius", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveClass("h-10", "rounded-control");
  });

  it.each([
    ["secondary", "bg-accent-surface"],
    ["link", "text-accent"],
  ] as const)("offers the %s variant", (variant, token) => {
    render(<Button variant={variant}>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).toHaveClass(token);
  });

  it("keeps a link variant text-only at any size", () => {
    render(
      <Button variant="link" size="sm">
        Details
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Details" });
    expect(button).toHaveClass("h-auto", "px-0");
    expect(button).not.toHaveClass("h-8");
  });

  it("offers square icon sizes, named by aria-label", () => {
    render(
      <Button size="icon" aria-label="Close">
        <svg aria-hidden="true" />
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Close" })).toHaveClass("h-10", "w-10");
  });

  it("darkens on press with the accent-active token", () => {
    render(<Button>Send</Button>);
    expect(screen.getByRole("button", { name: "Send" })).toHaveClass("active:bg-accent-active");
  });

  // Story 212 (PR-1.3) — a quiet action on the ink chrome.
  it("offers a chrome variant on the chrome tokens", () => {
    render(<Button variant="chrome">Collapse</Button>);
    expect(screen.getByRole("button", { name: "Collapse" })).toHaveClass(
      "text-chrome-muted",
      "hover:bg-chrome-raised",
    );
  });
});
