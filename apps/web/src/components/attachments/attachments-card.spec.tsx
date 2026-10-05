import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AttachmentsCard } from "./attachments-card";
import { useAttachmentsQuery, useUploadAttachmentMutation } from "@/hooks/use-attachments";
import { getAttachmentDownloadUrl } from "@/lib/attachments-api";
import { ApiError } from "@/lib/api";

vi.mock("@/hooks/use-attachments", () => ({
  useAttachmentsQuery: vi.fn(),
  useUploadAttachmentMutation: vi.fn(),
}));

vi.mock("@/lib/attachments-api", () => ({
  getAttachmentDownloadUrl: vi.fn(),
}));

// Batch 1 (UX audit) — `useErrorMessage()` reads `common.errors.*` via
// `useTranslations("common")`; echoing the key back (mirrors
// `ticket-detail-view.spec.tsx`'s own convention) is enough to distinguish
// the network/forbidden/generic branches without a real message catalog.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const strings = {
  heading: "Attachments",
  error: "Couldn't load attachments.",
  empty: "No attachments yet.",
  uploading: "Uploading...",
  uploadFailedFallback: "Upload failed.",
  uploadForbidden: "Not allowed.",
  // Story 208 (RD-3.8) — the file control is named and described now.
  uploadLabel: "Attach a file",
  dropHint: "or drop it here",
};

function queryResult(overrides: Record<string, unknown>) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    isSuccess: false,
    error: null,
    ...overrides,
  };
}

const ticketOwner = { type: "ticket" as const, id: "ticket-1" };

