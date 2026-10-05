import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormActions, FormSection } from "./form-layout";

/** Story 225 (PR-4.4) — the form-section recipe. */
describe("FormSection", () => {
  it("is a named group of fields", () => {
    render(
      <FormSection title="Who it is for" description="Pick the customer first." columns={2}>
        <input aria-label="Customer" />
      </FormSection>,
    );
    const group = screen.getByRole("group", { name: "Who it is for" });
    expect(group.tagName).toBe("FIELDSET");
    expect(screen.getByText("Pick the customer first.")).toBeInTheDocument();
    expect(screen.getByLabelText("Customer").parentElement).toHaveClass("sm:grid-cols-2");
  });
});

describe("FormActions", () => {
  it("shows the disabled reason the submit points at, and the error beside it", () => {
    render(
      <FormActions reason="Fill in: Subject" reasonId="why" error="The customer is inactive">
        <button type="submit" disabled aria-describedby="why">
          Create ticket
        </button>
      </FormActions>,
    );
    expect(screen.getByRole("button", { name: "Create ticket" })).toHaveAccessibleDescription(
      "Fill in: Subject",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("The customer is inactive");
  });

  it("shows nothing extra when there is no reason or error", () => {
    render(
      <FormActions>
        <button type="submit">Save</button>
      </FormActions>,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
