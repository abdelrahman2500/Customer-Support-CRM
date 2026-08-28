import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { CreateUserView } from "./create-user-view";
import { useBranchesQuery, useCreateUserMutation, useDepartmentsQuery } from "@/hooks/use-tickets";
import { useRolesQuery } from "@/hooks/use-roles";
import { ApiError } from "@/lib/api";
import enMessages from "../../../messages/en.json";
import arMessages from "../../../messages/ar.json";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push }),
}));

vi.mock("@/hooks/use-tickets", () => ({
  useBranchesQuery: vi.fn(),
  useDepartmentsQuery: vi.fn(),
  useCreateUserMutation: vi.fn(),
}));

vi.mock("@/hooks/use-roles", () => ({
  useRolesQuery: vi.fn(),
}));

const mockedUseBranchesQuery = vi.mocked(useBranchesQuery);
const mockedUseDepartmentsQuery = vi.mocked(useDepartmentsQuery);
const mockedUseCreateUserMutation = vi.mocked(useCreateUserMutation);
const mockedUseRolesQuery = vi.mocked(useRolesQuery);

function queryResult(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    isSuccess: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

const oneBranch = [{ id: "branch-1", name: "Main Branch" }];
const oneDepartment = [{ id: "dept-1", branchId: "branch-1", name: "Support" }];
const oneRole = [{ id: "role-1", name: "Agent", permissions: [] }];

function renderWithLocale(locale: "en" | "ar" = "en") {
  const messages = locale === "en" ? enMessages : arMessages;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <CreateUserView />
    </NextIntlClientProvider>,
  );
}

