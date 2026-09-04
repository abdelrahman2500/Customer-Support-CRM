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
