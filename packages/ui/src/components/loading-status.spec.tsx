import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoadingStatus } from "./loading-status";
import { Skeleton } from "./skeleton";

/**
 * Story 161 — the two defects this exists to fix, asserted semantically
 * rather than by markup shape: a screen reader is told that something is
 * loading, exactly once, and is not walked through the placeholder boxes.
 */
describe("LoadingStatus", () => {
  it("announces the loading label through a single live region", () => {
    render(
      <LoadingStatus label="Loading notes">
        <Skeleton className="h-24 w-full" />
      </LoadingStatus>,
    );

    const status = screen.getByRole("status", { name: "Loading notes" });
    expect(status).toHaveAttribute("aria-busy", "true");
    // One region, not one per placeholder bar.
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("hides the placeholder from assistive technology", () => {
    render(
      <LoadingStatus label="Loading notes" className="flex flex-col gap-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </LoadingStatus>,
    );

    const status = screen.getByRole("status", { name: "Loading notes" });
    const placeholder = status.querySelector("[aria-hidden='true']");
    expect(placeholder).toBeInTheDocument();
    // Every bar is inside the hidden placeholder, none beside it.
    expect(placeholder?.querySelectorAll(".animate-pulse")).toHaveLength(2);
    expect(status.children).toHaveLength(1);
  });

  it("puts className on the placeholder so a caller's own layout still applies", () => {
    render(
      <LoadingStatus label="Loading" className="mt-2 flex flex-col gap-2">
        <Skeleton className="h-10 w-full" />
      </LoadingStatus>,
    );

    const placeholder = screen.getByRole("status").querySelector("[aria-hidden='true']");
    expect(placeholder).toHaveClass("mt-2", "flex", "flex-col", "gap-2");
    // The status wrapper stays unstyled, which is what makes it layout-neutral.
    expect(screen.getByRole("status").className).toBe("");
  });

  it("makes the caller's own element the placeholder when asChild is set", () => {
    render(
      <LoadingStatus label="Loading messages" asChild>
        <Skeleton className="mt-2 h-40 w-full" />
      </LoadingStatus>,
    );

    const status = screen.getByRole("status", { name: "Loading messages" });
    // No wrapper was added: the Skeleton itself is the hidden placeholder.
    expect(status.children).toHaveLength(1);
    const placeholder = status.firstElementChild;
    expect(placeholder).toHaveAttribute("aria-hidden", "true");
    expect(placeholder).toHaveClass("animate-pulse", "mt-2", "h-40", "w-full");
  });

  // Story 162 -- a placeholder that is not wholly decorative keeps its own
  // hiding. The portal's notification history renders real column headers
  // beside its placeholder rows and must not lose them to a blanket hide.
  it("leaves the placeholder announced when placeholderHidden is false", () => {
    render(
      <LoadingStatus label="Loading history" placeholderHidden={false}>
        <table>
          <thead>
            <tr>
              <th>Event</th>
            </tr>
          </thead>
          <tbody aria-hidden="true">
            <tr>
              <td>
                <Skeleton className="h-5 w-20" />
              </td>
            </tr>
          </tbody>
        </table>
      </LoadingStatus>,
    );

    const status = screen.getByRole("status", { name: "Loading history" });
    expect(status).toHaveAttribute("aria-busy", "true");
    // The wrapper no longer hides the subtree...
    expect(status.firstElementChild).not.toHaveAttribute("aria-hidden");
    // ...so the caller's own real header survives, while its own
    // aria-hidden still covers the placeholder rows.
    expect(screen.getByRole("columnheader", { name: "Event" })).toBeInTheDocument();
    expect(screen.queryByRole("cell")).not.toBeInTheDocument();
  });

  it("does not expose the placeholder's own content as readable text", () => {
    render(
      <LoadingStatus label="Loading history">
        <Skeleton className="h-6 w-full" />
      </LoadingStatus>,
    );

    // The accessible name is the label, never the placeholder's markup.
    expect(screen.getByRole("status")).toHaveAccessibleName("Loading history");
  });
});
