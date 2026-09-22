import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormField } from "./form-field";

/** The ids `useId` generates contain colons (`:r0:`), which are legal in an
 * `id` and in `aria-describedby` but are not valid bare CSS selectors — so
 * these resolve references with `getElementById`, never `querySelector`. */
function describedByElements(control: HTMLElement): HTMLElement[] {
  const value = control.getAttribute("aria-describedby");
  if (!value) {
    return [];
  }
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => {
      const element = document.getElementById(id);
      if (!element) {
        throw new Error(`aria-describedby references "${id}", which is not in the document`);
      }
      return element;
    });
}

describe("FormField", () => {
  it("labels the nested control implicitly, with no id/htmlFor pair to desynchronise", () => {
    render(
      <FormField label="Subject">
        <input />
      </FormField>,
    );

    expect(screen.getByLabelText("Subject")).toBeInstanceOf(HTMLInputElement);
  });

  // Story 151 — the regression guard for moving the hint and error out of
  // the `<label>`. Before that, an implicit label pulled both into the
  // control's accessible name (measured: "SubjectKeep it short.Required"),
  // and this exact-string lookup returned null. Deliberately an exact match,
  // not a regex: a regex would still have passed against the old markup.
  it("keeps the accessible name to the label alone, even with a hint and an error", () => {
    render(
      <FormField label="Subject" hint="Keep it short." error="Required">
        <input />
      </FormField>,
    );

    expect(screen.getByLabelText("Subject")).toBeInstanceOf(HTMLInputElement);
    expect(document.querySelector("label")).toHaveTextContent(/^Subject$/);
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

  /**
   * Story 151 — the validation-accessibility contract.
   *
   * These assert the *association* (follow the id, check what it resolves
   * to), never a literal id string: the ids come from `useId` and are an
   * implementation detail no test should pin.
   */
  describe("validation accessibility (Story 151)", () => {
    it("marks the control invalid when there is an error", () => {
      render(
        <FormField label="Subject" error="Required">
          <input />
        </FormField>,
      );

      expect(screen.getByLabelText("Subject")).toHaveAttribute("aria-invalid", "true");
    });

    it("leaves aria-invalid off entirely when there is no error", () => {
      render(
        <FormField label="Subject">
          <input />
        </FormField>,
      );

      // Absent, not `"false"` — a field that was never invalid should not
      // announce a validity state at all.
      expect(screen.getByLabelText("Subject")).not.toHaveAttribute("aria-invalid");
    });

    it("describes the control with the error message", () => {
      render(
        <FormField label="Subject" error="Required">
          <input />
        </FormField>,
      );

      const described = describedByElements(screen.getByLabelText("Subject"));
      expect(described.map((element) => element.textContent)).toEqual(["Required"]);
      // The same node is still the polite live region.
      expect(described[0]).toHaveAttribute("role", "status");
    });

    it("describes the control with the hint and the error, in that order", () => {
      render(
        <FormField label="Subject" hint="Keep it short." error="Required">
          <input />
        </FormField>,
      );

      const described = describedByElements(screen.getByLabelText("Subject"));
      expect(described.map((element) => element.textContent)).toEqual([
        "Keep it short.",
        "Required",
      ]);
    });

    it("describes the control with the hint alone when there is no error", () => {
      render(
        <FormField label="Subject" hint="Keep it short.">
          <input />
        </FormField>,
      );

      const described = describedByElements(screen.getByLabelText("Subject"));
      expect(described.map((element) => element.textContent)).toEqual(["Keep it short."]);
      expect(screen.getByLabelText("Subject")).not.toHaveAttribute("aria-invalid");
    });

    it("omits aria-describedby entirely when there is neither hint nor error", () => {
      render(
        <FormField label="Subject">
          <input />
        </FormField>,
      );

      // Absent, not `aria-describedby=""`, which would point at nothing.
      expect(screen.getByLabelText("Subject")).not.toHaveAttribute("aria-describedby");
    });

    it("gives two fields on the same page distinct ids", () => {
      render(
        <>
          <FormField label="First" error="Required">
            <input />
          </FormField>
          <FormField label="Second" error="Required">
            <input />
          </FormField>
        </>,
      );

      const first = screen.getByLabelText("First").getAttribute("aria-describedby");
      const second = screen.getByLabelText("Second").getAttribute("aria-describedby");
      expect(first).toBeTruthy();
      expect(first).not.toBe(second);
      // ...and each still resolves to its own message.
      expect(describedByElements(screen.getByLabelText("First"))).toHaveLength(1);
      expect(describedByElements(screen.getByLabelText("Second"))).toHaveLength(1);
    });

    it("keeps a caller's own aria-describedby, and puts it first", () => {
      render(
        <FormField label="Subject" error="Required">
          <input aria-describedby="external-help" />
        </FormField>,
      );
      // The caller owns this node; FormField must not invent it.
      const helper = document.createElement("span");
      helper.id = "external-help";
      helper.textContent = "See the handbook.";
      document.body.append(helper);

      const value = screen.getByLabelText("Subject").getAttribute("aria-describedby") ?? "";
      expect(value.split(/\s+/)[0]).toBe("external-help");
      expect(describedByElements(screen.getByLabelText("Subject")).map((e) => e.textContent)).toEqual(
        ["See the handbook.", "Required"],
      );

      helper.remove();
    });

    it("lets a caller's explicit aria-invalid={false} win over the derived value", () => {
      render(
        <FormField label="Subject" error="Required">
          <input aria-invalid={false} />
        </FormField>,
      );

      // `??` semantics: `false` is a real answer, not an absent one. A `||`
      // merge would have silently overwritten this with `true`.
      expect(screen.getByLabelText("Subject")).toHaveAttribute("aria-invalid", "false");
    });

    it("lets a caller's explicit aria-invalid={true} stand when there is no error", () => {
      render(
        <FormField label="Subject">
          <input aria-invalid={true} />
        </FormField>,
      );

      expect(screen.getByLabelText("Subject")).toHaveAttribute("aria-invalid", "true");
    });

    it("renders a non-element child unchanged instead of throwing", () => {
      const { container } = render(
        <FormField label="Subject" error="Required">
          plain text
        </FormField>,
      );

      expect(container).toHaveTextContent("plain text");
      // Nothing to inject onto, so no control carries the ARIA — but the
      // error still renders and is still announced.
      expect(screen.getByRole("status")).toHaveTextContent("Required");
      expect(container.querySelector("[aria-invalid]")).toBeNull();
    });
  });
});
