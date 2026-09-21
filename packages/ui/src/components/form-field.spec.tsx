import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormField } from "./form-field";

describe("FormField", () => {
  it("labels the nested control implicitly, with no id/htmlFor pair to desynchronise", () => {
    render(
      <FormField label="Subject">
        <input />
      </FormField>,
    );

    expect(screen.getByLabelText("Subject")).toBeInstanceOf(HTMLInputElement);
  });

  it("renders a hint only when given", () => {
    const { rerender } = render(
      <FormField label="Subject">
        <input />
      </FormField>,
    );
    expect(screen.queryByText("Keep it short.")).not.toBeInTheDocument();

    rerender(
      <FormField label="Subject" hint="Keep it short.">
        <input />
      </FormField>,
    );
    expect(screen.getByText("Keep it short.")).toBeInTheDocument();
  });

  it("renders an error only when truthy, so an empty error passes through cleanly", () => {
    const { rerender } = render(
      <FormField label="Subject" error="">
        <input />
      </FormField>,
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    rerender(
      <FormField label="Subject" error="Required">
        <input />
      </FormField>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Required");
  });

  it("colours the error through the danger token, never a raw palette class", () => {
    render(
      <FormField label="Subject" error="Required">
        <input />
      </FormField>,
    );

    const error = screen.getByRole("status");
    expect(error).toHaveClass("text-danger-foreground");
    expect(error.className).not.toMatch(/text-red-\d{3}/);
  });

  it("announces the error politely rather than interrupting mid-typing", () => {
    render(
      <FormField label="Subject" error="Required">
        <input />
      </FormField>,
    );

    // `status` is the polite live region; `alert` would cut in on every
    // keystroke that revalidates.
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("defaults to the compact density and can be made comfortable", () => {
    const { container, rerender } = render(
      <FormField label="Subject">
        <input />
      </FormField>,
    );
    expect(container.firstElementChild).toHaveClass("text-xs");

    rerender(
      <FormField label="Subject" density="comfortable">
        <input />
      </FormField>,
    );
    expect(container.firstElementChild).toHaveClass("text-sm");
  });

  it("uses no physical-direction utility, so it is correct under RTL", () => {
    const { container } = render(
      <FormField label="Subject" hint="h" error="e">
        <input />
      </FormField>,
    );

    expect(container.innerHTML).not.toMatch(/\b(ml|mr|pl|pr|text-left|text-right)-/);
  });
});
