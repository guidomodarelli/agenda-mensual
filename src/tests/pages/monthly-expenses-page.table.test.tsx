import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import { toast } from "sonner";

import { TooltipProvider } from "@/components/ui/tooltip";
import type { MonthlyExpensesDocumentResult } from "@/modules/monthly-expenses/application/results/monthly-expenses-document-result";
import { copyMonthlyExpenseTemplatesToMonth } from "@/modules/monthly-expenses/shared/pages/monthly-expenses-page";
import MonthlyExpensesPage, { getRequestedMonthlyExpensesTab } from "@/modules/monthly-expenses/shared/pages/monthly-expenses-page";

import {
  basePageProps,
  createDeferredValue,
  createMockRouter,
  createMonthlyExpensesFetchMock,
  getMonthlyExpensesDescriptionsOrder,
  getMonthlyExpensesSavePayload,
  getPersistedTablePreferences,
  registerMonthlyExpensesPageDefaultHooks,
  renderWithProviders,
  SIDEBAR_STORAGE_KEY,
  TABLE_PREFERENCES_STORAGE_KEY,
} from "./monthly-expenses-page-test-helpers";

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

jest.mock("next-auth/react", () => ({
  signIn: jest.fn(),
  signOut: jest.fn(),
  useSession: jest.fn(),
}));

jest.mock("sonner", () => {
  const mockToast = Object.assign(jest.fn(), {
    error: jest.fn(),
    info: jest.fn(),
    promise: jest.fn((promise: Promise<unknown>) => promise),
    success: jest.fn(),
    warning: jest.fn(),
  });

  return {
    toast: mockToast,
  };
});

type MockedToast = jest.Mock & {
  error: jest.Mock;
  info: jest.Mock;
  promise: jest.Mock;
  success: jest.Mock;
  warning: jest.Mock;
};

const mockedUsePathname = jest.mocked(usePathname);
const mockedUseRouter = jest.mocked(useRouter);
const mockedUseSearchParams = jest.mocked(useSearchParams);
const mockedUseSession = jest.mocked(useSession);
const mockedSignIn = jest.mocked(signIn);
const mockedSignOut = jest.mocked(signOut);
const mockedToast = toast as unknown as MockedToast;
const originalFetch = global.fetch;
const ADVANCED_FILTERS_TEST_TIMEOUT_MS = 15000;