describe("AttachmentsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUploadAttachmentMutation).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue({ id: "attachment-new" }),
      isPending: false,
      isError: false,
      error: null,
    } as never);
  });

  it("shows a loading skeleton while attachments are loading", () => {
    vi.mocked(useAttachmentsQuery).mockReturnValue(queryResult({ isLoading: true }) as never);

    const { container } = render(
      <AttachmentsCard owner={ticketOwner} locale="en" strings={strings} />,
    );

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();

    // Story 161 -- the skeleton is the hidden placeholder itself, so no
    // wrapper was introduced and its own classes are untouched.
    const status = screen.getByRole("status", { name: "loading" });
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status.children).toHaveLength(1);
    expect(status.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(status.firstElementChild).toHaveClass("animate-pulse", "mt-2", "h-24", "w-full");
  });

  it("shows an error state when the query fails", () => {
    vi.mocked(useAttachmentsQuery).mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
    );

    render(<AttachmentsCard owner={ticketOwner} locale="en" strings={strings} />);

    expect(screen.getByText(strings.error)).toBeInTheDocument();
  });

  it("shows the empty message when there are no attachments", () => {
    vi.mocked(useAttachmentsQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );

    render(<AttachmentsCard owner={ticketOwner} locale="en" strings={strings} />);

    expect(screen.getByText(strings.empty)).toBeInTheDocument();
  });

  it("renders each attachment's filename and formatted size", () => {
    vi.mocked(useAttachmentsQuery).mockReturnValue(
      queryResult({
        data: [
          {
            id: "attachment-1",
            filename: "screenshot.png",
            size: 2048,
            mimeType: "image/png",
            uploadedByUserId: "user-1",
            createdAt: "2024-01-03T00:00:00.000Z",
          },
        ],
        isSuccess: true,
      }) as never,
    );

    render(<AttachmentsCard owner={ticketOwner} locale="en" strings={strings} />);

    expect(screen.getByText("screenshot.png")).toBeInTheDocument();
    expect(screen.getByText(/2\.0 KB/)).toBeInTheDocument();
  });

  it("passes the owner through to getAttachmentDownloadUrl and opens the result", async () => {
    vi.mocked(useAttachmentsQuery).mockReturnValue(
      queryResult({
        data: [
          {
            id: "attachment-1",
            filename: "screenshot.png",
            size: 2048,
            mimeType: "image/png",
            uploadedByUserId: "user-1",
            createdAt: "2024-01-03T00:00:00.000Z",
          },
        ],
        isSuccess: true,
      }) as never,
    );
    vi.mocked(getAttachmentDownloadUrl).mockResolvedValue({ url: "https://minio.local/url" });
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(<AttachmentsCard owner={ticketOwner} locale="en" strings={strings} />);
    fireEvent.click(screen.getByText("screenshot.png"));

    await vi.waitFor(() => {
      expect(getAttachmentDownloadUrl).toHaveBeenCalledWith(ticketOwner, "attachment-1");
      expect(windowOpenSpy).toHaveBeenCalledWith(
        "https://minio.local/url",
        "_blank",
        "noopener,noreferrer",
      );
    });
  });

  it("passes the selected file to the upload mutation", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: "attachment-new" });
    vi.mocked(useAttachmentsQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(useUploadAttachmentMutation).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync,
      isPending: false,
      isError: false,
      error: null,
    } as never);

    render(<AttachmentsCard owner={ticketOwner} locale="en" strings={strings} />);
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    // Story 208 (RD-3.8, recon A11Y-02) — the same file input, found by the
    // name it has now.
    const input = screen.getByLabelText(strings.uploadLabel);
    fireEvent.change(input, { target: { files: [file] } });

    await vi.waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(file);
    });
  });

  it("shows the shared network-error message for a non-ApiError upload failure", async () => {
    vi.mocked(useAttachmentsQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(useUploadAttachmentMutation).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockRejectedValue(new Error("network down")),
      isPending: false,
      isError: false,
      error: null,
    } as never);

    render(<AttachmentsCard owner={ticketOwner} locale="en" strings={strings} />);
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    // Story 208 (RD-3.8, recon A11Y-02) — the same file input, found by the
    // name it has now.
    const input = screen.getByLabelText(strings.uploadLabel);
    fireEvent.change(input, { target: { files: [file] } });

    // Batch 1 (UX audit) — a non-`ApiError` rejection is a network failure,
    // never the feature's own generic fallback text (the mocked `next-intl`
    // echoes the `common.errors.network` key back verbatim).
    await screen.findByText("errors.network");
  });

  it("shows the caller's own forbidden text for a 403 upload rejection", async () => {
    vi.mocked(useAttachmentsQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(useUploadAttachmentMutation).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockRejectedValue(new ApiError("Forbidden", 403)),
      isPending: false,
      isError: false,
      error: null,
    } as never);

    render(<AttachmentsCard owner={ticketOwner} locale="en" strings={strings} />);
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    // Story 208 (RD-3.8, recon A11Y-02) — the same file input, found by the
    // name it has now.
    const input = screen.getByLabelText(strings.uploadLabel);
    fireEvent.change(input, { target: { files: [file] } });

    await screen.findByText(strings.uploadForbidden);
  });

  it("shows the caller's own generic fallback for an unexpected 500 upload rejection", async () => {
    vi.mocked(useAttachmentsQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(useUploadAttachmentMutation).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockRejectedValue(new ApiError("stack trace-ish internals", 500)),
      isPending: false,
      isError: false,
      error: null,
    } as never);

    render(<AttachmentsCard owner={ticketOwner} locale="en" strings={strings} />);
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    // Story 208 (RD-3.8, recon A11Y-02) — the same file input, found by the
    // name it has now.
    const input = screen.getByLabelText(strings.uploadLabel);
    fireEvent.change(input, { target: { files: [file] } });

    // Never the raw 500 body — that's the exact leak this batch closes.
    await screen.findByText(strings.uploadFailedFallback);
    expect(screen.queryByText("stack trace-ish internals")).not.toBeInTheDocument();
  });

  // Story 208 (RD-3.8, recon A11Y-02) — a named file control and drop target.
  it("names the file control and describes it as a drop target", () => {
    vi.mocked(useAttachmentsQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );

    render(<AttachmentsCard owner={ticketOwner} locale="en" strings={strings} />);

    const input = screen.getByLabelText(strings.uploadLabel);
    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAccessibleDescription(strings.dropHint);
  });

  it("uploads a dropped file through the same mutation", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: "attachment-new" });
    vi.mocked(useAttachmentsQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(useUploadAttachmentMutation).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync,
      isPending: false,
      isError: false,
      error: null,
    } as never);

    render(<AttachmentsCard owner={ticketOwner} locale="en" strings={strings} />);
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    const zone = screen.getByLabelText(strings.uploadLabel).closest("label")!;
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });

    await vi.waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(file));
  });

  it("disables the control while an upload is in flight", () => {
    vi.mocked(useAttachmentsQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(useUploadAttachmentMutation).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: true,
      isError: false,
      error: null,
    } as never);

    render(<AttachmentsCard owner={ticketOwner} locale="en" strings={strings} />);

    expect(screen.getByLabelText(strings.uploadLabel)).toBeDisabled();
    expect(screen.getByText(strings.uploading)).toBeInTheDocument();
  });
});
