import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Kbd } from "./kbd";

describe("Kbd", () => {
  it("renders a real <kbd> on the inner radius and caption type", () => {
    render(<Kbd>Enter</Kbd>);
    const key = screen.getByText("Enter");
    expect(key.tagName).toBe("KBD");
    expect(key).toHaveClass("rounded-inner", "text-caption", "bg-surface-muted");
  });
});
