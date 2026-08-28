import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WorkspaceNav } from "./workspace-nav";
import { clearAccessToken, logout } from "@/lib/api";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}));

vi.mock("@/lib/api", () => ({
  logout: vi.fn(),
  clearAccessToken: vi.fn(),
}));

const mockedLogout = vi.mocked(logout);
const mockedClearAccessToken = vi.mocked(clearAccessToken);

const user = {
  id: "user-1",
  email: "agent@example.com",
  fullName: "Ada Lovelace",
  branchId: "branch-1",
  departmentId: null,
  roles: ["Agent"],
};

describe("WorkspaceNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedLogout.mockResolvedValue(undefined);
  });

  it("renders the app name and the signed-in user's name", () => {
    render(<WorkspaceNav user={user} />);

    expect(screen.getByText("appName")).toBeInTheDocument();
    expect(screen.getByText(`signedInAs:${JSON.stringify({ name: user.fullName })}`)).toBeInTheDocument();
  });

  it("calls the real logout, then clears the local token and redirects to login, on sign-out", async () => {
    render(<WorkspaceNav user={user} />);

    fireEvent.click(screen.getByText("signOut"));

    await waitFor(() => expect(mockedLogout).toHaveBeenCalledOnce());
    expect(mockedClearAccessToken).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledWith("/en/login");
  });

  it("still clears the local token and redirects even when the logout call rejects", async () => {
    mockedLogout.mockRejectedValue(new Error("network down"));

    render(<WorkspaceNav user={user} />);

    fireEvent.click(screen.getByText("signOut"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/en/login"));
    expect(mockedClearAccessToken).toHaveBeenCalledOnce();
  });

  it("awaits logout before clearing the local token and redirecting, not fire-and-forget", async () => {
    let resolveLogout!: () => void;
    mockedLogout.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveLogout = resolve;
      }),
    );

    render(<WorkspaceNav user={user} />);
    fireEvent.click(screen.getByText("signOut"));

    // Let any already-queued microtasks run while the logout promise is
    // still pending — cleanup/redirect must not have happened yet.
    await Promise.resolve();
    await Promise.resolve();
    expect(mockedClearAccessToken).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();

    resolveLogout();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/en/login"));
    expect(mockedClearAccessToken).toHaveBeenCalledOnce();
  });
});
