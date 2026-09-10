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
      occurrencesPerMonth: 2,
      subtotal: 1000,
      total: 2000,
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
  const markPaidToastCall = [...mockedToast.mock.calls]
    .reverse()
    .find(([, options]) => options?.action?.label === "Deshacer");

  return markPaidToastCall?.[1]?.action?.onClick ?? null;
}

describe("MonthlyExpensesPage optimistic mark as paid", () => {
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

  it("covers the remaining payments immediately and persists after the grace window", async () => {
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

      expect(screen.getByText("0 / 2")).toBeInTheDocument();

      await user.click(
        screen.getByRole("button", {
          name: "Marcar Internet como pagado",
        }),
      );

      // Optimista: cobertura completa al instante, sin POST todavía.
      expect(screen.getByText("2 / 2")).toBeInTheDocument();
      expect(getSaveCalls(fetchMock)).toHaveLength(0);
      // Cubierto el mes, la acción rápida desaparece.
      expect(
        screen.queryByRole("button", { name: "Marcar Internet como pagado" }),
      ).not.toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(7_000);
      });

      expect(getSaveCalls(fetchMock)).toHaveLength(1);

      const [, requestInit] = getSaveCalls(fetchMock)[0] as [
        string,
        RequestInit,
      ];
      const payload = JSON.parse(String(requestInit.body));

      expect(payload.items[0].paymentRecords).toEqual([
        expect.objectContaining({ coveredPayments: 2 }),
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("undoes the mark without any request", async () => {
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

      await user.click(
        screen.getByRole("button", {
          name: "Marcar Internet como pagado",
        }),
      );
      expect(screen.getByText("2 / 2")).toBeInTheDocument();

      const undoAction = getLastUndoAction();

      act(() => {
        undoAction?.();
      });

      expect(screen.getByText("0 / 2")).toBeInTheDocument();
      expect(mockedToast.success).toHaveBeenCalledWith("Pago deshecho.");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });

      expect(getSaveCalls(fetchMock)).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("restores the previous coverage when the deferred save fails", async () => {
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

      await user.click(
        screen.getByRole("button", {
          name: "Marcar Internet como pagado",
        }),
      );
      expect(screen.getByText("2 / 2")).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(7_000);
      });

      await waitFor(() => {
        expect(screen.getByText("0 / 2")).toBeInTheDocument();
      });
      expect(mockedToast.error).toHaveBeenCalledWith(
        "No pudimos registrar el pago. Restauramos el estado.",
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