describe("MonthlyExpensesPage table and navigation", () => {

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

  it("renders the monthly expenses data table with the selected month", () => {
    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialLendersCatalog={{
          lenders: [
            {
              id: "lender-1",
              name: "Banco Ciudad",
              type: "bank",
            },
          ],
        }}
        initialDocument={{
          items: [
            {
              currency: "ARS",
              description: "Agua",
              id: "expense-1",
              occurrencesPerMonth: 1,
              subtotal: 10774.53,
              total: 10774.53,
            },
          ],
          month: "2026-03",
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Detalle del mes" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Mes")).toHaveValue("2026-03");
    expect(screen.getByText("Agua")).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Filtrar gastos" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Guardar gastos" }),
    ).not.toBeInTheDocument();
  });

  it("shows month help inside a closable popover", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [
            {
              currency: "ARS",
              description: "Agua",
              id: "expense-1",
              occurrencesPerMonth: 1,
              subtotal: 10774.53,
              total: 10774.53,
            },
          ],
          month: "2026-03",
        }}
      />,
    );

    expect(
      screen.queryByText("Cambiá el mes para guardar o consultar otra planilla mensual."),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getAllByRole("button", { name: "Información sobre el campo Mes" })[0],
    );

    expect(
      screen.getAllByText("Cambiá el mes para guardar o consultar otra planilla mensual.")
        .length,
    ).toBeGreaterThan(0);

    await user.click(
      screen.getAllByRole("button", { name: "Cerrar información de Mes" })[0],
    );

    await waitFor(() => {
      expect(
        screen.queryAllByText(
          "Cambiá el mes para guardar o consultar otra planilla mensual.",
        ).length,
      ).toBe(0);
    });
  });

  it("shows a column selector and keeps Descripcion always visible", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialLendersCatalog={{
          lenders: [
            {
              id: "lender-1",
              name: "Banco Ciudad",
              type: "bank",
            },
          ],
        }}
        initialDocument={{
          items: [
            {
              currency: "ARS",
              description: "Agua",
              id: "expense-1",
              occurrencesPerMonth: 1,
              subtotal: 100,
              total: 100,
            },
          ],
          month: "2026-03",
        }}
      />,
    );

    expect(screen.getByRole("columnheader", { name: "Descripción" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Columnas" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Columnas" }));

    expect(
      screen.queryByRole("menuitemcheckbox", { name: "Descripción" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("menuitemcheckbox", { name: /Subtotal/i }));

    expect(
      screen.getByRole("menuitemcheckbox", { name: /Subtotal/i }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(
      screen.queryByRole("columnheader", { name: "Subtotal" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Descripción" })).toBeInTheDocument();
  });

  it("shows hide icons only for hideable headers and hides columns from the header controls", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [
            {
              currency: "ARS",
              description: "Prestamo A",
              id: "expense-1",
              loan: {
                endMonth: "2026-12",
                installmentCount: 12,
                paidInstallments: 3,
                startMonth: "2026-01",
              },
              occurrencesPerMonth: 1,
              subtotal: 100,
              total: 100,
            },
            {
              currency: "ARS",
              description: "Sin deuda",
              id: "expense-2",
              occurrencesPerMonth: 1,
              subtotal: 200,
              total: 200,
            },
          ],
          month: "2026-03",
        }}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Ocultar columna Descripción" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ocultar columna Subtotal" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ocultar columna Deuda / cuotas" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ocultar columna Subtotal" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("columnheader", { name: "Subtotal" }),
      ).not.toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: "Ocultar columna Deuda / cuotas" }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("columnheader", { name: "Deuda / cuotas" }),
      ).not.toBeInTheDocument();
    });
  });

  it("filters rows with advanced modal filters for numeric range, enum status, and presence", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [
            {
              currency: "ARS",
              description: "Pendiente con link",
              id: "expense-1",
              occurrencesPerMonth: 1,
              paymentLink: "https://pagos.example.com/pending",
              receiptShareStatus: "pending",
              requiresReceiptShare: true,
              subtotal: 100,
              total: 100,
            },
            {
              currency: "ARS",
              description: "Enviado sin link",
              id: "expense-2",
              occurrencesPerMonth: 1,
              paymentLink: null,
              receiptShareStatus: "sent",
              requiresReceiptShare: true,
              subtotal: 200,
              total: 200,
            },
            {
              currency: "ARS",
              description: "Sin estado sin link",
              id: "expense-3",
              occurrencesPerMonth: 1,
              paymentLink: null,
              requiresReceiptShare: false,
              subtotal: 300,
              total: 300,
            },
          ],
          month: "2026-03",
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Filtros avanzados" }));
    await user.type(screen.getByRole("spinbutton", { name: "Subtotal Mínimo" }), "150");
    await user.click(screen.getByRole("combobox", { name: "Estado de envío" }));
    await user.click(screen.getByRole("option", { name: "Enviado" }));
    await user.click(screen.getByRole("combobox", { name: "Link" }));
    await user.click(screen.getByRole("option", { name: "Sin valor" }));
    await user.click(screen.getByRole("button", { name: "Aplicar" }));

    expect(screen.queryByText("Pendiente con link")).not.toBeInTheDocument();
    expect(screen.getByText("Enviado sin link")).toBeInTheDocument();
    expect(screen.queryByText("Sin estado sin link")).not.toBeInTheDocument();
    expect(screen.getByText("Filtros avanzados activos")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Filtros avanzados" }));
    await user.click(screen.getByRole("button", { name: "Limpiar" }));

    expect(screen.queryByText("Pendiente con link")).not.toBeInTheDocument();
    expect(screen.getByText("Enviado sin link")).toBeInTheDocument();
    expect(screen.queryByText("Sin estado sin link")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Aplicar" }));

    expect(screen.getByText("Pendiente con link")).toBeInTheDocument();
    expect(screen.getByText("Enviado sin link")).toBeInTheDocument();
    expect(screen.getByText("Sin estado sin link")).toBeInTheDocument();
  }, ADVANCED_FILTERS_TEST_TIMEOUT_MS);

  it("allows selecting and deselecting all hideable columns from the selector", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialLendersCatalog={{
          lenders: [
            {
              id: "lender-1",
              name: "Banco Ciudad",
              type: "bank",
            },
          ],
        }}
        initialDocument={{
          items: [
            {
              currency: "ARS",
              description: "Agua",
              id: "expense-1",
              occurrencesPerMonth: 1,
              subtotal: 100,
              total: 100,
            },
          ],
          month: "2026-03",
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Columnas" }));
    await user.click(screen.getByRole("menuitem", { name: "Ocultar todas" }));

    await user.keyboard("{Escape}");

    expect(screen.getByRole("columnheader", { name: "Descripción" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Subtotal" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Link" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Columnas" }));
    await user.click(screen.getByRole("menuitem", { name: "Restablecer" }));

    await user.keyboard("{Escape}");

    expect(screen.getByRole("columnheader", { name: "Subtotal" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Link" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "USD" })).not.toBeInTheDocument();
  });

  it("shows a modified indicator on the column selector button when visibility changes", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [
            {
              currency: "ARS",
              description: "Agua",
              id: "expense-1",
              occurrencesPerMonth: 1,
              subtotal: 100,
              total: 100,
            },
          ],
          month: "2026-03",
        }}
      />,
    );

    expect(
      screen.queryByText("Columnas modificadas"),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Columnas" }));
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Subtotal" }));
    expect(screen.getAllByText("Columna deseleccionada").length).toBeGreaterThan(0);
    await user.keyboard("{Escape}");

    expect(screen.getByText("Columnas modificadas")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Columnas" }));
    await user.click(screen.getByRole("menuitem", { name: "Restablecer" }));
    await user.keyboard("{Escape}");

    expect(
      screen.queryByText("Columnas modificadas"),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Columnas" }));
    expect(screen.getAllByText("Columna deseleccionada")).toHaveLength(1);
    await user.keyboard("{Escape}");
  });

  it("shows sorting status badge below the filter and allows clearing sorting from the badge", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [
            {
              currency: "ARS",
              description: "Agua",
              id: "expense-1",
              occurrencesPerMonth: 1,
              subtotal: 100,
              total: 100,
            },
            {
              currency: "ARS",
              description: "Luz",
              id: "expense-2",
              occurrencesPerMonth: 1,
              subtotal: 20,
              total: 20,
            },
            {
              currency: "ARS",
              description: "Internet",
              id: "expense-3",
              occurrencesPerMonth: 1,
              subtotal: 5,
              total: 5,
            },
          ],
          month: "2026-03",
        }}
      />,
    );

    expect(
      screen.queryByText("Columnas modificadas"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Ordenado por:/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Columnas" }));
    expect(
      screen.queryByRole("menuitem", { name: /Quitar orden/i }),
    ).not.toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Ordenar Subtotal" }));

    expect(getMonthlyExpensesDescriptionsOrder()).toEqual([
      "Internet",
      "Luz",
      "Agua",
    ]);
    expect(screen.queryByText("Columnas modificadas")).not.toBeInTheDocument();
    expect(screen.getByText("Ordenado por: Subtotal ↑")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Columnas" }));
    expect(
      screen.queryByRole("menuitem", { name: /Quitar orden/i }),
    ).not.toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Quitar orden" }));
    await user.keyboard("{Escape}");

    expect(getMonthlyExpensesDescriptionsOrder()).toEqual([
      "Agua",
      "Luz",
      "Internet",
    ]);
    expect(screen.queryByText(/Ordenado por:/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText("Columnas modificadas"),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Columnas" }));
    expect(
      screen.queryByRole("menuitem", { name: /Quitar orden/i }),
    ).not.toBeInTheDocument();
  });

  it("moves completed expenses to the end when enabled and disables the checkbox while manual sorting is active", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [
            {
              currency: "ARS",
              description: "Luz",
              id: "expense-1",
              manualCoveredPayments: 1,
              occurrencesPerMonth: 1,
              subtotal: 90,
              total: 90,
            },
            {
              currency: "ARS",
              description: "Agua",
              id: "expense-2",
              occurrencesPerMonth: 1,
              subtotal: 10,
              total: 10,
            },
            {
              currency: "ARS",
              description: "Internet",
              id: "expense-3",
              manualCoveredPayments: 1,
              occurrencesPerMonth: 1,
              subtotal: 5,
              total: 5,
            },
            {
              currency: "ARS",
              description: "Gas",
              id: "expense-4",
              occurrencesPerMonth: 1,
              subtotal: 20,
              total: 20,
            },
          ],
          month: "2026-03",
        }}
      />,
    );

    const moveCompletedToEndCheckbox = screen.getByRole("checkbox", {
      name: "Mover completados al final",
    });

    expect(moveCompletedToEndCheckbox).not.toBeChecked();
    expect(getMonthlyExpensesDescriptionsOrder()).toEqual([
      "Luz",
      "Agua",
      "Internet",
      "Gas",
    ]);

    await user.click(moveCompletedToEndCheckbox);

    expect(moveCompletedToEndCheckbox).toBeChecked();
    expect(getMonthlyExpensesDescriptionsOrder()).toEqual([
      "Agua",
      "Gas",
      "Luz",
      "Internet",
    ]);

    await user.click(screen.getByRole("button", { name: "Ordenar Subtotal" }));

    expect(moveCompletedToEndCheckbox).toBeDisabled();
    expect(
      screen.getByText("Desactivado mientras haya un orden manual."),
    ).toBeInTheDocument();
    expect(getMonthlyExpensesDescriptionsOrder()).toEqual([
      "Internet",
      "Agua",
      "Gas",
      "Luz",
    ]);
    expect(moveCompletedToEndCheckbox).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Quitar orden" }));

    expect(moveCompletedToEndCheckbox).toBeEnabled();
    expect(getMonthlyExpensesDescriptionsOrder()).toEqual([
      "Agua",
      "Gas",
      "Luz",
      "Internet",
    ]);
  });

  it("persists and restores the move-completed preference", async () => {
    const user = userEvent.setup();

    const firstRender = renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [
            {
              currency: "ARS",
              description: "Agua",
              id: "expense-1",
              occurrencesPerMonth: 1,
              subtotal: 100,
              total: 100,
            },
          ],
          month: "2026-03",
        }}
      />,
    );

    await user.click(
      screen.getByRole("checkbox", {
        name: "Mover completados al final",
      }),
    );

    await waitFor(() => {
      const persistedTablePreferences = getPersistedTablePreferences();

      expect(persistedTablePreferences?.moveCompletedToEnd).toBe(true);
    });

    firstRender.unmount();

    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [
            {
              currency: "ARS",
              description: "Agua",
              id: "expense-1",
              occurrencesPerMonth: 1,
              subtotal: 100,
              total: 100,
            },
          ],
          month: "2026-03",
        }}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("checkbox", {
          name: "Mover completados al final",
        }),
      ).toBeChecked();
    });
  });

  it("restores persisted table sorting and column visibility from localStorage", async () => {
    window.localStorage.setItem(
      TABLE_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        columnVisibility: {
          subtotal: false,
          paymentLink: false,
        },
        loanSortMode: "paidInstallments",
        sorting: [
          {
            desc: true,
            id: "subtotal",
          },
        ],
      }),
    );

    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [
            {
              currency: "ARS",
              description: "Luz",
              id: "expense-1",
              occurrencesPerMonth: 1,
              subtotal: 20,
              total: 20,
            },
            {
              currency: "ARS",
              description: "Agua",
              id: "expense-2",
              occurrencesPerMonth: 1,
              subtotal: 100,
              total: 100,
            },
            {
              currency: "ARS",
              description: "Internet",
              id: "expense-3",
              occurrencesPerMonth: 1,
              subtotal: 5,
              total: 5,
            },
          ],
          month: "2026-03",
        }}
      />,
    );

    await waitFor(() => {
      expect(getMonthlyExpensesDescriptionsOrder()).toEqual([
        "Agua",
        "Luz",
        "Internet",
      ]);
    });

    await waitFor(() => {
      expect(
        screen.queryByRole("columnheader", { name: "Subtotal" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("columnheader", { name: "Link" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("columnheader", { name: "USD" }),
      ).not.toBeInTheDocument();
    });

    expect(screen.getByRole("columnheader", { name: "Descripción" })).toBeInTheDocument();
  });

  it("persists table sorting and column visibility in localStorage", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [
            {
              currency: "ARS",
              description: "Luz",
              id: "expense-1",
              occurrencesPerMonth: 1,
              subtotal: 20,
              total: 20,
            },
            {
              currency: "ARS",
              description: "Agua",
              id: "expense-2",
              occurrencesPerMonth: 1,
              subtotal: 100,
              total: 100,
            },
          ],
          month: "2026-03",
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Ordenar Subtotal" }));
    await user.click(screen.getByRole("button", { name: "Columnas" }));
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Subtotal" }));

    await waitFor(() => {
      const persistedTablePreferences = getPersistedTablePreferences();

      expect(persistedTablePreferences).not.toBeNull();
      expect(persistedTablePreferences?.loanSortMode).toBe("paidInstallments");
      expect(persistedTablePreferences?.moveCompletedToEnd).toBe(false);
      expect(persistedTablePreferences?.sorting).toEqual([
        {
          desc: false,
          id: "subtotal",
        },
      ]);
      expect(persistedTablePreferences?.columnVisibility).toEqual(
        expect.objectContaining({
          subtotal: false,
        }),
      );
    });
  });

  it("sorts subtotal numerically in ascending and descending order", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialLendersCatalog={{
          lenders: [
            {
              id: "lender-1",
              name: "Banco Ciudad",
              type: "bank",
            },
          ],
        }}
        initialDocument={{
          items: [
            {
              currency: "ARS",
              description: "Agua",
              id: "expense-1",
              occurrencesPerMonth: 1,
              subtotal: 100,
              total: 100,
            },
            {
              currency: "ARS",
              description: "Luz",
              id: "expense-2",
              occurrencesPerMonth: 1,
              subtotal: 20,
              total: 20,
            },
            {
              currency: "ARS",
              description: "Internet",
              id: "expense-3",
              occurrencesPerMonth: 10,
              subtotal: 5,
              total: 50,
            },
          ],
          month: "2026-03",
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Ordenar Subtotal" }));

    expect(getMonthlyExpensesDescriptionsOrder()).toEqual([
      "Internet",
      "Luz",
      "Agua",
    ]);

    await user.click(screen.getByRole("button", { name: "Ordenar Subtotal" }));

    expect(getMonthlyExpensesDescriptionsOrder()).toEqual([
      "Agua",
      "Luz",
      "Internet",
    ]);
  });

  it("keeps active subtotal sorting when description relevance ties", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [
            {
              currency: "ARS",
              description: "Aaa",
              id: "expense-1",
              occurrencesPerMonth: 1,
              subtotal: 200,
              total: 200,
            },
            {
              currency: "ARS",
              description: "Aab",
              id: "expense-2",
              occurrencesPerMonth: 1,
              subtotal: 100,
              total: 100,
            },
          ],
          month: "2026-03",
        }}
      />,
    );

    await user.type(screen.getByRole("textbox", { name: "Filtrar gastos" }), "aa");
    await user.click(screen.getByRole("button", { name: "Ordenar Subtotal" }));

    expect(getMonthlyExpensesDescriptionsOrder()).toEqual(["Aab", "Aaa"]);
  });

  it("sorts total numerically in ascending and descending order", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [
            {
              currency: "ARS",
              description: "Agua",
              id: "expense-1",
              occurrencesPerMonth: 1,
              subtotal: 100,
              total: 300,
            },
            {
              currency: "ARS",
              description: "Luz",
              id: "expense-2",
              occurrencesPerMonth: 1,
              subtotal: 20,
              total: 20,
            },
            {
              currency: "ARS",
              description: "Internet",
              id: "expense-3",
              occurrencesPerMonth: 10,
              subtotal: 5,
              total: 50,
            },
          ],
          month: "2026-03",
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Ordenar Total" }));

    expect(getMonthlyExpensesDescriptionsOrder()).toEqual([
      "Luz",
      "Internet",
      "Agua",
    ]);

    await user.click(screen.getByRole("button", { name: "Ordenar Total" }));

    expect(getMonthlyExpensesDescriptionsOrder()).toEqual([
      "Agua",
      "Internet",
      "Luz",
    ]);
  });

  it("sorts total numerically in ARS using the monthly snapshot conversion", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          exchangeRateLoadError: null,
          exchangeRateSnapshot: {
            blueRate: 1290,
            month: "2026-03",
            officialRate: 1200,
            solidarityRate: 100,
          },
          items: [
            {
              currency: "USD",
              description: "Agua",
              id: "expense-1",
              occurrencesPerMonth: 1,
              subtotal: 1,
              total: 1,
            },
            {
              currency: "ARS",
              description: "Luz",
              id: "expense-2",
              occurrencesPerMonth: 1,
              subtotal: 50,
              total: 50,
            },
            {
              currency: "USD",
              description: "Internet",
              id: "expense-3",
              occurrencesPerMonth: 1,
              subtotal: 2,
              total: 2,
            },
          ],
          month: "2026-03",
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Ordenar Total" }));

    expect(getMonthlyExpensesDescriptionsOrder()).toEqual([
      "Luz",
      "Agua",
      "Internet",
    ]);

    await user.click(screen.getByRole("button", { name: "Ordenar Total" }));

    expect(getMonthlyExpensesDescriptionsOrder()).toEqual([
      "Internet",
      "Agua",
      "Luz",
    ]);
  });

  it("sorts USD numerically using the monthly snapshot conversion", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          exchangeRateLoadError: null,
          exchangeRateSnapshot: {
            blueRate: 1290,
            month: "2026-03",
            officialRate: 1200,
            solidarityRate: 100,
          },
          items: [
            {
              currency: "ARS",
              description: "Agua",
              id: "expense-1",
              occurrencesPerMonth: 1,
              subtotal: 300,
              total: 300,
            },
            {
              currency: "USD",
              description: "Luz",
              id: "expense-2",
              occurrencesPerMonth: 1,
              subtotal: 2,
              total: 2,
            },
            {
              currency: "ARS",
              description: "Internet",
              id: "expense-3",
              occurrencesPerMonth: 1,
              subtotal: 100,
              total: 100,
            },
          ],
          month: "2026-03",
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Columnas" }));
    await user.click(screen.getByRole("menuitemcheckbox", { name: /USD/i }));
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Ordenar USD" }));

    expect(getMonthlyExpensesDescriptionsOrder()).toEqual([
      "Internet",
      "Luz",
      "Agua",
    ]);

    await user.click(screen.getByRole("button", { name: "Ordenar USD" }));

    expect(getMonthlyExpensesDescriptionsOrder()).toEqual([
      "Agua",
      "Luz",
      "Internet",
    ]);
  });

  it("renders ARS total in Total footer and keeps USD footer", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          exchangeRateLoadError: null,
          exchangeRateSnapshot: {
            blueRate: 1290,
            month: "2026-03",
            officialRate: 1200,
            solidarityRate: 120,
          },
          items: [
            {
              currency: "ARS",
              description: "Agua",
              id: "expense-1",
              occurrencesPerMonth: 1,
              subtotal: 150,
              total: 150,
            },
            {
              currency: "USD",
              description: "Internet",
              id: "expense-2",
              occurrencesPerMonth: 1,
              subtotal: 2,
              total: 2,
            },
          ],
          month: "2026-03",
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Columnas" }));
    await user.click(screen.getByRole("menuitemcheckbox", { name: /USD/i }));
    await user.keyboard("{Escape}");

    expect(screen.getByText(/\$\s*390,00/)).toBeInTheDocument();
    expect(screen.getByText(/US\$\s*3,25/)).toBeInTheDocument();
  });

  it("falls back to the expenses tab for invalid query values", () => {
    expect(getRequestedMonthlyExpensesTab(undefined)).toBe("expenses");
    expect(getRequestedMonthlyExpensesTab("unknown")).toBe("expenses");
    expect(getRequestedMonthlyExpensesTab(["debts"])).toBe("debts");
  });

  it("renders the lenders tab when it arrives from the URL state", () => {
    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialActiveTab="lenders"
        initialDocument={{
          items: [],
          month: "2026-03",
        }}
      />,
    );

    expect(
      screen.getByText("Guardá prestamistas para reutilizarlos en tus deudas."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Control mensual" }),
    ).not.toBeInTheDocument();
  });

  it("renders lender notes in the lenders list", () => {
    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialActiveTab="lenders"
        initialLendersCatalog={{
          lenders: [
            {
              id: "lender-1",
              name: "Adrián Saúl Modarelli",
              notes: "Priorizar transferencia por CBU",
              type: "family",
            },
          ],
        }}
        initialDocument={{
          items: [],
          month: "2026-03",
        }}
      />,
    );

    expect(screen.getByText("Adrián Saúl Modarelli")).toBeInTheDocument();
    expect(screen.getByText("Familiar")).toBeInTheDocument();
    expect(
      screen.getByText("Priorizar transferencia por CBU"),
    ).toBeInTheDocument();
  });

  it("renders sidebar links for the section routes", () => {
    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [],
          month: "2026-03",
        }}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Cotizaciones del dólar" }),
    ).toHaveAttribute("href", "/cotizaciones");
    expect(
      screen.getByRole("link", { name: "Prestamistas" }),
    ).toHaveAttribute("href", "/prestamistas");
    expect(
      screen.getByRole("link", { name: "Reporte de deudas" }),
    ).toHaveAttribute("href", "/reportes/deudas");
  });

  it("keeps sidebar expanded by default when there is no persisted state", () => {
    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [],
          month: "2026-03",
        }}
      />,
    );

    const sidebar = document.querySelector("[data-slot='sidebar'][data-state]");

    expect(sidebar).not.toBeNull();
    expect(sidebar).toHaveAttribute("data-state", "expanded");
  });

  it("renders a visible sidebar trigger attached to the sidebar edge", () => {
    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [],
          month: "2026-03",
        }}
      />,
    );

    const sidebarTrigger = screen.getByRole("button", {
      name: "Abrir menu lateral",
    });

    expect(sidebarTrigger).toHaveAttribute("data-sidebar", "trigger");
  });

  it("restores the sidebar state from localStorage", async () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "false");

    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [],
          month: "2026-03",
        }}
      />,
    );

    await waitFor(() => {
      const sidebar = document.querySelector("[data-slot='sidebar'][data-state]");

      expect(sidebar).not.toBeNull();
      expect(sidebar).toHaveAttribute("data-state", "collapsed");
    });
  });

  it("persists sidebar state changes to localStorage when the trigger control is used", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [],
          month: "2026-03",
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Abrir menu lateral" }));

    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe("false");

    await user.click(screen.getByRole("button", { name: "Abrir menu lateral" }));

    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe("true");
  });

  it("loads the requested month client-side and updates the URL query without reloading SSR data", async () => {
    const router = createMockRouter({
      query: {
        month: "2026-03",
        tab: "expenses",
      },
    });
    const fetchMock = createMonthlyExpensesFetchMock({
      copyableMonths: {
        defaultSourceMonth: "2026-03",
        sourceMonths: ["2026-03", "2026-02"],
        targetMonth: "2026-04",
      },
      monthlyDocument: {
        items: [
          {
            currency: "ARS",
            description: "Abril",
            id: "expense-2",
            occurrencesPerMonth: 1,
            subtotal: 200,
            total: 200,
          },
        ],
        month: "2026-04",
      },
    });

    mockedUseRouter.mockReturnValue(
      router,
    );
    mockedUseSession.mockReturnValue({
      data: {
        expires: "2099-01-01T00:00:00.000Z",
        user: {
          email: "gus@example.com",
          name: "Gus",
        },
      },
      status: "authenticated",
      update: jest.fn(),
    } as ReturnType<typeof useSession>);
    global.fetch = fetchMock;

    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [
            {
              currency: "ARS",
              description: "Marzo",
              id: "expense-1",
              occurrencesPerMonth: 1,
              subtotal: 100,
              total: 100,
            },
          ],
          month: "2026-03",
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Mes"), {
      target: {
        value: "2026-04",
      },
    });

    expect(
      screen.getByRole("status", { name: "Cargando mes 2026-04" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Mes")).toBeDisabled();
    expect(screen.getByText("Marzo")).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/storage/monthly-expenses?month=2026-04&includeDriveStatuses=false",
        expect.objectContaining({
          headers: expect.any(Object),
          signal: undefined,
        }),
      );
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/storage/monthly-expenses-copyable-months?targetMonth=2026-04",
      expect.objectContaining({
        headers: expect.any(Object),
        signal: undefined,
      }),
    );
    expect(fetchMock).not.toHaveBeenCalledWith("/api/storage/monthly-expenses-report");

    await waitFor(() => {
      expect(window.location.pathname).toBe("/gastos");
      expect(window.location.search).toBe("?month=2026-04&tab=expenses");
    });
    expect(router.push).not.toHaveBeenCalled();

    expect(screen.getByLabelText("Mes")).toHaveValue("2026-04");
    expect(screen.getByText("Abril")).toBeInTheDocument();
    expect(screen.queryByText("Marzo")).not.toBeInTheDocument();
  });

  it("reloads the matching month when browser navigation changes the router query", async () => {
    const router = createMockRouter({
      query: {
        month: "2026-03",
        tab: "expenses",
      },
    });
    const initialDocument: MonthlyExpensesDocumentResult = {
      items: [
        {
          currency: "ARS",
          description: "Marzo",
          id: "expense-1",
          occurrencesPerMonth: 1,
          subtotal: 100,
          total: 100,
        },
      ],
      month: "2026-03",
    };
    const fetchMock = jest.fn().mockImplementation(async (input: RequestInfo | URL) => {
      if (
        input ===
        "/api/storage/monthly-expenses?month=2026-04&includeDriveStatuses=false"
      ) {
        return {
          json: async () => ({
            data: {
              items: [
                {
                  currency: "ARS",
                  description: "Abril",
                  id: "expense-2",
                  occurrencesPerMonth: 1,
                  subtotal: 200,
                  total: 200,
                },
              ],
              month: "2026-04",
            },
          }),
          ok: true,
        };
      }

      if (
        input ===
        "/api/storage/monthly-expenses?month=2026-03&includeDriveStatuses=false"
      ) {
        return {
          json: async () => ({
            data: {
              items: [
                {
                  currency: "ARS",
                  description: "Marzo",
                  id: "expense-1",
                  occurrencesPerMonth: 1,
                  subtotal: 100,
                  total: 100,
                },
              ],
              month: "2026-03",
            },
          }),
          ok: true,
        };
      }

      if (
        input === "/api/storage/monthly-expenses-copyable-months?targetMonth=2026-04" ||
        input === "/api/storage/monthly-expenses-copyable-months?targetMonth=2026-03"
      ) {
        const targetMonth = String(input).endsWith("2026-04") ? "2026-04" : "2026-03";

        return {
          json: async () => ({
            data: {
              defaultSourceMonth: "2026-02",
              sourceMonths: ["2026-03", "2026-02"],
              targetMonth,
            },
          }),
          ok: true,
        };
      }

      throw new Error(`Unexpected fetch input: ${String(input)}`);
    });

    mockedUseRouter.mockReturnValue(
      router,
    );
    mockedUseSession.mockReturnValue({
      data: {
        expires: "2099-01-01T00:00:00.000Z",
        user: {
          email: "gus@example.com",
          name: "Gus",
        },
      },
      status: "authenticated",
      update: jest.fn(),
    } as ReturnType<typeof useSession>);
    global.fetch = fetchMock as typeof fetch;

    const view = renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={initialDocument}
      />,
    );

    fireEvent.change(screen.getByLabelText("Mes"), {
      target: {
        value: "2026-04",
      },
    });

    await waitFor(() => {
      expect(screen.getByText("Abril")).toBeInTheDocument();
    });

    router.query = {
      month: "2026-03",
      tab: "expenses",
    };

    view.rerender(
      <TooltipProvider>
        <MonthlyExpensesPage
          {...basePageProps}
          initialDocument={initialDocument}
        />
      </TooltipProvider>,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/storage/monthly-expenses?month=2026-03&includeDriveStatuses=false",
        expect.objectContaining({
          headers: expect.any(Object),
          signal: undefined,
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Mes")).toHaveValue("2026-03");
      expect(screen.getByText("Marzo")).toBeInTheDocument();
    });

    expect(screen.queryByText("Abril")).not.toBeInTheDocument();
  });

  it("pushes the new month before waiting for copyable months to finish loading", async () => {
    const router = createMockRouter({
      query: {
        month: "2026-03",
        tab: "expenses",
      },
    });
    const aprilCopyableMonthsResponse = createDeferredValue<{
      json: () => Promise<{
        data: {
          defaultSourceMonth: string;
          sourceMonths: string[];
          targetMonth: string;
        };
      }>;
      ok: boolean;
    }>();
    const fetchMock = jest.fn().mockImplementation((input: RequestInfo | URL) => {
      if (
        input ===
        "/api/storage/monthly-expenses?month=2026-04&includeDriveStatuses=false"
      ) {
        return Promise.resolve({
          json: async () => ({
            data: {
              items: [
                {
                  currency: "ARS",
                  description: "Abril",
                  id: "expense-2",
                  occurrencesPerMonth: 1,
                  subtotal: 200,
                  total: 200,
                },
              ],
              month: "2026-04",
            },
          }),
          ok: true,
        });
      }

      if (input === "/api/storage/monthly-expenses-copyable-months?targetMonth=2026-04") {
        return aprilCopyableMonthsResponse.promise;
      }

      if (
        input ===
        "/api/storage/monthly-expenses?month=2026-03&includeDriveStatuses=false"
      ) {
        return Promise.resolve({
          json: async () => ({
            data: {
              items: [
                {
                  currency: "ARS",
                  description: "Marzo",
                  id: "expense-1",
                  occurrencesPerMonth: 1,
                  subtotal: 100,
                  total: 100,
                },
              ],
              month: "2026-03",
            },
          }),
          ok: true,
        });
      }

      if (input === "/api/storage/monthly-expenses-copyable-months?targetMonth=2026-03") {
        return Promise.resolve({
          json: async () => ({
            data: {
              defaultSourceMonth: "2026-02",
              sourceMonths: ["2026-02", "2026-01"],
              targetMonth: "2026-03",
            },
          }),
          ok: true,
        });
      }

      throw new Error(`Unexpected fetch input: ${String(input)}`);
    });

    mockedUseRouter.mockReturnValue(
      router,
    );
    mockedUseSession.mockReturnValue({
      data: {
        expires: "2099-01-01T00:00:00.000Z",
        user: {
          email: "gus@example.com",
          name: "Gus",
        },
      },
      status: "authenticated",
      update: jest.fn(),
    } as ReturnType<typeof useSession>);
    global.fetch = fetchMock as typeof fetch;

    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [
            {
              currency: "ARS",
              description: "Marzo",
              id: "expense-1",
              occurrencesPerMonth: 1,
              subtotal: 100,
              total: 100,
            },
          ],
          month: "2026-03",
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Mes"), {
      target: {
        value: "2026-04",
      },
    });

    await waitFor(() => {
      expect(window.location.pathname).toBe("/gastos");
      expect(window.location.search).toBe("?month=2026-04&tab=expenses");
    });
    expect(router.push).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByLabelText("Mes")).toHaveValue("2026-04");
      expect(screen.getByText("Abril")).toBeInTheDocument();
    });

    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/storage/monthly-expenses?month=2026-03&includeDriveStatuses=false",
      expect.anything(),
    );

    await act(async () => {
      aprilCopyableMonthsResponse.resolve({
        json: async () => ({
          data: {
            defaultSourceMonth: "2026-03",
            sourceMonths: ["2026-03", "2026-02"],
            targetMonth: "2026-04",
          },
        }),
        ok: true,
      });
      await Promise.resolve();
    });
  });

  it("keeps month navigation working when refreshing copyable months fails", async () => {
    const router = createMockRouter({
      query: {
        month: "2026-03",
        tab: "expenses",
      },
    });
    const fetchMock = jest.fn().mockImplementation(async (input: RequestInfo | URL) => {
      if (
        input ===
        "/api/storage/monthly-expenses?month=2026-04&includeDriveStatuses=false"
      ) {
        return {
          json: async () => ({
            data: {
              items: [],
              month: "2026-04",
            },
          }),
          ok: true,
        };
      }

      if (input === "/api/storage/monthly-expenses-copyable-months?targetMonth=2026-04") {
        return {
          json: async () => ({
            error: "copyable months failed",
          }),
          ok: false,
          status: 500,
        };
      }

      throw new Error(`Unexpected fetch input: ${String(input)}`);
    });

    mockedUseRouter.mockReturnValue(
      router,
    );
    mockedUseSession.mockReturnValue({
      data: {
        expires: "2099-01-01T00:00:00.000Z",
        user: {
          email: "gus@example.com",
          name: "Gus",
        },
      },
      status: "authenticated",
      update: jest.fn(),
    } as ReturnType<typeof useSession>);
    global.fetch = fetchMock as typeof fetch;

    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [
            {
              currency: "ARS",
              description: "Marzo",
              id: "expense-1",
              occurrencesPerMonth: 1,
              subtotal: 100,
              total: 100,
            },
          ],
          month: "2026-03",
        }}
        initialCopyableMonths={{
          defaultSourceMonth: "2026-02",
          sourceMonths: ["2026-02", "2026-01"],
          targetMonth: "2026-03",
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Mes"), {
      target: {
        value: "2026-04",
      },
    });

    await waitFor(() => {
      expect(window.location.pathname).toBe("/gastos");
      expect(window.location.search).toBe("?month=2026-04&tab=expenses");
    });
    expect(router.push).not.toHaveBeenCalled();

    expect(screen.getByLabelText("Mes")).toHaveValue("2026-04");
    expect(screen.getByRole("button", { name: "Replicar gastos/deudas del mes anterior" })).toBeDisabled();
    expect(screen.queryByText("2026-02")).not.toBeInTheDocument();
    expect(mockedToast.error).not.toHaveBeenCalled();
  });

  it("ignores stale client-side month loads that finish after newer navigation", async () => {
    const router = createMockRouter({
      query: {
        month: "2026-02",
        tab: "expenses",
      },
    });
    const aprilDocumentResponse = createDeferredValue<{
      json: () => Promise<{ data: { items: Array<Record<string, unknown>>; month: string } }>;
      ok: boolean;
    }>();
    const aprilCopyableMonthsResponse = createDeferredValue<{
      json: () => Promise<{
        data: {
          defaultSourceMonth: string;
          sourceMonths: string[];
          targetMonth: string;
        };
      }>;
      ok: boolean;
    }>();
    const fetchMock = jest.fn().mockImplementation((input: RequestInfo | URL) => {
      if (
        input ===
        "/api/storage/monthly-expenses?month=2026-04&includeDriveStatuses=false"
      ) {
        return aprilDocumentResponse.promise;
      }

      if (input === "/api/storage/monthly-expenses-copyable-months?targetMonth=2026-04") {
        return aprilCopyableMonthsResponse.promise;
      }

      if (
        input ===
        "/api/storage/monthly-expenses?month=2026-03&includeDriveStatuses=false"
      ) {
        return Promise.resolve({
          json: async () => ({
            data: {
              items: [
                {
                  currency: "ARS",
                  description: "Marzo",
                  id: "expense-3",
                  occurrencesPerMonth: 1,
                  subtotal: 300,
                  total: 300,
                },
              ],
              month: "2026-03",
            },
          }),
          ok: true,
        });
      }

      if (input === "/api/storage/monthly-expenses-copyable-months?targetMonth=2026-03") {
        return Promise.resolve({
          json: async () => ({
            data: {
              defaultSourceMonth: "2026-02",
              sourceMonths: ["2026-02", "2026-01"],
              targetMonth: "2026-03",
            },
          }),
          ok: true,
        });
      }

      throw new Error(`Unexpected fetch input: ${String(input)}`);
    });

    mockedUseRouter.mockReturnValue(
      router,
    );
    mockedUseSession.mockReturnValue({
      data: {
        expires: "2099-01-01T00:00:00.000Z",
        user: {
          email: "gus@example.com",
          name: "Gus",
        },
      },
      status: "authenticated",
      update: jest.fn(),
    } as ReturnType<typeof useSession>);
    global.fetch = fetchMock as typeof fetch;

    const initialDocument: MonthlyExpensesDocumentResult = {
      items: [
        {
          currency: "ARS",
          description: "Febrero",
          id: "expense-1",
          occurrencesPerMonth: 1,
          subtotal: 100,
          total: 100,
        },
      ],
      month: "2026-02",
    };

    const view = renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={initialDocument}
        initialCopyableMonths={{
          defaultSourceMonth: "2026-01",
          sourceMonths: ["2026-01"],
          targetMonth: "2026-02",
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Mes"), {
      target: {
        value: "2026-04",
      },
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/storage/monthly-expenses?month=2026-04&includeDriveStatuses=false",
        expect.objectContaining({
          headers: expect.any(Object),
          signal: undefined,
        }),
      );
    });

    router.query = {
      month: "2026-03",
      tab: "expenses",
    };

    view.rerender(
      <TooltipProvider>
        <MonthlyExpensesPage
          {...basePageProps}
          initialDocument={initialDocument}
          initialCopyableMonths={{
            defaultSourceMonth: "2026-01",
            sourceMonths: ["2026-01"],
            targetMonth: "2026-02",
          }}
        />
      </TooltipProvider>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Mes")).toHaveValue("2026-03");
      expect(screen.getByText("Marzo")).toBeInTheDocument();
    });

    await act(async () => {
      aprilDocumentResponse.resolve({
        json: async () => ({
          data: {
            items: [
              {
                currency: "ARS",
                description: "Abril",
                id: "expense-4",
                occurrencesPerMonth: 1,
                subtotal: 400,
                total: 400,
              },
            ],
            month: "2026-04",
          },
        }),
        ok: true,
      });
      aprilCopyableMonthsResponse.resolve({
        json: async () => ({
          data: {
            defaultSourceMonth: "2026-03",
            sourceMonths: ["2026-03", "2026-02"],
            targetMonth: "2026-04",
          },
        }),
        ok: true,
      });
      await Promise.resolve();
    });

    expect(screen.getByLabelText("Mes")).toHaveValue("2026-03");
    expect(screen.getByText("Marzo")).toBeInTheDocument();
    expect(screen.queryByText("Abril")).not.toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalledWith(
      "/gastos?month=2026-04&tab=expenses",
      expect.anything(),
    );
  });

  it("preserves missing receipt statuses when loading the requested month client-side", async () => {
    const user = userEvent.setup();
    const router = createMockRouter({
      query: {
        month: "2026-03",
        tab: "expenses",
      },
    });
    const fetchMock = createMonthlyExpensesFetchMock({
      copyableMonths: {
        defaultSourceMonth: "2026-03",
        sourceMonths: ["2026-03", "2026-02"],
        targetMonth: "2026-04",
      },
      monthlyDocument: {
        items: [
          {
            currency: "ARS",
            description: "Internet abril",
            id: "expense-2",
            manualCoveredPayments: 0,
            occurrencesPerMonth: 2,
            receipts: [
              {
                allReceiptsFolderId: "receipt-folder-id",
                allReceiptsFolderViewUrl:
                  "https://drive.google.com/drive/folders/receipt-folder-id",
                coveredPayments: 1,
                fileId: "receipt-file-id",
                fileName: "comprobante-abril.pdf",
                fileStatus: "missing",
                fileViewUrl:
                  "https://drive.google.com/file/d/receipt-file-id/view",
                monthlyFolderId: "receipt-month-folder-id",
                monthlyFolderViewUrl:
                  "https://drive.google.com/drive/folders/receipt-month-folder-id",
              },
            ],
            subtotal: 200,
            total: 400,
          },
        ],
        month: "2026-04",
      },
    });

    mockedUseRouter.mockReturnValue(
      router,
    );
    mockedUseSession.mockReturnValue({
      data: {
        expires: "2099-01-01T00:00:00.000Z",
        user: {
          email: "gus@example.com",
          name: "Gus",
        },
      },
      status: "authenticated",
      update: jest.fn(),
    } as ReturnType<typeof useSession>);
    global.fetch = fetchMock as typeof fetch;

    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [],
          month: "2026-03",
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Mes"), {
      target: {
        value: "2026-04",
      },
    });

    await waitFor(() => {
      expect(screen.getByText("Internet abril")).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", {
        name: /1 registro/i,
      }),
    );

    await user.click(
      screen.getByRole("button", {
        name: "Agregar nuevo registro de pago para Internet abril",
      }),
    );
    const manualPaymentsInput = screen.getByRole("spinbutton", {
      name: "¿Cuántos pagos desea cubrir?",
    });
    await user.clear(manualPaymentsInput);
    await user.type(manualPaymentsInput, "1");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => {
      const payload = getMonthlyExpensesSavePayload(fetchMock);

      expect(payload.month).toBe("2026-04");
      expect(payload.items[0]?.manualCoveredPayments).toBe(1);
    });

    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/storage/monthly-expenses-receipts?fileId=receipt-file-id",
      expect.anything(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/storage/monthly-expenses?month=2026-04&includeDriveStatuses=false",
      expect.objectContaining({
        headers: expect.any(Object),
        signal: undefined,
      }),
    );
  });

  it("shows a load-specific error message when a client-side month change fails", async () => {
    const router = createMockRouter({
      query: {
        month: "2026-03",
        tab: "expenses",
      },
    });
    const fetchMock = jest.fn().mockImplementation(async (input: RequestInfo | URL) => {
      if (input === "/api/storage/monthly-expenses-copyable-months?targetMonth=2026-04") {
        return {
          json: async () => ({
            data: {
              defaultSourceMonth: "2026-03",
              sourceMonths: ["2026-03", "2026-02"],
              targetMonth: "2026-04",
            },
          }),
          ok: true,
        };
      }

      if (
        input ===
        "/api/storage/monthly-expenses?month=2026-04&includeDriveStatuses=false"
      ) {
        return {
          json: async () => ({
            error:
              "Google authentication is required before loading monthly expenses from Drive.",
          }),
          ok: false,
          status: 401,
        };
      }

      throw new Error(`Unexpected fetch input: ${String(input)}`);
    });

    mockedUseRouter.mockReturnValue(
      router,
    );
    mockedUseSession.mockReturnValue({
      data: {
        expires: "2099-01-01T00:00:00.000Z",
        user: {
          email: "gus@example.com",
          name: "Gus",
        },
      },
      status: "authenticated",
      update: jest.fn(),
    } as ReturnType<typeof useSession>);
    global.fetch = fetchMock as typeof fetch;

    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [],
          month: "2026-03",
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Mes"), {
      target: {
        value: "2026-04",
      },
    });

    await waitFor(() => {
      expect(mockedToast.error).toHaveBeenCalledWith(
        "Conectate con Google para cargar tu control mensual.",
      );
    });
    expect(router.push).not.toHaveBeenCalled();
  });

  it("navigates to the requested month without client-side loading when the session is unauthenticated", async () => {
    const router = createMockRouter({
      query: {
        month: "2026-03",
        tab: "expenses",
      },
    });
    const fetchMock = createMonthlyExpensesFetchMock();

    mockedUseRouter.mockReturnValue(
      router,
    );
    global.fetch = fetchMock as typeof fetch;

    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [
            {
              currency: "ARS",
              description: "Marzo",
              id: "expense-1",
              occurrencesPerMonth: 1,
              subtotal: 100,
              total: 100,
            },
          ],
          month: "2026-03",
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Mes"), {
      target: {
        value: "2026-04",
      },
    });

    await waitFor(() => {
      expect(window.location.pathname).toBe("/gastos");
      expect(window.location.search).toBe("?month=2026-04&tab=expenses");
    });
    expect(router.push).not.toHaveBeenCalled();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockedToast.error).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Mes")).toHaveValue("2026-03");
    expect(screen.getByText("Marzo")).toBeInTheDocument();
  });

  it("clears the SSR load error after a successful client-side month change", async () => {
    const router = createMockRouter({
      query: {
        month: "2026-03",
        tab: "expenses",
      },
    });
    const loadErrorMessage =
      "No pudimos cargar el control mensual desde la base de datos.";
    const fetchMock = createMonthlyExpensesFetchMock({
      copyableMonths: {
        defaultSourceMonth: "2026-03",
        sourceMonths: ["2026-03", "2026-02"],
        targetMonth: "2026-04",
      },
      monthlyDocument: {
        items: [
          {
            currency: "ARS",
            description: "Abril",
            id: "expense-2",
            occurrencesPerMonth: 1,
            subtotal: 200,
            total: 200,
          },
        ],
        month: "2026-04",
      },
    });

    mockedUseRouter.mockReturnValue(
      router,
    );
    mockedUseSession.mockReturnValue({
      data: {
        expires: "2099-01-01T00:00:00.000Z",
        user: {
          email: "gus@example.com",
          name: "Gus",
        },
      },
      status: "authenticated",
      update: jest.fn(),
    } as ReturnType<typeof useSession>);
    global.fetch = fetchMock;

    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [],
          month: "2026-03",
        }}
        loadError={loadErrorMessage}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(loadErrorMessage);

    fireEvent.change(screen.getByLabelText("Mes"), {
      target: {
        value: "2026-04",
      },
    });

    await waitFor(() => {
      expect(screen.getByText("Abril")).toBeInTheDocument();
    });

    expect(screen.queryByText(loadErrorMessage)).not.toBeInTheDocument();
  });

  it("shows replication button while the month was not replicated yet, even with existing rows", () => {
    const { rerender } = renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialCopyableMonths={{
          defaultSourceMonth: "2026-02",
          sourceMonths: ["2026-02", "2026-01"],
          targetMonth: "2026-03",
        }}
        initialDocument={{
          items: [],
          month: "2026-03",
        }}
      />,
    );

    expect(screen.getByRole("button", { name: "Replicar gastos/deudas del mes anterior" })).toBeInTheDocument();

    rerender(
      <TooltipProvider>
        <MonthlyExpensesPage
          {...basePageProps}
          initialCopyableMonths={{
            defaultSourceMonth: "2026-02",
            sourceMonths: ["2026-02", "2026-01"],
            targetMonth: "2026-03",
          }}
          initialDocument={{
            items: [
              {
                currency: "ARS",
                description: "Agua",
                id: "expense-1",
                occurrencesPerMonth: 1,
                subtotal: 10000,
                total: 10000,
              },
            ],
            hasReplicatedFromPreviousMonth: false,
            month: "2026-03",
          }}
        />
      </TooltipProvider>,
    );

    expect(screen.getByRole("button", { name: "Replicar gastos/deudas del mes anterior" })).toBeInTheDocument();

    rerender(
      <TooltipProvider>
        <MonthlyExpensesPage
          {...basePageProps}
          initialCopyableMonths={{
            defaultSourceMonth: "2026-02",
            sourceMonths: ["2026-02"],
            targetMonth: "2026-03",
          }}
          initialDocument={{
            items: [
              {
                currency: "ARS",
                description: "Agua",
                id: "expense-1",
                occurrencesPerMonth: 1,
                subtotal: 10000,
                total: 10000,
              },
            ],
            hasReplicatedFromPreviousMonth: true,
            month: "2026-03",
          }}
        />
      </TooltipProvider>,
    );

    expect(
      screen.queryByRole("button", { name: "Replicar gastos/deudas del mes anterior" }),
    ).not.toBeInTheDocument();
  });

  it("adds a selection column and toggles all visible rows from the header checkbox", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [
            {
              currency: "ARS",
              description: "Agua",
              id: "expense-1",
              occurrencesPerMonth: 1,
              subtotal: 100,
              total: 100,
            },
            {
              currency: "ARS",
              description: "Internet",
              id: "expense-2",
              occurrencesPerMonth: 1,
              subtotal: 200,
              total: 200,
            },
          ],
          month: "2026-03",
        }}
      />,
    );

    const toggleAllCheckbox = screen.getByRole("checkbox", {
      name: "Seleccionar todas las filas visibles",
    });
    const aguaCheckbox = screen.getByRole("checkbox", {
      name: "Seleccionar compromiso Agua",
    });
    const internetCheckbox = screen.getByRole("checkbox", {
      name: "Seleccionar compromiso Internet",
    });

    expect(toggleAllCheckbox).not.toBeChecked();
    expect(aguaCheckbox).not.toBeChecked();
    expect(internetCheckbox).not.toBeChecked();

    await user.click(aguaCheckbox);

    expect(aguaCheckbox).toBeChecked();
    expect(internetCheckbox).not.toBeChecked();
    expect(toggleAllCheckbox).not.toBeChecked();

    await user.click(
      screen.getByRole("checkbox", { name: "Seleccionar todas las filas visibles" }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("checkbox", { name: "Seleccionar compromiso Agua" }),
      ).toBeChecked();
      expect(
        screen.getByRole("checkbox", { name: "Seleccionar compromiso Internet" }),
      ).toBeChecked();
      expect(
        screen.getByRole("checkbox", { name: "Seleccionar todas las filas visibles" }),
      ).toBeChecked();
    });

    await user.click(
      screen.getByRole("checkbox", { name: "Seleccionar todas las filas visibles" }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("checkbox", { name: "Seleccionar compromiso Agua" }),
      ).not.toBeChecked();
      expect(
        screen.getByRole("checkbox", { name: "Seleccionar compromiso Internet" }),
      ).not.toBeChecked();
      expect(
        screen.getByRole("checkbox", { name: "Seleccionar todas las filas visibles" }),
      ).not.toBeChecked();
    });
  });

  it("toggles row selection when the selection cell is clicked", async () => {
    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [
            {
              currency: "ARS",
              description: "Agua",
              id: "expense-1",
              occurrencesPerMonth: 1,
              subtotal: 100,
              total: 100,
            },
          ],
          month: "2026-03",
        }}
      />,
    );

    const aguaCheckbox = screen.getByRole("checkbox", {
      name: "Seleccionar compromiso Agua",
    });
    const aguaSelectionCell = aguaCheckbox.closest("td");

    expect(aguaSelectionCell).not.toBeNull();
    expect(aguaSelectionCell).toHaveClass("selectionTableCell");
    expect(aguaCheckbox).not.toBeChecked();

    fireEvent.click(aguaSelectionCell as HTMLElement);

    await waitFor(() => {
      expect(
        screen.getByRole("checkbox", { name: "Seleccionar compromiso Agua" }),
      ).toBeChecked();
    });

    fireEvent.click(aguaSelectionCell as HTMLElement);

    await waitFor(() => {
      expect(
        screen.getByRole("checkbox", { name: "Seleccionar compromiso Agua" }),
      ).not.toBeChecked();
    });
  });

  it("deletes only selected visible rows from bulk actions when a filter is active", async () => {
    const user = userEvent.setup();
    const fetchMock = createMonthlyExpensesFetchMock();
    global.fetch = fetchMock as typeof fetch;
    mockedUseSession.mockReturnValue({
      data: {
        user: {
          email: "user@example.com",
          image: null,
          name: "User",
        },
      },
      status: "authenticated",
      update: jest.fn(),
    } as never);

    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [
            {
              currency: "ARS",
              description: "Agua",
              id: "expense-1",
              occurrencesPerMonth: 1,
              subtotal: 100,
              total: 100,
            },
            {
              currency: "ARS",
              description: "Internet",
              id: "expense-2",
              occurrencesPerMonth: 1,
              subtotal: 200,
              total: 200,
            },
            {
              currency: "ARS",
              description: "Luz",
              id: "expense-3",
              occurrencesPerMonth: 1,
              subtotal: 300,
              total: 300,
            },
          ],
          month: "2026-03",
        }}
      />,
    );

    await user.type(
      screen.getByRole("textbox", { name: "Filtrar gastos" }),
      "Agua",
    );
    await user.click(
      screen.getByRole("checkbox", { name: "Seleccionar todas las filas visibles" }),
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Acciones masivas" })).toBeEnabled();
    });
    await user.click(screen.getByRole("button", { name: "Acciones masivas" }));
    await user.click(screen.getByRole("menuitem", { name: "Eliminar" }));

    const bulkDeleteDialog = screen.getByRole("alertdialog");
    expect(
      within(bulkDeleteDialog).getByText("Se eliminarán 1 compromiso seleccionado de la tabla visible."),
    ).toBeInTheDocument();

    await user.click(within(bulkDeleteDialog).getByRole("button", { name: "Eliminar" }));

    await waitFor(() => {
      expect(screen.queryByText("Agua")).not.toBeInTheDocument();
    });

    const payload = getMonthlyExpensesSavePayload(fetchMock);
    const savedDescriptions = payload.items.map(
      (item: { description: string }) => item.description,
    );

    expect(savedDescriptions).toEqual(["Internet", "Luz"]);
    expect(savedDescriptions).not.toContain("Agua");
  });

  it("disables bulk actions when filters leave no visible rows", async () => {
    const user = userEvent.setup();
    const fetchMock = createMonthlyExpensesFetchMock();
    global.fetch = fetchMock as typeof fetch;
    mockedUseSession.mockReturnValue({
      data: {
        user: {
          email: "user@example.com",
          image: null,
          name: "User",
        },
      },
      status: "authenticated",
      update: jest.fn(),
    } as never);

    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [
            {
              currency: "ARS",
              description: "Agua",
              id: "expense-1",
              occurrencesPerMonth: 1,
              subtotal: 100,
              total: 100,
            },
            {
              currency: "ARS",
              description: "Internet",
              id: "expense-2",
              occurrencesPerMonth: 1,
              subtotal: 200,
              total: 200,
            },
          ],
          month: "2026-03",
        }}
      />,
    );

    await user.click(
      screen.getByRole("checkbox", { name: "Seleccionar compromiso Agua" }),
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Acciones masivas" })).toBeEnabled();
    });

    await user.clear(screen.getByRole("textbox", { name: "Filtrar gastos" }));
    await user.type(
      screen.getByRole("textbox", { name: "Filtrar gastos" }),
      "No existe",
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Acciones masivas" })).toBeDisabled();
    });
  });

  it("copies rows from a selected saved month and persists them", async () => {
    const user = userEvent.setup();
    const fetchMock = createMonthlyExpensesFetchMock({
      monthlyDocument: {
        items: [
          {
            currency: "ARS",
            description: "Internet",
            id: "expense-source-1",
            occurrencesPerMonth: 1,
            subtotal: 12000,
            total: 12000,
          },
        ],
        month: "2026-02",
      },
    });

    mockedUseSession.mockReturnValue({
      data: {
        expires: "2099-01-01T00:00:00.000Z",
        user: {
          email: "gus@example.com",
          name: "Gus",
        },
      },
      status: "authenticated",
      update: jest.fn(),
    } as ReturnType<typeof useSession>);
    global.fetch = fetchMock as typeof fetch;

    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialCopyableMonths={{
          defaultSourceMonth: "2026-02",
          sourceMonths: ["2026-02", "2026-01"],
          targetMonth: "2026-03",
        }}
        initialDocument={{
          items: [],
          month: "2026-03",
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Replicar gastos/deudas del mes anterior" }));
    await user.click(
      await screen.findByRole("button", {
        name: "Confirmar replicación de gastos/deudas del mes anterior",
      }),
    );

    await waitFor(() => {
      expect(fetchMock.mock.calls[0]?.[0]).toBe(
        "/api/storage/monthly-expenses?month=2026-02",
      );
    });

    expect(screen.getByText("Internet")).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/storage/monthly-expenses",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    expect(getMonthlyExpensesSavePayload(fetchMock)).toEqual({
      hasReplicatedFromPreviousMonth: true,
      items: [
        {
          currency: "ARS",
          description: "Internet",
          id: "expense-source-1",
          occurrencesPerMonth: 1,
          paymentLink: null,
          subtotal: 12000,
        },
      ],
      month: "2026-03",
    });
    expect(
      screen.queryByRole("button", { name: "Replicar gastos/deudas del mes anterior" }),
    ).not.toBeInTheDocument();
  });

  it("handles select-all checkbox behavior for replication options", async () => {
    const user = userEvent.setup();
    const fetchMock = createMonthlyExpensesFetchMock({
      monthlyDocument: {
        items: [
          {
            currency: "ARS",
            description: "Internet",
            id: "expense-source-1",
            occurrencesPerMonth: 1,
            subtotal: 12000,
            total: 12000,
          },
          {
            currency: "ARS",
            description: "Alquiler",
            id: "expense-source-2",
            occurrencesPerMonth: 1,
            subtotal: 250000,
            total: 250000,
          },
        ],
        month: "2026-02",
      },
    });

    mockedUseSession.mockReturnValue({
      data: {
        expires: "2099-01-01T00:00:00.000Z",
        user: {
          email: "gus@example.com",
          name: "Gus",
        },
      },
      status: "authenticated",
      update: jest.fn(),
    } as ReturnType<typeof useSession>);
    global.fetch = fetchMock as typeof fetch;

    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialCopyableMonths={{
          defaultSourceMonth: "2026-02",
          sourceMonths: ["2026-02", "2026-01"],
          targetMonth: "2026-03",
        }}
        initialDocument={{
          items: [],
          month: "2026-03",
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Replicar gastos/deudas del mes anterior" }));

    const toggleAllCheckbox = await screen.findByRole("checkbox", {
      name: "Seleccionar todos",
    });
    const internetCheckbox = screen.getByRole("checkbox", {
      name: "Internet",
    });
    const rentCheckbox = screen.getByRole("checkbox", {
      name: "Alquiler",
    });
    const confirmButton = screen.getByRole("button", {
      name: "Confirmar replicación de gastos/deudas del mes anterior",
    });

    expect(toggleAllCheckbox).toBeChecked();
    expect(internetCheckbox).toBeChecked();
    expect(rentCheckbox).toBeChecked();

    await user.click(internetCheckbox);

    expect(toggleAllCheckbox).not.toBeChecked();
    expect(internetCheckbox).not.toBeChecked();
    expect(rentCheckbox).toBeChecked();

    await user.click(toggleAllCheckbox);

    expect(toggleAllCheckbox).toBeChecked();
    expect(internetCheckbox).toBeChecked();
    expect(rentCheckbox).toBeChecked();

    await user.click(toggleAllCheckbox);

    expect(toggleAllCheckbox).not.toBeChecked();
    expect(internetCheckbox).not.toBeChecked();
    expect(rentCheckbox).not.toBeChecked();
    expect(confirmButton).toBeDisabled();
  });

  it("persists only selected replication options", async () => {
    const user = userEvent.setup();
    const fetchMock = createMonthlyExpensesFetchMock({
      monthlyDocument: {
        items: [
          {
            currency: "ARS",
            description: "Internet",
            id: "expense-source-1",
            occurrencesPerMonth: 1,
            subtotal: 12000,
            total: 12000,
          },
          {
            currency: "USD",
            description: "Hosting",
            id: "expense-source-2",
            occurrencesPerMonth: 1,
            subtotal: 25,
            total: 25,
          },
        ],
        month: "2026-02",
      },
    });

    mockedUseSession.mockReturnValue({
      data: {
        expires: "2099-01-01T00:00:00.000Z",
        user: {
          email: "gus@example.com",
          name: "Gus",
        },
      },
      status: "authenticated",
      update: jest.fn(),
    } as ReturnType<typeof useSession>);
    global.fetch = fetchMock as typeof fetch;

    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialCopyableMonths={{
          defaultSourceMonth: "2026-02",
          sourceMonths: ["2026-02", "2026-01"],
          targetMonth: "2026-03",
        }}
        initialDocument={{
          items: [],
          month: "2026-03",
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Replicar gastos/deudas del mes anterior" }));
    await user.click(await screen.findByRole("checkbox", { name: "Hosting" }));
    await user.click(
      screen.getByRole("button", {
        name: "Confirmar replicación de gastos/deudas del mes anterior",
      }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/storage/monthly-expenses",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    expect(getMonthlyExpensesSavePayload(fetchMock)).toEqual({
      hasReplicatedFromPreviousMonth: true,
      items: [
        {
          currency: "ARS",
          description: "Internet",
          id: "expense-source-1",
          occurrencesPerMonth: 1,
          paymentLink: null,
          subtotal: 12000,
        },
      ],
      month: "2026-03",
    });
  });

  it("replicates only missing rows by normalized description and keeps existing rows", async () => {
    const user = userEvent.setup();
    const fetchMock = createMonthlyExpensesFetchMock({
      monthlyDocument: {
        items: [
          {
            currency: "ARS",
            description: "  INTERNET  ",
            id: "expense-source-1",
            occurrencesPerMonth: 1,
            subtotal: 12000,
            total: 12000,
          },
          {
            currency: "ARS",
            description: "Préstamo Carlos",
            id: "expense-source-2",
            occurrencesPerMonth: 1,
            subtotal: 9000,
            total: 9000,
          },
        ],
        month: "2026-02",
      },
    });

    mockedUseSession.mockReturnValue({
      data: {
        expires: "2099-01-01T00:00:00.000Z",
        user: {
          email: "gus@example.com",
          name: "Gus",
        },
      },
      status: "authenticated",
      update: jest.fn(),
    } as ReturnType<typeof useSession>);
    global.fetch = fetchMock as typeof fetch;

    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialCopyableMonths={{
          defaultSourceMonth: "2026-02",
          sourceMonths: ["2026-02"],
          targetMonth: "2026-03",
        }}
        initialDocument={{
          items: [
            {
              currency: "ARS",
              description: "internet",
              id: "expense-current-1",
              occurrencesPerMonth: 1,
              subtotal: 10000,
              total: 10000,
            },
            {
              currency: "ARS",
              description: "Prestamo Carlos",
              id: "expense-current-2",
              occurrencesPerMonth: 1,
              subtotal: 5000,
              total: 5000,
            },
          ],
          month: "2026-03",
        }}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Replicar gastos/deudas del mes anterior" }),
    );
    await waitFor(() => {
      expect(mockedToast.warning).toHaveBeenCalledWith(
        "No hay gastos/deudas faltantes para replicar desde el mes anterior.",
      );
    });
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/storage/monthly-expenses",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("replicates rows with same description when business fields differ", async () => {
    const user = userEvent.setup();
    const fetchMock = createMonthlyExpensesFetchMock({
      monthlyDocument: {
        items: [
          {
            currency: "ARS",
            description: "  INTERNET  ",
            id: "expense-source-ars",
            occurrencesPerMonth: 1,
            subtotal: 12000,
            total: 12000,
          },
          {
            currency: "USD",
            description: "Internet",
            id: "expense-source-usd",
            occurrencesPerMonth: 1,
            subtotal: 50,
            total: 50,
          },
        ],
        month: "2026-02",
      },
    });

    mockedUseSession.mockReturnValue({
      data: {
        expires: "2099-01-01T00:00:00.000Z",
        user: {
          email: "gus@example.com",
          name: "Gus",
        },
      },
      status: "authenticated",
      update: jest.fn(),
    } as ReturnType<typeof useSession>);
    global.fetch = fetchMock as typeof fetch;

    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialCopyableMonths={{
          defaultSourceMonth: "2026-02",
          sourceMonths: ["2026-02"],
          targetMonth: "2026-03",
        }}
        initialDocument={{
          items: [
            {
              currency: "ARS",
              description: "internet",
              id: "expense-current-1",
              occurrencesPerMonth: 1,
              subtotal: 10000,
              total: 10000,
            },
          ],
          month: "2026-03",
        }}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Replicar gastos/deudas del mes anterior" }),
    );
    await user.click(
      await screen.findByRole("button", {
        name: "Confirmar replicación de gastos/deudas del mes anterior",
      }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/storage/monthly-expenses",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    const payload = getMonthlyExpensesSavePayload(fetchMock);
    expect(payload.month).toBe("2026-03");
    expect(payload.hasReplicatedFromPreviousMonth).toBe(true);
    expect(payload.items).toHaveLength(2);
    expect(payload.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          currency: "ARS",
          description: "internet",
          id: "expense-current-1",
        }),
        expect.objectContaining({
          currency: "USD",
          description: "Internet",
          id: "expense-source-usd",
        }),
      ]),
    );
    expect(mockedToast.warning).not.toHaveBeenCalledWith(
      "No hay gastos/deudas faltantes para replicar desde el mes anterior.",
    );
  });

  it("shows a warning and skips persistence when all copied debts have zero remaining installments", async () => {
    const user = userEvent.setup();
    const fetchMock = createMonthlyExpensesFetchMock({
      monthlyDocument: {
        items: [
          {
            currency: "ARS",
            description: "Tarjeta finalizada",
            id: "expense-source-1",
            loan: {
              endMonth: "2026-02",
              installmentCount: 12,
              lenderId: "lender-1",
              lenderName: "Banco",
              paidInstallments: 12,
              startMonth: "2025-03",
            },
            occurrencesPerMonth: 1,
            subtotal: 12000,
            total: 12000,
          },
        ],
        month: "2026-02",
      },
    });

    mockedUseSession.mockReturnValue({
      data: {
        expires: "2099-01-01T00:00:00.000Z",
        user: {
          email: "gus@example.com",
          name: "Gus",
        },
      },
      status: "authenticated",
      update: jest.fn(),
    } as ReturnType<typeof useSession>);
    global.fetch = fetchMock as typeof fetch;

    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialCopyableMonths={{
          defaultSourceMonth: "2026-02",
          sourceMonths: ["2026-02", "2026-01"],
          targetMonth: "2026-03",
        }}
        initialDocument={{
          items: [],
          month: "2026-03",
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Replicar gastos/deudas del mes anterior" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/storage/monthly-expenses?month=2026-02",
        expect.any(Object),
      );
    });

    expect(mockedToast.warning).toHaveBeenCalledWith(
      "El mes seleccionado no tiene deudas vigentes para copiar.",
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/storage/monthly-expenses",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(
      screen.queryByText("Tarjeta finalizada"),
    ).not.toBeInTheDocument();
  });

  it("preserves shared folder metadata when copying a month without monthly folder metadata", async () => {
    const user = userEvent.setup();
    const sharedReceiptsFolderViewUrl =
      "https://drive.google.com/drive/folders/all-folder-1";
    const fetchMock = createMonthlyExpensesFetchMock({
      monthlyDocument: {
        items: [
          {
            currency: "ARS",
            description: "Internet",
            folders: {
              allReceiptsFolderId: "all-folder-1",
              allReceiptsFolderStatus: "missing",
              allReceiptsFolderViewUrl: sharedReceiptsFolderViewUrl,
              monthlyFolderId: "",
              monthlyFolderViewUrl: "",
            },
            id: "expense-source-1",
            occurrencesPerMonth: 1,
            subtotal: 12000,
            total: 12000,
          },
        ],
        month: "2026-02",
      },
    });

    mockedUseSession.mockReturnValue({
      data: {
        expires: "2099-01-01T00:00:00.000Z",
        user: {
          email: "gus@example.com",
          name: "Gus",
        },
      },
      status: "authenticated",
      update: jest.fn(),
    } as ReturnType<typeof useSession>);
    global.fetch = fetchMock as typeof fetch;

    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialCopyableMonths={{
          defaultSourceMonth: "2026-02",
          sourceMonths: ["2026-02", "2026-01"],
          targetMonth: "2026-03",
        }}
        initialDocument={{
          items: [],
          month: "2026-03",
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Replicar gastos/deudas del mes anterior" }));
    await user.click(
      await screen.findByRole("button", {
        name: "Confirmar replicación de gastos/deudas del mes anterior",
      }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/storage/monthly-expenses",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    expect(getMonthlyExpensesSavePayload(fetchMock)).toEqual({
      hasReplicatedFromPreviousMonth: true,
      items: [
        {
          currency: "ARS",
          description: "Internet",
          folders: {
            allReceiptsFolderId: "all-folder-1",
            allReceiptsFolderViewUrl: sharedReceiptsFolderViewUrl,
            monthlyFolderId: "",
            monthlyFolderViewUrl: "",
          },
          id: "expense-source-1",
          occurrencesPerMonth: 1,
          paymentLink: null,
          subtotal: 12000,
        },
      ],
      month: "2026-03",
    });
  });

  it("keeps the empty state when persisting a copied month fails", async () => {
    const user = userEvent.setup();
    const fetchMock = createMonthlyExpensesFetchMock({
      monthlyDocument: {
        items: [
          {
            currency: "ARS",
            description: "Internet",
            id: "expense-source-1",
            occurrencesPerMonth: 1,
            subtotal: 12000,
            total: 12000,
          },
        ],
        month: "2026-02",
      },
      saveError: "save failed",
    });

    mockedUseSession.mockReturnValue({
      data: {
        expires: "2099-01-01T00:00:00.000Z",
        user: {
          email: "gus@example.com",
          name: "Gus",
        },
      },
      status: "authenticated",
      update: jest.fn(),
    } as ReturnType<typeof useSession>);
    global.fetch = fetchMock as typeof fetch;

    renderWithProviders(
      <MonthlyExpensesPage
        {...basePageProps}
        initialCopyableMonths={{
          defaultSourceMonth: "2026-02",
          sourceMonths: ["2026-02", "2026-01"],
          targetMonth: "2026-03",
        }}
        initialDocument={{
          items: [],
          month: "2026-03",
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Replicar gastos/deudas del mes anterior" }));
    await user.click(
      await screen.findByRole("button", {
        name: "Confirmar replicación de gastos/deudas del mes anterior",
      }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/storage/monthly-expenses",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    expect(screen.queryByText("Internet")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replicar gastos/deudas del mes anterior" })).toBeInTheDocument();
  });

  it("copies the expense template without carrying folder references", () => {
    const sharedReceiptsFolderViewUrl =
      "https://drive.google.com/drive/folders/all-folder-1";
    const copiedRows = copyMonthlyExpenseTemplatesToMonth("2026-03", [
      {
        allReceiptsFolderId: "all-folder-1",
        allReceiptsFolderStatus: "missing",
        allReceiptsFolderViewUrl: sharedReceiptsFolderViewUrl,
        currency: "USD",
        description: "Tarjeta",
        id: "expense-source-1",
        installmentCount: "12",
        isLoan: true,
        lenderId: "lender-1",
        lenderName: "Banco",
        loanEndMonth: "2026-12",
        loanPaidInstallments: 2,
        loanProgress: "2 de 12 cuotas abonadas",
        loanRemainingInstallments: 10,
        loanTotalInstallments: 12,
        manualCoveredPayments: "2",
        monthlyFolderId: "monthly-folder-1",
        monthlyFolderStatus: "trashed",
        monthlyFolderViewUrl:
          "https://drive.google.com/drive/folders/monthly-folder-1",
        occurrencesPerMonth: "3",
        paymentLink: "https://pagos.example.com/tarjeta",
        receiptShareMessage: "Enviar comprobante",
        receiptSharePhoneDigits: "5491122334455",
        receiptShareStatus: "sent",
        requiresReceiptShare: true,
        receipts: [
          {
            allReceiptsFolderId: "all-folder-1",
            allReceiptsFolderStatus: "normal",
            allReceiptsFolderViewUrl: sharedReceiptsFolderViewUrl,
            coveredPayments: 2,
            fileId: "file-1",
            fileName: "ticket.pdf",
            fileStatus: "normal",
            fileViewUrl: "https://drive.google.com/file/d/file-1/view",
            monthlyFolderId: "monthly-folder-1",
            monthlyFolderStatus: "normal",
            monthlyFolderViewUrl:
              "https://drive.google.com/drive/folders/monthly-folder-1",
          },
        ],
        startMonth: "2026-01",
        subtotal: "10",
        total: "30.00",
      },
    ]);

    expect(copiedRows).toHaveLength(1);
    expect(copiedRows[0]).toEqual({
      allReceiptsFolderId: "all-folder-1",
      allReceiptsFolderStatus: undefined,
      allReceiptsFolderViewUrl:
        "https://drive.google.com/drive/folders/all-folder-1",
      currency: "USD",
      description: "Tarjeta",
      id: "expense-source-1",
      installmentCount: "12",
      isLoan: true,
      lenderId: "lender-1",
      lenderName: "Banco",
      loanEndMonth: "2026-12",
      loanPaidInstallments: 3,
      loanProgress: "3 de 12 cuotas abonadas",
      loanRemainingInstallments: 9,
      loanTotalInstallments: 12,
      manualCoveredPayments: "0",
      monthlyFolderId: "",
      monthlyFolderStatus: undefined,
      monthlyFolderViewUrl: "",
      occurrencesPerMonth: "3",
      paymentLink: "https://pagos.example.com/tarjeta",
      paymentRecords: [],
      receiptShareMessage: "Enviar comprobante",
      receiptSharePhoneDigits: "5491122334455",
      receiptShareStatus: "",
      requiresReceiptShare: true,
      receipts: [],
      startMonth: "2026-01",
      subtotal: "10",
      total: "30.00",
    });
    expect(copiedRows[0]?.allReceiptsFolderStatus).toBeUndefined();
    expect(copiedRows[0]?.monthlyFolderStatus).toBeUndefined();
    expect(copiedRows[0]?.receipts).toEqual([]);
    expect(copiedRows[0]?.allReceiptsFolderId).toBe("all-folder-1");
    expect(copiedRows[0]?.allReceiptsFolderViewUrl).toBe(
      "https://drive.google.com/drive/folders/all-folder-1",
    );
    expect(copiedRows[0]?.monthlyFolderId).toBe("");
    expect(copiedRows[0]?.monthlyFolderViewUrl).toBe("");
  });

  it("filters out loans with zero remaining installments when copying rows", () => {
    const copiedRows = copyMonthlyExpenseTemplatesToMonth("2026-03", [
      {
        allReceiptsFolderId: "",
        allReceiptsFolderViewUrl: "",
        currency: "ARS",
        description: "Deuda terminada",
        id: "finished-loan",
        installmentCount: "12",
        isLoan: true,
        lenderId: "lender-1",
        lenderName: "Banco",
        loanEndMonth: "2026-02",
        loanPaidInstallments: 12,
        loanProgress: "12 de 12 cuotas abonadas",
        loanRemainingInstallments: 0,
        loanTotalInstallments: 12,
        manualCoveredPayments: "0",
        monthlyFolderId: "",
        monthlyFolderViewUrl: "",
        occurrencesPerMonth: "1",
        paymentLink: "",
        receiptShareMessage: "",
        receiptSharePhoneDigits: "",
        receiptShareStatus: "",
        requiresReceiptShare: false,
        receipts: [],
        startMonth: "2025-03",
        subtotal: "1000",
        total: "1000.00",
      },
      {
        allReceiptsFolderId: "",
        allReceiptsFolderViewUrl: "",
        currency: "ARS",
        description: "Deuda activa",
        id: "active-loan",
        installmentCount: "12",
        isLoan: true,
        lenderId: "lender-1",
        lenderName: "Banco",
        loanEndMonth: "2026-12",
        loanPaidInstallments: 2,
        loanProgress: "2 de 12 cuotas abonadas",
        loanRemainingInstallments: 10,
        loanTotalInstallments: 12,
        manualCoveredPayments: "0",
        monthlyFolderId: "",
        monthlyFolderViewUrl: "",
        occurrencesPerMonth: "1",
        paymentLink: "",
        receiptShareMessage: "",
        receiptSharePhoneDigits: "",
        receiptShareStatus: "",
        requiresReceiptShare: false,
        receipts: [],
        startMonth: "2026-01",
        subtotal: "2000",
        total: "2000.00",
      },
      {
        allReceiptsFolderId: "",
        allReceiptsFolderViewUrl: "",
        currency: "USD",
        description: "Servicio",
        id: "regular-expense",
        installmentCount: "",
        isLoan: false,
        lenderId: "",
        lenderName: "",
        loanEndMonth: "",
        loanPaidInstallments: null,
        loanProgress: "",
        loanRemainingInstallments: null,
        loanTotalInstallments: null,
        manualCoveredPayments: "0",
        monthlyFolderId: "",
        monthlyFolderViewUrl: "",
        occurrencesPerMonth: "1",
        paymentLink: "",
        receiptShareMessage: "",
        receiptSharePhoneDigits: "",
        receiptShareStatus: "",
        requiresReceiptShare: false,
        receipts: [],
        startMonth: "",
        subtotal: "20",
        total: "20.00",
      },
    ]);

    expect(copiedRows).toHaveLength(2);
    expect(copiedRows.map((row) => row.description)).toEqual([
      "Deuda activa",
      "Servicio",
    ]);
  });
});
