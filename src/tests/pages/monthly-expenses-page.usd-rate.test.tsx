import { vi, describe, it, expect, type Mock } from "vitest";
import { toast } from "beez-ui";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";


import MonthlyExpensesPage from "@/modules/monthly-expenses/shared/pages/monthly-expenses-page";
import { selectDropdownSubmenuItem } from "@/tests/utils/radix-menu-test-helpers";

import {
  basePageProps,
  createMockRouter,
  createMonthlyExpensesFetchMock,
  getMonthlyExpensesTable,
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
  exchangeRateLoadError: null,
  exchangeRateSnapshot: {
    blueRate: 1500,
    month: "2026-03",
    officialRate: 1000,
    solidarityRate: 1300,
  },
  items: [
    {
      currency: "USD" as const,
      description: "Netflix",
      id: "expense-1",
      occurrencesPerMonth: 1,
      subtotal: 10,
      total: 10,
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

function getTableTextNormalized(): string {
  return (getMonthlyExpensesTable()?.textContent ?? "").replace(/\s/g, " ");
}

function getSaveCalls(fetchMock: Mock) {
  return fetchMock.mock.calls.filter(
    ([url]) => url === "/api/storage/monthly-expenses",
  );
}

async function selectUsdRateFromRowMenu(
  user: ReturnType<typeof userEvent.setup>,
  optionName: string,
) {
  await user.click(
    screen.getByRole("button", { name: "Abrir acciones para Netflix" }),
  );
  await selectDropdownSubmenuItem(
    user,
    "Tipo de cambio",
    optionName,
    "menuitemradio",
  );
  await user.keyboard("{Escape}");
}

/**
 * Drains the `setTimeout(0)` the row menu uses to defer `onSelectUsdRateType`
 * when the suite runs with fake timers, without advancing the debounce window.
 */
async function flushDeferredMenuSelection() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe("MonthlyExpensesPage optimistic usd rate", () => {
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

  it("applies the conversion optimistically before the save request fires", async () => {
    authenticateSession();
    const fetchMock = createMonthlyExpensesFetchMock();
    global.fetch = fetchMock as typeof fetch;

    // Fake timers congelan el debounce: el feedback visual debe aparecer sin
    // que haya salido ningún request todavía.
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

      // Baseline: 10 USD × solidario (1300) = 13.000 ARS.
      expect(getTableTextNormalized()).toContain("13.000");

      await selectUsdRateFromRowMenu(user, "Dólar blue");
      await flushDeferredMenuSelection();

      // Feedback inmediato: 10 USD × blue (1500) × (1 + 0,09 IIBB + 0,21 IVA)
      // = 19.500, aún sin ningún POST.
      expect(getTableTextNormalized()).toContain("19.500");
      expect(getSaveCalls(fetchMock)).toHaveLength(0);

      // El flush llega después del debounce, con la última intención.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000);
      });

      expect(getSaveCalls(fetchMock)).toHaveLength(1);

      const [, requestInit] = getSaveCalls(fetchMock)[0] as [
        string,
        RequestInit,
      ];
      const payload = JSON.parse(String(requestInit.body));

      expect(payload.items[0].usdRate).toEqual({
        appliesIibb: true,
        appliesIva: true,
        base: "blue",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the latest intent authoritative while a request is in flight", async () => {
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
            // El primer guardado queda en vuelo hasta que el test lo libere.
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

    await selectUsdRateFromRowMenu(user, "Dólar blue");

    // El primer flush sale con blue y queda en vuelo.
    await waitFor(() => {
      expect(getSaveCalls(fetchMock)).toHaveLength(1);
    });

    // Con el request en vuelo, el usuario cambia de idea y vuelve al
    // default (oficial + IIBB): la UI lo refleja de inmediato (13.000).
    await selectUsdRateFromRowMenu(user, "Oficial");
    expect(getTableTextNormalized()).toContain("13.000");

    deferredFirstSave.resolve?.();

    // La respuesta vieja no pisa la intención nueva: se promueve el baseline
    // y sale un segundo flush con official.
    await waitFor(() => {
      expect(getSaveCalls(fetchMock)).toHaveLength(2);
    });

    const [, secondRequestInit] = getSaveCalls(fetchMock)[1] as [
      string,
      RequestInit,
    ];
    const secondPayload = JSON.parse(String(secondRequestInit.body));

    // El default es implícito: el segundo guardado viaja sin usdRate.
    expect(secondPayload.items[0].usdRate).toBeUndefined();
    await waitFor(() => {
      expect(getTableTextNormalized()).toContain("13.000");
    });

    // Y no queda ningún request rezagado extra.
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 700));
    expect(getSaveCalls(fetchMock)).toHaveLength(2);
  });

  it("skips the request entirely when the user returns to the baseline rate", async () => {
    authenticateSession();
    const fetchMock = createMonthlyExpensesFetchMock();
    global.fetch = fetchMock as typeof fetch;

    // Fake timers congelan el debounce para garantizar que ambos clicks caen
    // dentro de la misma ventana, sin depender del reloj real bajo carga.
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

      await selectUsdRateFromRowMenu(user, "Dólar blue");
      await flushDeferredMenuSelection();
      await selectUsdRateFromRowMenu(user, "Oficial");
      await flushDeferredMenuSelection();

      expect(getTableTextNormalized()).toContain("13.000");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000);
      });

      expect(getSaveCalls(fetchMock)).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rolls back to the baseline rate when the save fails", async () => {
    authenticateSession();
    const fetchMock = createMonthlyExpensesFetchMock({
      saveError: "boom",
    });
    global.fetch = fetchMock as typeof fetch;
    const user = userEvent.setup();

    renderWithProviders(
      <MonthlyExpensesPage {...basePageProps} initialDocument={INITIAL_DOCUMENT} />,
    );

    await selectUsdRateFromRowMenu(user, "Dólar blue");

    expect(getTableTextNormalized()).toContain("19.500");

    await waitFor(() => {
      expect(getSaveCalls(fetchMock)).toHaveLength(1);
    });

    // Rollback al baseline capturado (solidario) + feedback de error.
    await waitFor(() => {
      expect(getTableTextNormalized()).toContain("13.000");
    });
    expect(getTableTextNormalized()).not.toContain("19.500");
    await waitFor(() => {
      expect(mockedToast.error).toHaveBeenCalledWith(
        "No pudimos guardar el tipo de cambio.",
      );
    });
  });
});
