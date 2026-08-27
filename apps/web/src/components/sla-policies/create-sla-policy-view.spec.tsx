import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { CreateSlaPolicyView } from "./create-sla-policy-view";
import { useCreateSlaPolicyMutation } from "@/hooks/use-sla-policies";
import { ApiError } from "@/lib/api";
import enMessages from "../../../messages/en.json";
import arMessages from "../../../messages/ar.json";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push }),
}));

vi.mock("@/hooks/use-sla-policies", () => ({
  useCreateSlaPolicyMutation: vi.fn(),
}));

const mockedUseCreateSlaPolicyMutation = vi.mocked(useCreateSlaPolicyMutation);

function renderWithLocale(locale: "en" | "ar" = "en") {
  const messages = locale === "en" ? enMessages : arMessages;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <CreateSlaPolicyView />
    </NextIntlClientProvider>,
  );
}

describe("CreateSlaPolicyView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the form (English)", () => {
    mockedUseCreateSlaPolicyMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);

    renderWithLocale("en");

    expect(screen.getByText("New SLA policy")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create policy" })).toBeInTheDocument();
  });

  it("renders the form (Arabic)", () => {
    mockedUseCreateSlaPolicyMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);

    renderWithLocale("ar");

    expect(screen.getByText("سياسة اتفاقية خدمة جديدة")).toBeInTheDocument();
  });

  it("disables submit until both required targets are entered", () => {
    mockedUseCreateSlaPolicyMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);

    renderWithLocale("en");

    expect(screen.getByRole("button", { name: "Create policy" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Response target (minutes)"), {
      target: { value: "30" },
    });
    expect(screen.getByRole("button", { name: "Create policy" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Resolution target (minutes)"), {
      target: { value: "240" },
    });
    expect(screen.getByRole("button", { name: "Create policy" })).not.toBeDisabled();
  });

  it("rejects a non-integer/zero target on submit without calling the mutation", async () => {
    const mutateAsync = vi.fn();
    mockedUseCreateSlaPolicyMutation.mockReturnValue({ mutateAsync, isPending: false } as never);

    renderWithLocale("en");

    fireEvent.change(screen.getByLabelText("Response target (minutes)"), {
      target: { value: "0" },
    });
    fireEvent.change(screen.getByLabelText("Resolution target (minutes)"), {
      target: { value: "240" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create policy" }));

    expect(
      await screen.findByText(
        "Response and resolution targets must be whole numbers of at least 1 minute.",
      ),
    ).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("submits only the entered optional scoping plus the required targets, and navigates to the list", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: "policy-1" });
    mockedUseCreateSlaPolicyMutation.mockReturnValue({ mutateAsync, isPending: false } as never);

    renderWithLocale("en");

    fireEvent.change(screen.getByLabelText("Department ID"), {
      target: { value: "dept-1" },
    });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "billing" } });
    fireEvent.change(screen.getByLabelText("Response target (minutes)"), {
      target: { value: "30" },
    });
    fireEvent.change(screen.getByLabelText("Resolution target (minutes)"), {
      target: { value: "240" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create policy" }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        departmentId: "dept-1",
        category: "billing",
        responseTargetMinutes: 30,
        resolutionTargetMinutes: 240,
      }),
    );
    expect(push).toHaveBeenCalledWith("/en/sla-policies");
  });

  it("submits with no optional scoping when left blank", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: "policy-1" });
    mockedUseCreateSlaPolicyMutation.mockReturnValue({ mutateAsync, isPending: false } as never);

    renderWithLocale("en");

    fireEvent.change(screen.getByLabelText("Response target (minutes)"), {
      target: { value: "15" },
    });
    fireEvent.change(screen.getByLabelText("Resolution target (minutes)"), {
      target: { value: "60" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create policy" }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        responseTargetMinutes: 15,
        resolutionTargetMinutes: 60,
      }),
    );
  });

  it("renders the backend's own message inline and preserves entered values on a rejected submission", async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new ApiError("Department not found", 404));
    mockedUseCreateSlaPolicyMutation.mockReturnValue({ mutateAsync, isPending: false } as never);

    renderWithLocale("en");

    fireEvent.change(screen.getByLabelText("Department ID"), {
      target: { value: "unknown-dept" },
    });
    fireEvent.change(screen.getByLabelText("Response target (minutes)"), {
      target: { value: "30" },
    });
    fireEvent.change(screen.getByLabelText("Resolution target (minutes)"), {
      target: { value: "240" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create policy" }));

    expect(await screen.findByText("Department not found")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Department ID")).toHaveValue("unknown-dept");
    expect(screen.getByLabelText("Response target (minutes)")).toHaveValue(30);
    expect(screen.getByLabelText("Resolution target (minutes)")).toHaveValue(240);
  });

  it("disables the submit button while the mutation is pending", () => {
    mockedUseCreateSlaPolicyMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: true,
    } as never);

    renderWithLocale("en");

    fireEvent.change(screen.getByLabelText("Response target (minutes)"), {
      target: { value: "30" },
    });
    fireEvent.change(screen.getByLabelText("Resolution target (minutes)"), {
      target: { value: "240" },
    });

    expect(screen.getByRole("button", { name: "Creating..." })).toBeDisabled();
  });
});
