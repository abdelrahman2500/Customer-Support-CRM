import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { ChangePasswordSection } from "./change-password-section";
import { useChangePasswordMutation } from "@/hooks/use-change-password";
import { ApiError } from "@/lib/api";
import enMessages from "../../../messages/en.json";

const push = vi.fn();
const logout = vi.fn();
const clearAccessToken = vi.fn();
const clearQueryCache = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/query-client-registry", () => ({
  clearQueryCache: () => clearQueryCache(),
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    logout: () => logout(),
    clearAccessToken: () => clearAccessToken(),
  };
});

vi.mock("@/hooks/use-change-password", () => ({
  useChangePasswordMutation: vi.fn(),
}));

const mockedUseChangePasswordMutation = vi.mocked(useChangePasswordMutation);

const copy = enMessages.account.changePassword;

// See `apps/web`'s own copy of this spec for why these are anchored
// patterns rather than exact label strings.
const LABEL = {
  current: /^Current password/,
  next: /^New password/,
  confirm: /^Confirm new password/,
};

function mockMutation(
  state: { mutate?: ReturnType<typeof vi.fn>; isError?: boolean; isSuccess?: boolean; error?: unknown } = {},
) {
  const mutate = state.mutate ?? vi.fn();
  mockedUseChangePasswordMutation.mockReturnValue({
    mutate,
    isPending: false,
    isError: state.isError ?? false,
    isSuccess: state.isSuccess ?? false,
    error: state.error ?? null,
  } as unknown as ReturnType<typeof useChangePasswordMutation>);
  return mutate;
}

function renderSection() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ChangePasswordSection />
    </NextIntlClientProvider>,
  );
}

describe("portal ChangePasswordSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutation();
  });

  it("submits the current and new password only", async () => {
    const user = userEvent.setup();
    const mutate = mockMutation();
    renderSection();

    await user.type(screen.getByLabelText(LABEL.current), "OldPassw0rd!");
    await user.type(screen.getByLabelText(LABEL.next), "NewPassw0rd!");
    await user.type(screen.getByLabelText(LABEL.confirm), "NewPassw0rd!");
    await user.click(screen.getByRole("button", { name: copy.submit }));

    expect(mutate).toHaveBeenCalledWith({
      currentPassword: "OldPassw0rd!",
      newPassword: "NewPassw0rd!",
    });
  });

  it("does not submit when the confirmation does not match", async () => {
    const user = userEvent.setup();
    const mutate = mockMutation();
    renderSection();

    await user.type(screen.getByLabelText(LABEL.current), "OldPassw0rd!");
    await user.type(screen.getByLabelText(LABEL.next), "NewPassw0rd!");
    await user.type(screen.getByLabelText(LABEL.confirm), "NewPassw0rd?");
    await user.click(screen.getByRole("button", { name: copy.submit }));

    expect(screen.getByText(copy.mismatch)).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("shows the backend's own message when the current password is rejected", () => {
    mockMutation({ isError: true, error: new ApiError("Current password is incorrect", 400) });
    renderSection();

    expect(screen.getByText("Current password is incorrect")).toBeInTheDocument();
  });

  it("signs the contact out when they acknowledge the success state", async () => {
    const user = userEvent.setup();
    mockMutation({ isSuccess: true });
    renderSection();

    expect(screen.getByText(copy.success)).toBeInTheDocument();
    expect(screen.queryByLabelText(LABEL.current)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: copy.signInAgain }));

    expect(logout).toHaveBeenCalled();
    expect(clearAccessToken).toHaveBeenCalled();
    expect(clearQueryCache).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/en/login");
  });
});
