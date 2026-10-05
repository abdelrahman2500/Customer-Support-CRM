import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Avatar, getInitials } from "./avatar";

describe("getInitials", () => {
  it.each([
    ["Ada Lovelace", "AL"],
    ["Ada", "A"],
    ["  محمد   علي ", "مع"],
    ["Grace Brewster Murray Hopper", "GH"],
    ["", ""],
  ])("%j → %j", (name, initials) => {
    expect(getInitials(name)).toBe(initials);
  });
});

describe("Avatar", () => {
  it("is an image named after the person, showing initials", () => {
    render(<Avatar name="Ada Lovelace" />);
    expect(screen.getByRole("img", { name: "Ada Lovelace" })).toHaveTextContent("AL");
  });

  it("announces presence through the accessible name, not colour alone", () => {
    const { container } = render(
      <Avatar name="Ada Lovelace" presence="online" presenceLabel="Online" />,
    );
    expect(screen.getByRole("img", { name: "Ada Lovelace, Online" })).toBeInTheDocument();
    const dot = container.querySelector('[data-presence="online"]');
    expect(dot).toHaveAttribute("aria-hidden", "true");
    expect(dot).toHaveClass("bg-success-solid");
  });

  it("hides a decorative avatar from assistive tech", () => {
    const { container } = render(<Avatar name="Ada Lovelace" decorative />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root).not.toHaveAttribute("role");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("shows the image, falling back to initials if it fails to load", () => {
    const { container } = render(<Avatar name="Ada Lovelace" src="https://example.com/ada.png" />);
    const img = container.querySelector("img")!;
    expect(img).toHaveAttribute("alt", "");
    fireEvent.error(img);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("img", { name: "Ada Lovelace" })).toHaveTextContent("AL");
  });

  it.each([
    ["sm", "h-6"],
    ["md", "h-8"],
    ["lg", "h-10"],
  ] as const)("size %s uses %s", (size, height) => {
    render(<Avatar name="Ada" size={size} />);
    expect(screen.getByRole("img", { name: "Ada" })).toHaveClass(height, "rounded-pill");
  });

  // Story 212 (PR-1.3) — "nobody assigned yet".
  it("renders the unassigned variant as a dashed, named placeholder without initials", () => {
    render(<Avatar name="Unassigned" variant="unassigned" />);
    const avatar = screen.getByRole("img", { name: "Unassigned" });
    expect(avatar).toHaveClass("border-dashed");
    expect(avatar).not.toHaveTextContent("U");
    expect(avatar.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
