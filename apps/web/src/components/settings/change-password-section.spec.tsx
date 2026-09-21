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
}));

vi.mock("@/hooks/use-navigating-router", () => ({
  useNavigatingRouter: () => ({ push }),
}));

vi.mock("@/lib/query-client-registry", () => ({
  clearQueryCache: () => clearQueryCache(),
}));

vi.mock("@/lib/api", async () => {
  // `ApiError` is a real class the component's error classification depends
  // on — only the two side-effecting functions are stubbed.
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

type MutationState = {
  mutate?: ReturnType<typeof vi.fn>;
  isPending?: boolean;
  isError?: boolean;
  isSuccess?: boolean;
  error?: unknown;
};

function mockMutation(state: MutationState = {}) {
  const mutate = state.mutate ?? vi.fn();
  mockedUseChangePasswordMutation.mockReturnValue({
    mutate,
    isPending: state.isPending ?? false,
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

// `FormField` renders the hint and the error *inside* the `<label>`, so a
// field's accessible name is its label text plus whatever guidance is
// currently showing. These anchored patterns match the label's own leading
// text without depending on that trailing copy. Case matters: /^New
// password/ does not also match "Confirm new password".
const LABEL = {
  current: /^Current password/,
  next: /^New password/,
  confirm: /^Confirm new password/,
};

async function fill(user: ReturnType<typeof userEvent.setup>, values: {
  current: string;
  next: string;
  confirm: string;
}) {
  await user.type(screen.getByLabelText(LABEL.current), values.current);
  await user.type(screen.getByLabelText(LABEL.next), values.next);
  await user.type(screen.getByLabelText(LABEL.confirm), values.confirm);
}

describe("ChangePasswordSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutation();
  });

  it("submits the current and new password, and never the confirmation", async () => {
    const user = userEvent.setup();
    const mutate = mockMutation();
    renderSection();

    await fill(user, { current: "OldPassw0rd!", next: "NewPassw0rd!", confirm: "NewPassw0rd!" });
    await user.click(screen.getByRole("button", { name: enMessages.changePassword.submit }));

    expect(mutate).toHaveBeenCalledWith({
      currentPassword: "OldPassw0rd!",
      newPassword: "NewPassw0rd!",
    });
    // The confirmation is a client-side typo guard, not part of the DTO.
    expect(mutate.mock.calls[0]?.[0]).not.toHaveProperty("confirmNewPassword");
  });

  it("does not submit when the confirmation does not match", async () => {
    const user = userEvent.setup();
    const mutate = mockMutation();
    renderSection();

    await fill(user, { current: "OldPassw0rd!", next: "NewPassw0rd!", confirm: "NewPassw0rd?" });

    expect(screen.getByText(enMessages.changePassword.mismatch)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: enMessages.changePassword.submit }));
    expect(mutate).not.toHaveBeenCalled();
  });

  it("does not submit a new password shorter than the backend's own minimum", async () => {
    const user = userEvent.setup();
    const mutate = mockMutation();
    renderSection();

    await fill(user, { current: "OldPassw0rd!", next: "Short1!", confirm: "Short1!" });

    expect(screen.getByText("Must be at least 8 characters.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: enMessages.changePassword.submit }));
    expect(mutate).not.toHaveBeenCalled();
  });

  it("shows the backend's own message when the current password is rejected", () => {
    // 400, not 401 — a 401 would be classified as "your session expired"
    // and, in the real client, would sign the user out mid-form.
    mockMutation({ isError: true, error: new ApiError("Current password is incorrect", 400) });
    renderSection();

    expect(screen.getByText("Current password is incorrect")).toBeInTheDocument();
  });

  it("replaces the form with a sign-in-again prompt on success", async () => {
    const user = userEvent.setup();
    mockMutation({ isSuccess: true });
    renderSection();

    expect(screen.getByText(enMessages.changePassword.success)).toBeInTheDocument();
    expect(
      screen.queryByLabelText(LABEL.current),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: enMessages.changePassword.signInAgain }));

    expect(logout).toHaveBeenCalled();
    expect(clearAccessToken).toHaveBeenCalled();
    expect(clearQueryCache).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/en/login");
  });
});
