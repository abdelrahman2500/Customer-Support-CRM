import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

function renderTabs(dir: "ltr" | "rtl" = "ltr") {
  document.documentElement.dir = dir;
  return render(
    <Tabs defaultValue="history" dir={dir}>
      <TabsList>
        <TabsTrigger value="history">History</TabsTrigger>
        <TabsTrigger value="csat">CSAT</TabsTrigger>
        <TabsTrigger value="files" disabled>
          Files
        </TabsTrigger>
      </TabsList>
      <TabsContent value="history">History panel</TabsContent>
      <TabsContent value="csat">CSAT panel</TabsContent>
      <TabsContent value="files">Files panel</TabsContent>
    </Tabs>,
  );
}

describe("Tabs", () => {
  it("exposes tablist/tab/tabpanel semantics", () => {
    renderTabs();

    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByRole("tabpanel", { name: "History" })).toBeInTheDocument();
  });

  it("shows only the selected panel", () => {
    renderTabs();

    expect(screen.getByText("History panel")).toBeInTheDocument();
    expect(screen.queryByText("CSAT panel")).not.toBeInTheDocument();
  });

  it("marks the active tab selected", () => {
    renderTabs();

    expect(screen.getByRole("tab", { name: "History" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "CSAT" })).toHaveAttribute("aria-selected", "false");
  });

  it("switches panel on click", async () => {
    const user = userEvent.setup();
    renderTabs();

    await user.click(screen.getByRole("tab", { name: "CSAT" }));
    expect(screen.getByText("CSAT panel")).toBeInTheDocument();
    expect(screen.queryByText("History panel")).not.toBeInTheDocument();
  });

  /** Roving focus: only the active tab is in the page tab order, and arrows
   * move between tabs. That is the behaviour a hand-rolled button row misses. */
  it("moves between tabs with arrow keys, not Tab", async () => {
    const user = userEvent.setup();
    renderTabs();

    await user.click(screen.getByRole("tab", { name: "History" }));
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "CSAT" })).toHaveFocus();
  });

  /** Under dir=rtl the visual order is mirrored, so ArrowLeft must advance
   * to the *next* tab. Radix reads direction; a hand-rolled handler would
   * have to be told. */
  it("follows the document direction under RTL", async () => {
    const user = userEvent.setup();
    renderTabs("rtl");

    await user.click(screen.getByRole("tab", { name: "History" }));
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "CSAT" })).toHaveFocus();

    document.documentElement.dir = "ltr";
  });

  it("skips a disabled tab", async () => {
    const user = userEvent.setup();
    renderTabs();

    const files = screen.getByRole("tab", { name: "Files" });
    expect(files).toBeDisabled();
    await user.click(files);
    expect(screen.queryByText("Files panel")).not.toBeInTheDocument();
  });
});
