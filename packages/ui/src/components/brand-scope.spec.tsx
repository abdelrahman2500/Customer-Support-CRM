import { afterEach, describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { BrandScope } from "./brand-scope";
import { deriveBrandTokens } from "../lib/brand";

afterEach(() => {
  document.documentElement.removeAttribute("style");
  document.documentElement.removeAttribute("data-brand-accent");
});

describe("BrandScope", () => {
  it("renders children inside a layout-neutral wrapper carrying the brand variables", () => {
    const { getByText, container } = render(
      <BrandScope tokens={deriveBrandTokens("#16A34A")}>
        <p>content</p>
      </BrandScope>,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(getByText("content").parentElement).toBe(wrapper);
    expect(wrapper).toHaveClass("contents");
    expect(wrapper.style.getPropertyValue("--brand")).toBe("22 163 74");
    expect(wrapper.style.getPropertyValue("--brand-accent")).toMatch(/^\d+ \d+ \d+$/);
    expect(wrapper).toHaveAttribute("data-brand-accent");
  });

  it("mirrors the variables onto <html> for portalled content, and removes them on unmount", () => {
    const { unmount } = render(
      <BrandScope tokens={deriveBrandTokens("#16A34A")}>
        <p>content</p>
      </BrandScope>,
    );
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--brand")).toBe("22 163 74");
    expect(root).toHaveAttribute("data-brand-accent");

    unmount();
    expect(root.style.getPropertyValue("--brand")).toBe("");
    expect(root).not.toHaveAttribute("data-brand-accent");
  });

  it("applies Tier 1 only when the accent was rejected", () => {
    const { container } = render(
      <BrandScope tokens={deriveBrandTokens("#DC2626")}>
        <p>content</p>
      </BrandScope>,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.getPropertyValue("--brand")).toBe("220 38 38");
    expect(wrapper.style.getPropertyValue("--brand-accent")).toBe("");
    expect(wrapper).not.toHaveAttribute("data-brand-accent");
    expect(document.documentElement).not.toHaveAttribute("data-brand-accent");
  });

  it("is a transparent wrapper without branding", () => {
    const { container } = render(
      <BrandScope tokens={null}>
        <p>content</p>
      </BrandScope>,
    );
    expect((container.firstElementChild as HTMLElement).getAttribute("style")).toBeNull();
  });
});
