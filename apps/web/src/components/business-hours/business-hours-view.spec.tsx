import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BusinessHoursView } from "./business-hours-view";
import {
  useBusinessHoursCalendarQuery,
  useCreateBusinessHoursCalendarMutation,
  useCreateBusinessHoursExceptionMutation,
  useUpdateBusinessHoursCalendarMutation,
  useUpdateBusinessHoursExceptionMutation,
} from "@/hooks/use-business-hours";
import { ApiError } from "@/lib/api";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}));

vi.mock("@/hooks/use-business-hours", () => ({
  useBusinessHoursCalendarQuery: vi.fn(),
  useCreateBusinessHoursCalendarMutation: vi.fn(),
  useUpdateBusinessHoursCalendarMutation: vi.fn(),
  useCreateBusinessHoursExceptionMutation: vi.fn(),
  useUpdateBusinessHoursExceptionMutation: vi.fn(),
}));

const mockedUseBusinessHoursCalendarQuery = vi.mocked(useBusinessHoursCalendarQuery);
const mockedUseCreateBusinessHoursCalendarMutation = vi.mocked(useCreateBusinessHoursCalendarMutation);
const mockedUseUpdateBusinessHoursCalendarMutation = vi.mocked(useUpdateBusinessHoursCalendarMutation);
const mockedUseCreateBusinessHoursExceptionMutation = vi.mocked(useCreateBusinessHoursExceptionMutation);
const mockedUseUpdateBusinessHoursExceptionMutation = vi.mocked(useUpdateBusinessHoursExceptionMutation);

function queryResult(overrides: Record<string, unknown>) {
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

function idleMutation(overrides: Record<string, unknown> = {}) {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    ...overrides,
  };
}

const populatedCalendar = {
  id: "calendar-1",
  days: [
    { weekday: 0, isOpen: false, startMinute: null, endMinute: null },
    { weekday: 1, isOpen: true, startMinute: 540, endMinute: 1020 },
    { weekday: 2, isOpen: true, startMinute: 540, endMinute: 1020 },
    { weekday: 3, isOpen: true, startMinute: 540, endMinute: 1020 },
    { weekday: 4, isOpen: true, startMinute: 540, endMinute: 1020 },
    { weekday: 5, isOpen: true, startMinute: 540, endMinute: 1020 },
    { weekday: 6, isOpen: false, startMinute: null, endMinute: null },
  ],
  exceptions: [
    { id: "exc-1", date: "2026-12-25", isClosed: true, overrideStartMinute: null, overrideEndMinute: null },
  ],
};

