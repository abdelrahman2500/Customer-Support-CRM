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

const strings = {
  heading: "Attachments",
  error: "Couldn't load attachments.",
  empty: "No attachments yet.",
  uploading: "Uploading...",
  uploadFailedFallback: "Upload failed.",
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
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await vi.waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(file);
    });
  });

  it("shows the fallback error message for a non-ApiError upload failure", async () => {
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
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await screen.findByText(strings.uploadFailedFallback);
  });
});
