import { vi, describe, it, expect, type Mock } from "vitest";
import { toast } from "beez-ui";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";


import MonthlyExpensesPage from "@/modules/monthly-expenses/shared/pages/monthly-expenses-page";

import {
  basePageProps,
  createMockRouter,
  createMonthlyExpensesFetchMock,
  registerMonthlyExpensesPageDefaultHooks,
  renderWithProviders,
} from "./monthly-expenses-page-test-helpers";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("sonner", () => {
  const mockToast = Object.assign(vi.fn(), {
    error: vi.fn(),
    info: vi.fn(),
    promise: vi.fn((promise: Promise<unknown>) => promise),
    success: vi.fn(),
    warning: vi.fn(),
  });

  return {
    toast: mockToast,
  };
});

type MockedToast = Mock & {
  error: Mock;
  info: Mock;
  promise: Mock;
  success: Mock;
  warning: Mock;
};

const mockedUsePathname = vi.mocked(usePathname);
const mockedUseRouter = vi.mocked(useRouter);
const mockedUseSearchParams = vi.mocked(useSearchParams);
const mockedUseSession = vi.mocked(useSession);
const mockedSignIn = vi.mocked(signIn);
const mockedSignOut = vi.mocked(signOut);
const mockedToast = toast as unknown as MockedToast;
const originalFetch = global.fetch;

const INITIAL_DOCUMENT = {
  items: [
    {
      currency: "ARS" as const,
      description: "Internet",
      id: "expense-1",
      occurrencesPerMonth: 1,
      subtotal: 1000,
      total: 1000,
    },
    {
      currency: "ARS" as const,
      description: "Luz",
      id: "expense-2",
      occurrencesPerMonth: 1,
      subtotal: 500,
      total: 500,
    },
  ],
  month: "2026-03",
};

function authenticateSession() {
  mockedUseSession.mockReturnValue({
    data: {
      expires: "2099-01-01T00:00:00.000Z",
      user: {
        email: "gus@example.com",
        name: "Gus",
      },
    },
    status: "authenticated",
    update: vi.fn(),
  } as ReturnType<typeof useSession>);
}

function getSaveCalls(fetchMock: Mock) {
  return fetchMock.mock.calls.filter(
    ([url]) => url === "/api/storage/monthly-expenses",
  );
}

function getLastUndoAction(): (() => void) | null {
  const deleteToastCall = [...mockedToast.mock.calls]
    .reverse()
    .find(([, options]) => options?.action?.label === "Deshacer");

  return deleteToastCall?.[1]?.action?.onClick ?? null;
}

async function deleteExpenseFromRowMenu(
  user: ReturnType<typeof userEvent.setup>,
  description: string,
) {
  await user.click(
    screen.getByRole("button", { name: `Abrir acciones para ${description}` }),
  );
  await user.click(screen.getByRole("menuitem", { name: "Eliminar" }));
  await user.click(screen.getByRole("button", { name: "Confirmar" }));
}

describe("MonthlyExpensesPage optimistic delete with undo", () => {
  registerMonthlyExpensesPageDefaultHooks({
    createDefaultRouter: () => createMockRouter(),
    mockedUsePathname,
    mockedSignIn,
    mockedSignOut,
    mockedToast,
    mockedUseRouter,
    mockedUseSearchParams,
    mockedUseSession,
    originalFetch,
  });

  it("removes the row immediately and persists only after the grace window", async () => {
    authenticateSession();
    const fetchMock = createMonthlyExpensesFetchMock();
    global.fetch = fetchMock as typeof fetch;

    vi.useFakeTimers();

    try {
      const user = userEvent.setup({
        advanceTimers: vi.advanceTimersByTime,
      });

      renderWithProviders(
        <MonthlyExpensesPage
          {...basePageProps}
          initialDocument={INITIAL_DOCUMENT}
        />,
      );

      await deleteExpenseFromRowMenu(user, "Internet");

      // Optimista: la fila ya no está y todavía no salió ningún POST.
      expect(screen.queryByText("Internet")).not.toBeInTheDocument();
      expect(screen.getByText("Luz")).toBeInTheDocument();
      expect(getSaveCalls(fetchMock)).toHaveLength(0);
      expect(mockedToast).toHaveBeenCalledWith(
        "Gasto eliminado.",
        expect.objectContaining({
          action: expect.objectContaining({ label: "Deshacer" }),
        }),
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(7_000);
      });

      expect(getSaveCalls(fetchMock)).toHaveLength(1);

      const [, requestInit] = getSaveCalls(fetchMock)[0] as [
        string,
        RequestInit,
      ];
      const payload = JSON.parse(String(requestInit.body));

      expect(
        payload.items.map((item: { id: string }) => item.id),
      ).toEqual(["expense-2"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("restores the rows without any request when undo is clicked", async () => {
    authenticateSession();
    const fetchMock = createMonthlyExpensesFetchMock();
    global.fetch = fetchMock as typeof fetch;

    vi.useFakeTimers();

    try {
      const user = userEvent.setup({
        advanceTimers: vi.advanceTimersByTime,
      });

      renderWithProviders(
        <MonthlyExpensesPage
          {...basePageProps}
          initialDocument={INITIAL_DOCUMENT}
        />,
      );

      await deleteExpenseFromRowMenu(user, "Internet");
      expect(screen.queryByText("Internet")).not.toBeInTheDocument();

      const undoAction = getLastUndoAction();

      expect(undoAction).not.toBeNull();

      act(() => {
        undoAction?.();
      });

      // La fila vuelve en su posición original y nunca sale un POST.
      expect(screen.getByText("Internet")).toBeInTheDocument();
      expect(mockedToast.success).toHaveBeenCalledWith(
        "Eliminación deshecha.",
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });

      expect(getSaveCalls(fetchMock)).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("merges a second delete into the same undo window", async () => {
    authenticateSession();
    const fetchMock = createMonthlyExpensesFetchMock();
    global.fetch = fetchMock as typeof fetch;

    vi.useFakeTimers();

    try {
      const user = userEvent.setup({
        advanceTimers: vi.advanceTimersByTime,
      });

      renderWithProviders(
        <MonthlyExpensesPage
          {...basePageProps}
          initialDocument={INITIAL_DOCUMENT}
        />,
      );

      await deleteExpenseFromRowMenu(user, "Internet");
      await deleteExpenseFromRowMenu(user, "Luz");

      expect(mockedToast).toHaveBeenCalledWith(
        "2 gastos eliminados.",
        expect.anything(),
      );

      const undoAction = getLastUndoAction();

      act(() => {
        undoAction?.();
      });

      expect(screen.getByText("Internet")).toBeInTheDocument();
      expect(screen.getByText("Luz")).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });

      expect(getSaveCalls(fetchMock)).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("restores the rows and shows an error when the deferred save fails", async () => {
    authenticateSession();
    const fetchMock = createMonthlyExpensesFetchMock({ saveError: "boom" });
    global.fetch = fetchMock as typeof fetch;

    vi.useFakeTimers();

    try {
      const user = userEvent.setup({
        advanceTimers: vi.advanceTimersByTime,
      });

      renderWithProviders(
        <MonthlyExpensesPage
          {...basePageProps}
          initialDocument={INITIAL_DOCUMENT}
        />,
      );

      await deleteExpenseFromRowMenu(user, "Internet");
      expect(screen.queryByText("Internet")).not.toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(7_000);
      });

      await waitFor(() => {
        expect(screen.getByText("Internet")).toBeInTheDocument();
      });
      expect(mockedToast.error).toHaveBeenCalledWith(
        "No pudimos eliminar. Restauramos los gastos.",
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