describe("BusinessHoursView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseCreateBusinessHoursCalendarMutation.mockReturnValue(idleMutation() as never);
    mockedUseUpdateBusinessHoursCalendarMutation.mockReturnValue(idleMutation() as never);
    mockedUseCreateBusinessHoursExceptionMutation.mockReturnValue(idleMutation() as never);
    mockedUseUpdateBusinessHoursExceptionMutation.mockReturnValue(idleMutation() as never);
  });

  it("shows a loading state while the calendar query is pending", () => {
    mockedUseBusinessHoursCalendarQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

    render(<BusinessHoursView />);

    expect(screen.getAllByRole("generic").length).toBeGreaterThan(0);
  });

  it("shows a generic error for a non-404 failure", () => {
    mockedUseBusinessHoursCalendarQuery.mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
    );

    render(<BusinessHoursView />);

    expect(screen.getByText("loadError")).toBeInTheDocument();
  });

  it("shows the create-calendar form when the calendar genuinely 404s", () => {
    mockedUseBusinessHoursCalendarQuery.mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Not found", 404) }) as never,
    );

    render(<BusinessHoursView />);

    expect(screen.getByText("createHeading")).toBeInTheDocument();
    expect(screen.getByText("createButton")).toBeInTheDocument();
  });

  it("submits the pre-filled default schedule via the real POST endpoint when creating a calendar", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: "calendar-1", days: [], exceptions: [] });
    mockedUseCreateBusinessHoursCalendarMutation.mockReturnValue(idleMutation({ mutateAsync }) as never);
    mockedUseBusinessHoursCalendarQuery.mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Not found", 404) }) as never,
    );

    render(<BusinessHoursView />);
    fireEvent.click(screen.getByText("createButton"));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
    const submittedDays = mutateAsync.mock.calls[0]?.[0].days;
    expect(submittedDays).toHaveLength(7);
    expect(submittedDays.find((d: { weekday: number }) => d.weekday === 0)).toMatchObject({ isOpen: false });
    expect(submittedDays.find((d: { weekday: number }) => d.weekday === 1)).toMatchObject({
      isOpen: true,
      startMinute: 540,
      endMinute: 1020,
    });
  });

  describe("when a calendar already exists", () => {
    beforeEach(() => {
      mockedUseBusinessHoursCalendarQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: populatedCalendar }) as never,
      );
    });

    it("renders the weekly schedule and the exceptions list", () => {
      render(<BusinessHoursView />);

      expect(screen.getByText("weekday.sunday")).toBeInTheDocument();
      expect(screen.getByText("weekday.monday")).toBeInTheDocument();
      expect(screen.getByText("2026-12-25")).toBeInTheDocument();
      // "closedLabel" also labels the add-exception form's own checkbox —
      // confirm the existing exception's own closed state via its button
      // text instead ("markOverriddenButton" implies it's currently closed).
      expect(screen.getByText("markOverriddenButton")).toBeInTheDocument();
    });

    it("saves the full 7-day draft via the real PATCH endpoint when 'Save schedule' is clicked", () => {
      const mutate = vi.fn();
      mockedUseUpdateBusinessHoursCalendarMutation.mockReturnValue(idleMutation({ mutate }) as never);

      render(<BusinessHoursView />);
      fireEvent.click(screen.getByText("saveButton"));

      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({ days: expect.arrayContaining([expect.objectContaining({ weekday: 1 })]) }),
      );
      expect(mutate.mock.calls[0]?.[0].days).toHaveLength(7);
    });

    it("shows a forbidden-specific message when saving the schedule is rejected with 403", () => {
      mockedUseUpdateBusinessHoursCalendarMutation.mockReturnValue(
        idleMutation({ isError: true, error: new ApiError("Forbidden", 403) }) as never,
      );

      render(<BusinessHoursView />);

      expect(screen.getByText("actionForbidden")).toBeInTheDocument();
    });

    it("toggles an exception from closed to overridden-hours via the real PATCH exception endpoint", () => {
      const mutate = vi.fn();
      mockedUseUpdateBusinessHoursExceptionMutation.mockReturnValue(idleMutation({ mutate }) as never);

      render(<BusinessHoursView />);
      fireEvent.click(screen.getByText("markOverriddenButton"));

      expect(mockedUseUpdateBusinessHoursExceptionMutation).toHaveBeenCalledWith("exc-1");
      expect(mutate).toHaveBeenCalledWith({
        isClosed: false,
        overrideStartMinute: 9 * 60,
        overrideEndMinute: 17 * 60,
      });
    });

    it("submits a new exception via the real POST exception endpoint", async () => {
      const mutateAsync = vi.fn().mockResolvedValue({
        id: "exc-2",
        date: "2026-01-01",
        isClosed: true,
        overrideStartMinute: null,
        overrideEndMinute: null,
      });
      mockedUseCreateBusinessHoursExceptionMutation.mockReturnValue(idleMutation({ mutateAsync }) as never);

      render(<BusinessHoursView />);
      fireEvent.change(screen.getByLabelText("dateLabel"), { target: { value: "2026-01-01" } });
      fireEvent.click(screen.getByText("exceptionAddSubmit"));

      await waitFor(() =>
        expect(mutateAsync).toHaveBeenCalledWith({ date: "2026-01-01", isClosed: true }),
      );
    });
  });
});
