import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryStateCard } from "./query-state-card";
import { SkeletonCard } from "./skeleton";

/** The props every branch needs, so each test states only what it varies. */
const base = { loadingLabel: "Loading tickets" } as const;

describe("QueryStateCard", () => {
  describe("loading", () => {
    it("announces loading once, politely, instead of reading the placeholder", () => {
      render(
        <QueryStateCard {...base} isLoading>
          <table />
        </QueryStateCard>,
      );

      const status = screen.getByRole("status", { name: "Loading tickets" });
      expect(status).toHaveAttribute("aria-busy", "true");
      // The bars themselves are hidden — the announcement is the label.
      expect(status.querySelector("[aria-hidden]")).toBeInTheDocument();
    });

    it("does not render the loaded content while loading", () => {
      render(
        <QueryStateCard {...base} isLoading>
          <p>ticket rows</p>
        </QueryStateCard>,
      );

      expect(screen.queryByText("ticket rows")).not.toBeInTheDocument();
    });

    it("accepts a caller's own placeholder for a non-list screen", () => {
      render(
        <QueryStateCard {...base} isLoading loadingPlaceholder={<SkeletonCard lines={3} />}>
          <p>content</p>
        </QueryStateCard>,
      );

      const status = screen.getByRole("status", { name: "Loading tickets" });
      // The default is five bars; a SkeletonCard is a heading plus three.
      expect(status.querySelectorAll(".animate-pulse")).toHaveLength(4);
    });
  });

  describe("error", () => {
    it("announces the failure assertively", () => {
      render(
        <QueryStateCard {...base} isError error={{ title: "Could not load tickets." }}>
          <p>content</p>
        </QueryStateCard>,
      );

      expect(screen.getByRole("alert")).toHaveTextContent("Could not load tickets.");
      expect(screen.queryByText("content")).not.toBeInTheDocument();
    });

    it("renders an optional detail line", () => {
      render(
        <QueryStateCard
          {...base}
          isError
          error={{ title: "Could not load tickets.", description: "The request timed out." }}
        />,
      );

      expect(screen.getByText("The request timed out.")).toBeInTheDocument();
    });

    it("retries on click, and never on its own", async () => {
      const onRetry = vi.fn();
      render(
        <QueryStateCard
          {...base}
          isError
          error={{ title: "Could not load tickets.", retryLabel: "Retry", onRetry }}
        />,
      );

      // Nothing fired from mounting: no automatic retry.
      expect(onRetry).not.toHaveBeenCalled();

      await userEvent.click(screen.getByRole("button", { name: "Retry" }));
      expect(onRetry).toHaveBeenCalledOnce();
    });

    it("retries from the keyboard", async () => {
      const onRetry = vi.fn();
      render(
        <QueryStateCard
          {...base}
          isError
          error={{ title: "Could not load tickets.", retryLabel: "Retry", onRetry }}
        />,
      );

      await userEvent.tab();
      expect(screen.getByRole("button", { name: "Retry" })).toHaveFocus();

      await userEvent.keyboard("{Enter}");
      expect(onRetry).toHaveBeenCalledOnce();
    });

    it("omits the retry button when there is no handler to call", () => {
      render(<QueryStateCard {...base} isError error={{ title: "Could not load tickets." }} />);

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("blocks a second retry while one is in flight", () => {
      const onRetry = vi.fn();
      render(
        <QueryStateCard
          {...base}
          isError
          error={{ title: "x", retryLabel: "Retry", onRetry, isRetrying: true }}
        />,
      );

      const button = screen.getByRole("button", { name: "Retry" });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("aria-busy", "true");
    });

    it("lets a caller replace the whole error branch", () => {
      render(
        <QueryStateCard {...base} isError error={<p>custom failure</p>}>
          <p>content</p>
        </QueryStateCard>,
      );

      expect(screen.getByText("custom failure")).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("empty", () => {
    it("renders the empty-dataset copy", () => {
      render(
        <QueryStateCard {...base} isEmpty empty={{ title: "No tickets yet." }}>
          <p>content</p>
        </QueryStateCard>,
      );

      expect(screen.getByText("No tickets yet.")).toBeInTheDocument();
      expect(screen.queryByText("content")).not.toBeInTheDocument();
    });

    it("renders an optional CTA in the empty branch", async () => {
      const onClick = vi.fn();
      render(
        <QueryStateCard
          {...base}
          isEmpty
          empty={{
            title: "No articles yet.",
            action: (
              <button type="button" onClick={onClick}>
                Create article
              </button>
            ),
          }}
        />,
      );

      await userEvent.click(screen.getByRole("button", { name: "Create article" }));
      expect(onClick).toHaveBeenCalledOnce();
    });

    it("distinguishes no-matching-results from an empty dataset", () => {
      const props = {
        ...base,
        isEmpty: true,
        empty: { title: "No articles yet." },
        noResults: { title: "No articles match your search." },
      };

      const { rerender } = render(<QueryStateCard {...props} isFiltered={false} />);
      expect(screen.getByText("No articles yet.")).toBeInTheDocument();

      rerender(<QueryStateCard {...props} isFiltered />);
      expect(screen.getByText("No articles match your search.")).toBeInTheDocument();
      expect(screen.queryByText("No articles yet.")).not.toBeInTheDocument();
    });

    it("falls back to the empty copy when a filtered screen supplies none", () => {
      render(<QueryStateCard {...base} isEmpty isFiltered empty={{ title: "No tickets yet." }} />);

      expect(screen.getByText("No tickets yet.")).toBeInTheDocument();
    });

    it("renders nothing when a caller handles emptiness itself", () => {
      const { container } = render(<QueryStateCard {...base} isEmpty />);

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("success", () => {
    it("renders content with no wrapper element of its own", () => {
      const { container } = render(
        <QueryStateCard {...base}>
          <table data-testid="rows" />
        </QueryStateCard>,
      );

      // The table is the container's direct child: nothing was inserted
      // between the caller and its own markup.
      expect(container.firstElementChild).toBe(screen.getByTestId("rows"));
      expect(container.childElementCount).toBe(1);
    });

    it("ignores className on the success branch", () => {
      const { container } = render(
        <QueryStateCard {...base} className="mt-4">
          <table data-testid="rows" />
        </QueryStateCard>,
      );

      expect(container.firstElementChild).not.toHaveClass("mt-4");
    });

    it("prefers loading over a stale error, and error over an unknown empty", () => {
      const props = {
        ...base,
        error: { title: "Could not load tickets." },
        empty: { title: "No tickets yet." },
      };

      const { rerender } = render(<QueryStateCard {...props} isLoading isError isEmpty />);
      expect(screen.getByRole("status", { name: "Loading tickets" })).toBeInTheDocument();

      rerender(<QueryStateCard {...props} isError isEmpty />);
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.queryByText("No tickets yet.")).not.toBeInTheDocument();
    });
  });
});
