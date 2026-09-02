import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TicketAttachmentsCard } from "./ticket-attachments-card";
import {
  useMyTicketAttachmentsQuery,
  useUploadMyTicketAttachmentMutation,
} from "@/hooks/use-portal-attachments";
import { getMyTicketAttachmentDownloadUrl } from "@/lib/attachments-api";
import { ApiError } from "@/lib/api";

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/hooks/use-portal-attachments", () => ({
  useMyTicketAttachmentsQuery: vi.fn(),
  useUploadMyTicketAttachmentMutation: vi.fn(),
}));

vi.mock("@/lib/attachments-api", () => ({
  getMyTicketAttachmentDownloadUrl: vi.fn(),
}));

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

describe("TicketAttachmentsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUploadMyTicketAttachmentMutation).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ id: "attachment-new" }),
      isPending: false,
    } as never);
  });

  it("shows a loading skeleton while attachments are loading", () => {
    vi.mocked(useMyTicketAttachmentsQuery).mockReturnValue(
      queryResult({ isLoading: true }) as never,
    );

    const { container } = render(<TicketAttachmentsCard ticketId="ticket-1" />);

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows an error state when the query fails", () => {
    vi.mocked(useMyTicketAttachmentsQuery).mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
    );

    render(<TicketAttachmentsCard ticketId="ticket-1" />);

    expect(screen.getByText("detail.attachmentsError")).toBeInTheDocument();
  });

  it("shows the empty message when there are no attachments", () => {
    vi.mocked(useMyTicketAttachmentsQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );

    render(<TicketAttachmentsCard ticketId="ticket-1" />);

    expect(screen.getByText("detail.attachmentsEmpty")).toBeInTheDocument();
  });

  it("renders each attachment's filename and formatted size", () => {
    vi.mocked(useMyTicketAttachmentsQuery).mockReturnValue(
      queryResult({
        data: [
          {
            id: "attachment-1",
            filename: "screenshot.png",
            size: 2048,
            mimeType: "image/png",
            uploadedByUserId: null,
            uploadedByContactId: "contact-1",
            createdAt: "2026-01-03T00:00:00.000Z",
          },
        ],
        isSuccess: true,
      }) as never,
    );

    render(<TicketAttachmentsCard ticketId="ticket-1" />);

    expect(screen.getByText("screenshot.png")).toBeInTheDocument();
    expect(screen.getByText(/2\.0 KB/)).toBeInTheDocument();
  });

  it("downloads via getMyTicketAttachmentDownloadUrl and opens the result", async () => {
    vi.mocked(useMyTicketAttachmentsQuery).mockReturnValue(
      queryResult({
        data: [
          {
            id: "attachment-1",
            filename: "screenshot.png",
            size: 2048,
            mimeType: "image/png",
            uploadedByUserId: null,
            uploadedByContactId: "contact-1",
            createdAt: "2026-01-03T00:00:00.000Z",
          },
        ],
        isSuccess: true,
      }) as never,
    );
    vi.mocked(getMyTicketAttachmentDownloadUrl).mockResolvedValue({
      url: "https://minio.local/url",
    });
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(<TicketAttachmentsCard ticketId="ticket-1" />);
    fireEvent.click(screen.getByText("screenshot.png"));

    await vi.waitFor(() => {
      expect(getMyTicketAttachmentDownloadUrl).toHaveBeenCalledWith("ticket-1", "attachment-1");
      expect(windowOpenSpy).toHaveBeenCalledWith(
        "https://minio.local/url",
        "_blank",
        "noopener,noreferrer",
      );
    });
  });

  it("passes the selected file to the upload mutation", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: "attachment-new" });
    vi.mocked(useMyTicketAttachmentsQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(useUploadMyTicketAttachmentMutation).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as never);

    render(<TicketAttachmentsCard ticketId="ticket-1" />);
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await vi.waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(file);
    });
  });

  it("shows the backend's own message for an ApiError upload failure", async () => {
    vi.mocked(useMyTicketAttachmentsQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(useUploadMyTicketAttachmentMutation).mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue(new ApiError("File type not allowed", 400)),
      isPending: false,
    } as never);

    render(<TicketAttachmentsCard ticketId="ticket-1" />);
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await screen.findByText("File type not allowed");
  });

  it("shows the fallback error message for a non-ApiError upload failure", async () => {
    vi.mocked(useMyTicketAttachmentsQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(useUploadMyTicketAttachmentMutation).mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue(new Error("network down")),
      isPending: false,
    } as never);

    render(<TicketAttachmentsCard ticketId="ticket-1" />);
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await screen.findByText("detail.attachmentsUploadFailed");
  });
});