describe("CreateUserView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseBranchesQuery.mockReturnValue(queryResult({ data: oneBranch, isSuccess: true }) as never);
    mockedUseDepartmentsQuery.mockReturnValue(
      queryResult({ data: oneDepartment, isSuccess: true }) as never,
    );
    mockedUseRolesQuery.mockReturnValue(queryResult({ data: oneRole, isSuccess: true }) as never);
    mockedUseCreateUserMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
  });

  it("renders the form with the real branch/department/role options loaded (English)", () => {
    renderWithLocale("en");

    expect(screen.getByText("New user")).toBeInTheDocument();
    expect(screen.getByText("Main Branch")).toBeInTheDocument();
  });

  it("renders the form (Arabic)", () => {
    renderWithLocale("ar");

    expect(screen.getByText("مستخدم جديد")).toBeInTheDocument();
  });

  it("shows a loading skeleton state is not required, but the submit button starts disabled until all required fields are filled", () => {
    renderWithLocale("en");

    expect(screen.getByRole("button", { name: "Create user" })).toBeDisabled();
  });

  it("shows load-error messages for branches, departments, and roles independently", () => {
    mockedUseBranchesQuery.mockReturnValue(queryResult({ isError: true }) as never);
    mockedUseDepartmentsQuery.mockReturnValue(queryResult({ isError: true }) as never);
    mockedUseRolesQuery.mockReturnValue(queryResult({ isError: true }) as never);

    renderWithLocale("en");

    expect(screen.getByText("Couldn't load branches.")).toBeInTheDocument();
    expect(screen.getByText("Couldn't load departments.")).toBeInTheDocument();
    expect(screen.getByText("Couldn't load roles.")).toBeInTheDocument();
  });

  it("renders with empty pickers when branches/departments/roles have not loaded any data yet", () => {
    mockedUseBranchesQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);
    mockedUseDepartmentsQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);
    mockedUseRolesQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);

    renderWithLocale("en");

    // No branch/department/role options rendered, but the form itself still
    // renders without crashing and the submit button stays disabled.
    expect(screen.getByRole("button", { name: "Create user" })).toBeDisabled();
  });

  it("submits exactly the CreateUserDto shape (no departmentId) when the department is left unset, and navigates to /users", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: "user-42", email: "new@example.com" });
    mockedUseCreateUserMutation.mockReturnValue({ mutateAsync, isPending: false } as never);

    renderWithLocale("en");

    fireEvent.change(screen.getByLabelText("Email", { exact: false }), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password", { exact: false }), {
      target: { value: "supersecret" },
    });
    fireEvent.change(screen.getByLabelText("Full name", { exact: false }), {
      target: { value: "New Agent" },
    });

    fireEvent.click(screen.getByText("Select a branch"));
    fireEvent.click(await screen.findByRole("option", { name: "Main Branch" }));

    fireEvent.click(screen.getByText("Select a role"));
    fireEvent.click(await screen.findByRole("option", { name: "Agent" }));

    fireEvent.click(screen.getByRole("button", { name: "Create user" }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        email: "new@example.com",
        password: "supersecret",
        fullName: "New Agent",
        branchId: "branch-1",
        roleId: "role-1",
      }),
    );
    expect(push).toHaveBeenCalledWith("/en/users");
  });

  it("includes departmentId in the payload once a department is explicitly selected", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: "user-42", email: "new@example.com" });
    mockedUseCreateUserMutation.mockReturnValue({ mutateAsync, isPending: false } as never);

    renderWithLocale("en");

    fireEvent.change(screen.getByLabelText("Email", { exact: false }), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password", { exact: false }), {
      target: { value: "supersecret" },
    });
    fireEvent.change(screen.getByLabelText("Full name", { exact: false }), {
      target: { value: "New Agent" },
    });

    fireEvent.click(screen.getByText("Select a branch"));
    fireEvent.click(await screen.findByRole("option", { name: "Main Branch" }));

    // The department combobox has no placeholder text once rendered (it
    // defaults to "No department"); find it via its combobox role instead.
    const departmentCombobox = screen.getAllByRole("combobox")[1] as HTMLElement;
    fireEvent.click(departmentCombobox);
    fireEvent.click(await screen.findByRole("option", { name: "Support" }));

    fireEvent.click(screen.getByText("Select a role"));
    fireEvent.click(await screen.findByRole("option", { name: "Agent" }));

    fireEvent.click(screen.getByRole("button", { name: "Create user" }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        email: "new@example.com",
        password: "supersecret",
        fullName: "New Agent",
        branchId: "branch-1",
        roleId: "role-1",
        departmentId: "dept-1",
      }),
    );
  });

  it("renders the backend's own message inline on a rejected submission, preserves entered values, and does not navigate", async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new ApiError("Email already in use", 409));
    mockedUseCreateUserMutation.mockReturnValue({ mutateAsync, isPending: false } as never);

    renderWithLocale("en");

    fireEvent.change(screen.getByLabelText("Email", { exact: false }), {
      target: { value: "dup@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password", { exact: false }), {
      target: { value: "supersecret" },
    });
    fireEvent.change(screen.getByLabelText("Full name", { exact: false }), {
      target: { value: "New Agent" },
    });

    fireEvent.click(screen.getByText("Select a branch"));
    fireEvent.click(await screen.findByRole("option", { name: "Main Branch" }));

    fireEvent.click(screen.getByText("Select a role"));
    fireEvent.click(await screen.findByRole("option", { name: "Agent" }));

    fireEvent.click(screen.getByRole("button", { name: "Create user" }));

    expect(await screen.findByText("Email already in use")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();

    // Entered values are preserved — the failed submission did not clear the form.
    expect(screen.getByDisplayValue("dup@example.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("supersecret")).toBeInTheDocument();
    expect(screen.getByDisplayValue("New Agent")).toBeInTheDocument();
  });

  it("falls back to a generic message when the rejection is not an ApiError", async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new Error("network down"));
    mockedUseCreateUserMutation.mockReturnValue({ mutateAsync, isPending: false } as never);

    renderWithLocale("en");

    fireEvent.change(screen.getByLabelText("Email", { exact: false }), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password", { exact: false }), {
      target: { value: "supersecret" },
    });
    fireEvent.change(screen.getByLabelText("Full name", { exact: false }), {
      target: { value: "New Agent" },
    });

    fireEvent.click(screen.getByText("Select a branch"));
    fireEvent.click(await screen.findByRole("option", { name: "Main Branch" }));

    fireEvent.click(screen.getByText("Select a role"));
    fireEvent.click(await screen.findByRole("option", { name: "Agent" }));

    fireEvent.click(screen.getByRole("button", { name: "Create user" }));

    expect(await screen.findByText("Couldn't create the user. Please try again.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows a submitting state and disables the button while the mutation is pending", () => {
    mockedUseCreateUserMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: true } as never);

    renderWithLocale("en");

    expect(screen.getByRole("button", { name: "Creating..." })).toBeDisabled();
  });
});
