import { vi, describe, it, expect, type Mock } from "vitest";
import { toast } from "beez-ui";
import { screen, waitFor } from "@testing-library/react";
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

async function quickAddExpense(
  user: ReturnType<typeof userEvent.setup>,
  description: string,
  amount: string,
) {
  const descriptionInput = screen.getByLabelText("Descripción del gasto nuevo");

  await user.clear(descriptionInput);
  await user.type(descriptionInput, description);

  const amountInput = screen.getByLabelText("Monto del gasto nuevo");

  await user.clear(amountInput);
  await user.type(amountInput, amount);
  await user.keyboard("{Enter}");
}

describe("MonthlyExpensesPage quick add", () => {
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

  it("adds the expense optimistically with defaults and persists it", async () => {
    authenticateSession();

    const baseFetchMock = createMonthlyExpensesFetchMock();
    const deferredSave: { resolve: (() => void) | null } = { resolve: null };
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (input === "/api/storage/monthly-expenses") {
          await new Promise<void>((resolveSave) => {
            deferredSave.resolve = resolveSave;
          });

          return { ok: true, status: 204 };
        }

        return baseFetchMock(input, init);
      },
    );

    global.fetch = fetchMock as unknown as typeof fetch;
    const user = userEvent.setup();

    renderWithProviders(
      <MonthlyExpensesPage {...basePageProps} initialDocument={INITIAL_DOCUMENT} />,
    );

    await quickAddExpense(user, "Farmacia", "2500");

    // Optimista: aparece en la tabla y los inputs quedan limpios para
    // encadenar la próxima alta.
    expect(screen.getByText("Farmacia")).toBeInTheDocument();
    expect(screen.getByLabelText("Descripción del gasto nuevo")).toHaveValue("");
    expect(screen.getByLabelText("Monto del gasto nuevo")).toHaveValue("");

    deferredSave.resolve?.();

    await waitFor(() => {
      expect(getSaveCalls(fetchMock)).toHaveLength(1);
    });

    const [, requestInit] = getSaveCalls(fetchMock)[0] as [string, RequestInit];
    const payload = JSON.parse(String(requestInit.body));
    const quickAddItem = payload.items.find(
      (item: { description: string }) => item.description === "Farmacia",
    );

    expect(quickAddItem).toMatchObject({
      currency: "ARS",
      occurrencesPerMonth: 1,
      subtotal: 2500,
    });
    expect(quickAddItem.expenseFolderId).toBeUndefined();
  });

  it("chains a second quick add while the first save is in flight", async () => {
    authenticateSession();

    const baseFetchMock = createMonthlyExpensesFetchMock();
    const deferredFirstSave: { resolve: (() => void) | null } = {
      resolve: null,
    };
    let saveCallCount = 0;
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (input === "/api/storage/monthly-expenses") {
          saveCallCount += 1;

          if (saveCallCount === 1) {
            await new Promise<void>((resolveFirstSave) => {
              deferredFirstSave.resolve = resolveFirstSave;
            });
          }

          return { ok: true, status: 204 };
        }

        return baseFetchMock(input, init);
      },
    );

    global.fetch = fetchMock as unknown as typeof fetch;
    const user = userEvent.setup();

    renderWithProviders(
      <MonthlyExpensesPage {...basePageProps} initialDocument={INITIAL_DOCUMENT} />,
    );

    await quickAddExpense(user, "Farmacia", "2500");
    await waitFor(() => {
      expect(getSaveCalls(fetchMock)).toHaveLength(1);
    });

    await quickAddExpense(user, "Kiosco", "800");
    expect(screen.getByText("Kiosco")).toBeInTheDocument();

    deferredFirstSave.resolve?.();

    // La segunda alta sale en un segundo request con ambas filas.
    await waitFor(() => {
      expect(getSaveCalls(fetchMock)).toHaveLength(2);
    });

    const [, secondRequestInit] = getSaveCalls(fetchMock)[1] as [
      string,
      RequestInit,
    ];
    const secondPayload = JSON.parse(String(secondRequestInit.body));
    const descriptions = secondPayload.items.map(
      (item: { description: string }) => item.description,
    );

    expect(descriptions).toEqual(
      expect.arrayContaining(["Internet", "Farmacia", "Kiosco"]),
    );
  });

  it("removes the optimistic row and shows an error when the save fails", async () => {
    authenticateSession();
    const fetchMock = createMonthlyExpensesFetchMock({ saveError: "boom" });
    global.fetch = fetchMock as typeof fetch;
    const user = userEvent.setup();

    renderWithProviders(
      <MonthlyExpensesPage {...basePageProps} initialDocument={INITIAL_DOCUMENT} />,
    );

    // El fallo es inmediato: el feedback optimista transitorio ya está
    // cubierto por el caso del guardado diferido.
    await quickAddExpense(user, "Farmacia", "2500");

    await waitFor(() => {
      expect(screen.queryByText("Farmacia")).not.toBeInTheDocument();
    });
    expect(mockedToast.error).toHaveBeenCalledWith(
      "No pudimos agregar el gasto.",
    );
  });

  it("creates the expense in USD when that currency is selected", async () => {
    authenticateSession();
    const fetchMock = createMonthlyExpensesFetchMock();
    global.fetch = fetchMock as typeof fetch;
    const user = userEvent.setup();

    renderWithProviders(
      <MonthlyExpensesPage {...basePageProps} initialDocument={INITIAL_DOCUMENT} />,
    );

    await user.click(
      screen.getByRole("combobox", { name: "Moneda del gasto nuevo" }),
    );
    await user.click(screen.getByRole("option", { name: "USD" }));

    await quickAddExpense(user, "Spotify", "10");

    await waitFor(() => {
      expect(getSaveCalls(fetchMock)).toHaveLength(1);
    });

    const [, requestInit] = getSaveCalls(fetchMock)[0] as [string, RequestInit];
    const payload = JSON.parse(String(requestInit.body));
    const quickAddItem = payload.items.find(
      (item: { description: string }) => item.description === "Spotify",
    );

    expect(quickAddItem).toMatchObject({ currency: "USD", subtotal: 10 });
  });

  it("validates the inputs before creating anything", async () => {
    authenticateSession();
    const fetchMock = createMonthlyExpensesFetchMock();
    global.fetch = fetchMock as typeof fetch;
    const user = userEvent.setup();

    renderWithProviders(
      <MonthlyExpensesPage {...basePageProps} initialDocument={INITIAL_DOCUMENT} />,
    );

    await user.type(
      screen.getByLabelText("Descripción del gasto nuevo"),
      "Farmacia",
    );
    await user.keyboard("{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent(/mayor a 0/);
    expect(getSaveCalls(fetchMock)).toHaveLength(0);
  });
});
