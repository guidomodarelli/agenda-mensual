import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSession } from "next-auth/react";

import {
  getSafeLendersErrorMessage,
  getSafeLoansReportErrorMessage,
  getSafeMonthlyExpensesErrorMessage,
} from "@/modules/monthly-expenses/application/queries/get-monthly-expenses-page-feedback";
import type { StorageBootstrapResult } from "@/modules/storage/application/results/storage-bootstrap";
import MonthlyExpensesPage, {
  getReportProviderFilterOptions,
} from "@/pages/monthly-expenses";

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
}));

const mockedUseSession = jest.mocked(useSession);
const originalFetch = global.fetch;

const bootstrap: StorageBootstrapResult = {
  architecture: {
    dataStrategy: "ssr-first",
    middleendLocation: "src/modules",
    routing: "pages-router",
  },
  authStatus: "configured",
  requiredScopes: [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive.appdata",
  ],
  storageTargets: [
    {
      id: "applicationSettings",
      requiredScope: "https://www.googleapis.com/auth/drive.appdata",
      writesUserVisibleFiles: false,
    },
    {
      id: "userFiles",
      requiredScope: "https://www.googleapis.com/auth/drive.file",
      writesUserVisibleFiles: true,
    },
  ],
};

const basePageProps = {
  bootstrap,
  initialLendersCatalog: {
    lenders: [],
  },
  initialLoansReport: {
    entries: [],
    summary: {
      activeLoanCount: 0,
      lenderCount: 0,
      remainingAmount: 0,
      trackedLoanCount: 0,
    },
  },
  lendersLoadError: null,
  loadError: null,
  reportLoadError: null,
};

describe("MonthlyExpensesPage", () => {
  beforeEach(() => {
    mockedUseSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: jest.fn(),
    } as ReturnType<typeof useSession>);
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("renders the monthly expenses table with the selected month", () => {
    render(
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
      screen.getByRole("heading", { name: "Registro mensual de gastos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Detalle del mes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Organizá servicios, alquileres, expensas y cualquier gasto recurrente en una tabla mensual con guardado en Google Drive.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Mes")).toHaveValue("2026-03");
    expect(screen.getByDisplayValue("Agua")).toBeInTheDocument();
  });

  it("recalculates the row total when subtotal and occurrences change", async () => {
    const user = userEvent.setup();

    render(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [
            {
              currency: "ARS",
              description: "Empleada domestica",
              id: "expense-1",
              occurrencesPerMonth: 4,
              subtotal: 3000,
              total: 12000,
            },
          ],
          month: "2026-03",
        }}
      />,
    );

    await user.clear(screen.getAllByLabelText("Subtotal")[0]);
    await user.type(screen.getAllByLabelText("Subtotal")[0], "6000");
    await user.clear(screen.getAllByLabelText("Cantidad de veces por mes")[0]);
    await user.type(screen.getAllByLabelText("Cantidad de veces por mes")[0], "8");

    expect(screen.getAllByLabelText("Total")[0]).toHaveValue("48000.00");
  });

  it("does not render the authenticated session identity details", () => {
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

    render(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [],
          month: "2026-03",
        }}
      />,
    );

    expect(screen.queryByText("Cuenta activa: Gus")).not.toBeInTheDocument();
    expect(screen.queryByText("Email: gus@example.com")).not.toBeInTheDocument();
  });

  it("renders an active Google connection badge when the user is authenticated", () => {
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

    render(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [],
          month: "2026-03",
        }}
      />,
    );

    expect(screen.getByText("Google conectado - Activo")).toBeInTheDocument();
  });

  it("renders a loading Google connection badge while the session is being verified", () => {
    mockedUseSession.mockReturnValue({
      data: null,
      status: "loading",
      update: jest.fn(),
    } as ReturnType<typeof useSession>);

    render(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [],
          month: "2026-03",
        }}
      />,
    );

    expect(
      screen.getByText("Google conectado - Verificando"),
    ).toBeInTheDocument();
  });

  it("renders an inactive Google connection badge when the user is not authenticated", () => {
    mockedUseSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: jest.fn(),
    } as ReturnType<typeof useSession>);

    render(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [],
          month: "2026-03",
        }}
      />,
    );

    expect(screen.getByText("Google desconectado - Inactivo")).toBeInTheDocument();
  });

  it("adds and removes manual expense rows", async () => {
    const user = userEvent.setup();

    render(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [],
          month: "2026-03",
        }}
      />,
    );

    expect(screen.getAllByLabelText("Descripción")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Agregar gasto" }));

    expect(screen.getAllByLabelText("Descripción")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Abrir acciones del gasto 2" }));
    await user.click(screen.getByRole("menuitem", { name: "Eliminar" }));

    expect(screen.getAllByLabelText("Descripción")).toHaveLength(2);
    expect(
      screen.getByText("¿Querés eliminar este gasto?"),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Confirmar" }),
    );

    expect(screen.getAllByLabelText("Descripción")).toHaveLength(1);
  });

  it("closes the delete confirmation when clicking outside the popover", async () => {
    const user = userEvent.setup();

    render(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [],
          month: "2026-03",
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Agregar gasto" }));
    await user.click(screen.getByRole("button", { name: "Abrir acciones del gasto 2" }));
    await user.click(screen.getByRole("menuitem", { name: "Eliminar" }));

    expect(
      screen.getByText("¿Querés eliminar este gasto?"),
    ).toBeInTheDocument();

    await user.click(document.body);

    expect(
      screen.queryByText("¿Querés eliminar este gasto?"),
    ).not.toBeInTheDocument();
  });

  it("submits the current month document through the page container", async () => {
    const user = userEvent.setup();
    const fetchMock = jest.fn().mockResolvedValue({
      json: async () => ({
        data: {
          id: "monthly-expenses-file-id",
          month: "2026-03",
          name: "monthly-expenses-2026-03.json",
          viewUrl: "https://drive.google.com/file/d/monthly-expenses-file-id/view",
        },
      }),
      ok: true,
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

    render(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [
            {
              currency: "ARS",
              description: "Expensas",
              id: "expense-1",
              occurrencesPerMonth: 1,
              subtotal: 55032.07,
              total: 55032.07,
            },
          ],
          month: "2026-03",
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Guardar gastos" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/storage/monthly-expenses",
        expect.objectContaining({
          body: JSON.stringify({
            items: [
              {
                currency: "ARS",
                description: "Expensas",
                id: "expense-1",
                occurrencesPerMonth: 1,
                subtotal: 55032.07,
              },
            ],
            month: "2026-03",
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        }),
      );
    });

    expect(
      screen.getByText(
        "Gastos mensuales guardados en Drive con id monthly-expenses-file-id.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Abrir archivo mensual en Drive" }),
    ).toHaveAttribute(
      "href",
      "https://drive.google.com/file/d/monthly-expenses-file-id/view",
    );
  });

  it("shows inline validation and blocks save when a row is incomplete", async () => {
    const user = userEvent.setup();

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

    render(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [],
          month: "2026-03",
        }}
      />,
    );

    await user.type(screen.getAllByLabelText("Subtotal")[0], "1000");

    expect(
      screen.getByText(
        "Completá descripción, subtotal y cantidad de veces por mes en cada gasto antes de guardar.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Guardar gastos" }),
    ).toBeDisabled();
  });

  it("shows and hides the debt fields when the loan checkbox changes", async () => {
    const user = userEvent.setup();

    render(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [],
          month: "2026-03",
        }}
      />,
    );

    expect(screen.queryByText("Seleccioná un prestador")).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "Marcá el check si este gasto representa una deuda con una persona o entidad.",
      ),
    ).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Es deuda/préstamo"));

    expect(screen.getByText("Seleccioná un prestador")).toBeInTheDocument();
    expect(screen.getByLabelText("Inicio de la deuda")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Cantidad total de cuotas"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Fin de la deuda")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Es deuda/préstamo"));

    expect(screen.queryByText("Seleccioná un prestador")).not.toBeInTheDocument();
  });

  it("shows the debt info popover and closes it from the close button or outside click", async () => {
    const user = userEvent.setup();

    render(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [],
          month: "2026-03",
        }}
      />,
    );

    expect(
      screen.queryByText(
        "Marcá el check si este gasto representa una deuda con una persona o entidad.",
      ),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Más información sobre deuda o préstamo",
      }),
    );

    expect(
      screen.getByText(
        "Marcá el check si este gasto representa una deuda con una persona o entidad.",
      ),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Cerrar ayuda sobre deuda o préstamo",
      }),
    );

    expect(
      screen.queryByText(
        "Marcá el check si este gasto representa una deuda con una persona o entidad.",
      ),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Más información sobre deuda o préstamo",
      }),
    );

    expect(
      screen.getByText(
        "Marcá el check si este gasto representa una deuda con una persona o entidad.",
      ),
    ).toBeInTheDocument();

    await user.click(document.body);

    expect(
      screen.queryByText(
        "Marcá el check si este gasto representa una deuda con una persona o entidad.",
      ),
    ).not.toBeInTheDocument();
  });

  it("recalculates the loan progress when the selected month changes", async () => {
    const user = userEvent.setup();

    render(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [
            {
              currency: "ARS",
              description: "Prestamo tarjeta",
              id: "expense-1",
              loan: {
                endMonth: "2026-12",
                installmentCount: 12,
                lenderName: "Papa",
                paidInstallments: 3,
                startMonth: "2026-01",
              },
              occurrencesPerMonth: 1,
              subtotal: 50000,
              total: 50000,
            },
          ],
          month: "2026-03",
        }}
      />,
    );

    expect(screen.getByText("3 de 12 cuotas pagadas")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Mes"));
    await user.type(screen.getByLabelText("Mes"), "2026-02");

    expect(screen.getByText("2 de 12 cuotas pagadas")).toBeInTheDocument();
  });

  it("shows inline validation when a debt is missing start month or installments", async () => {
    const user = userEvent.setup();

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

    render(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [
            {
              currency: "ARS",
              description: "Prestamo tarjeta",
              id: "expense-1",
              occurrencesPerMonth: 1,
              subtotal: 50000,
              total: 50000,
            },
          ],
          month: "2026-03",
        }}
      />,
    );

    await user.click(screen.getByLabelText("Es deuda/préstamo"));

    expect(
      screen.getByText(
        "Completá fecha de inicio y cantidad total de cuotas en cada deuda antes de guardar.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Guardar gastos" }),
    ).toBeDisabled();
  });

  it("submits loan metadata and keeps lender optional", async () => {
    const user = userEvent.setup();
    const fetchMock = jest.fn().mockResolvedValue({
      json: async () => ({
        data: {
          id: "monthly-expenses-file-id",
          month: "2026-03",
          name: "monthly-expenses-2026-03.json",
          viewUrl: null,
        },
      }),
      ok: true,
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

    render(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [
            {
              currency: "ARS",
              description: "Prestamo tarjeta",
              id: "expense-1",
              loan: {
                endMonth: "2026-12",
                installmentCount: 12,
                paidInstallments: 3,
                startMonth: "2026-01",
              },
              occurrencesPerMonth: 1,
              subtotal: 50000,
              total: 50000,
            },
          ],
          month: "2026-03",
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Guardar gastos" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/storage/monthly-expenses",
        expect.objectContaining({
          body: JSON.stringify({
            items: [
              {
                currency: "ARS",
                description: "Prestamo tarjeta",
                id: "expense-1",
                loan: {
                  installmentCount: 12,
                  startMonth: "2026-01",
                },
                occurrencesPerMonth: 1,
                subtotal: 50000,
              },
            ],
            month: "2026-03",
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        }),
      );
    });
  });

  it("adds a lender to the catalog from the page", async () => {
    const user = userEvent.setup();
    const fetchMock = jest.fn().mockImplementation(async (input: RequestInfo | URL) => {
      if (input === "/api/storage/lenders") {
        return {
          json: async () => ({
            data: {
              id: "lenders-file-id",
              name: "lenders-catalog.json",
            },
          }),
          ok: true,
        };
      }

      return {
        json: async () => ({
          data: {
            entries: [],
            summary: {
              activeLoanCount: 0,
              lenderCount: 0,
              remainingAmount: 0,
              trackedLoanCount: 0,
            },
          },
        }),
        ok: true,
      };
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

    render(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [],
          month: "2026-03",
        }}
      />,
    );

    await user.type(screen.getByLabelText("Nombre"), "Papa");
    await user.click(screen.getByRole("button", { name: "Agregar prestador" }));

    await waitFor(() => {
      const [url, options] = fetchMock.mock.calls[0];

      expect(url).toBe("/api/storage/lenders");
      expect(options).toEqual(
        expect.objectContaining({
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        }),
      );
      expect(JSON.parse(String(options?.body))).toEqual({
        lenders: [
          {
            id: expect.any(String),
            name: "Papa",
            type: "family",
          },
        ],
      });
    });

    expect(screen.getAllByText("Papa")[0]).toBeInTheDocument();
  });

  it("requires confirmation before deleting a lender from the catalog", async () => {
    const user = userEvent.setup();
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({
          data: {
            id: "lenders-file-id",
            name: "lenders-catalog.json",
          },
        }),
        ok: true,
      })
      .mockResolvedValueOnce({
        json: async () => ({
          data: {
            entries: [],
            summary: {
              activeLoanCount: 0,
              lenderCount: 0,
              remainingAmount: 0,
              trackedLoanCount: 0,
            },
          },
        }),
        ok: true,
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

    render(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [],
          month: "2026-03",
        }}
        initialLendersCatalog={{
          lenders: [
            {
              id: "lender-1",
              name: "Papa",
              type: "family",
            },
          ],
        }}
      />,
    );

    expect(screen.getAllByText("Papa")[0]).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Abrir acciones para Papa" }));
    await user.click(screen.getByRole("menuitem", { name: "Eliminar" }));

    expect(screen.getAllByText("Papa")[0]).toBeInTheDocument();
    expect(
      screen.getByText("¿Querés eliminar a Papa del catálogo?"),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Confirmar" }),
    );

    await waitFor(() => {
      expect(screen.queryByText("¿Querés eliminar a Papa del catálogo?")).not.toBeInTheDocument();
    });
  });

  it("submits a selected lender id and lender name with the loan", async () => {
    const user = userEvent.setup();
    const fetchMock = jest.fn().mockImplementation(async (input: RequestInfo | URL) => {
      if (input === "/api/storage/monthly-expenses") {
        return {
          json: async () => ({
            data: {
              id: "monthly-expenses-file-id",
              month: "2026-03",
              name: "monthly-expenses-2026-03.json",
              viewUrl: null,
            },
          }),
          ok: true,
        };
      }

      return {
        json: async () => ({
          data: {
            entries: [],
            summary: {
              activeLoanCount: 0,
              lenderCount: 0,
              remainingAmount: 0,
              trackedLoanCount: 0,
            },
          },
        }),
        ok: true,
      };
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

    render(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [
            {
              currency: "ARS",
              description: "Prestamo tarjeta",
              id: "expense-1",
              occurrencesPerMonth: 1,
              subtotal: 50000,
              total: 50000,
            },
          ],
          month: "2026-03",
        }}
        initialLendersCatalog={{
          lenders: [
            {
              id: "lender-1",
              name: "Papa",
              type: "family",
            },
          ],
        }}
      />,
    );

    await user.click(screen.getByLabelText("Es deuda/préstamo"));
    await user.click(screen.getByRole("button", { name: "Seleccioná un prestador" }));
    await user.click(screen.getByRole("button", { name: "Papa Familiar" }));
    await user.type(screen.getByLabelText("Cantidad total de cuotas"), "12");
    await user.type(screen.getByLabelText("Inicio de la deuda"), "2026-01");
    await user.click(screen.getByRole("button", { name: "Guardar gastos" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/storage/monthly-expenses",
        expect.objectContaining({
          body: JSON.stringify({
            items: [
              {
                currency: "ARS",
                description: "Prestamo tarjeta",
                id: "expense-1",
                loan: {
                  installmentCount: 12,
                  lenderId: "lender-1",
                  lenderName: "Papa",
                  startMonth: "2026-01",
                },
                occurrencesPerMonth: 1,
                subtotal: 50000,
              },
            ],
            month: "2026-03",
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        }),
      );
    });
  });

  it("builds report lender filter options from catalog lenders and legacy report entries", () => {
    expect(
      getReportProviderFilterOptions(
        [
          {
            activeLoanCount: 1,
            expenseDescriptions: ["Tarjeta"],
            firstDebtMonth: "2026-01",
            lenderId: null,
            lenderName: "Prestador manual",
            lenderType: "other",
            latestRecordedMonth: "2026-03",
            remainingAmount: 1000,
            trackedLoanCount: 1,
          },
        ],
        [
          {
            id: "lender-1",
            name: "Papa",
            type: "family",
          },
        ],
      ),
    ).toEqual([
      {
        id: "lender-1",
        label: "Papa",
      },
      {
        id: "legacy:Prestador manual",
        label: "Prestador manual",
      },
    ]);
  });

  it("maps technical report errors to a user-friendly message", () => {
    expect(
      getSafeLoansReportErrorMessage("repository.listAll is not a function"),
    ).toBe(
      "No pudimos actualizar el reporte de deudas en este momento. Igual podés seguir cargando gastos y volver a intentarlo más tarde.",
    );
  });

  it("maps technical monthly expenses errors to a user-friendly message", () => {
    expect(
      getSafeMonthlyExpensesErrorMessage(
        "Google authentication is required before saving monthly expenses to Drive.",
      ),
    ).toBe("Conectate con Google para guardar tus gastos mensuales en Drive.");
  });

  it("maps technical lenders errors to a user-friendly message", () => {
    expect(
      getSafeLendersErrorMessage(
        "The current Google session is missing the Drive permissions required to manage lenders.",
      ),
    ).toBe(
      "Tu sesión actual no tiene permisos suficientes para gestionar prestadores en Drive.",
    );
  });

  it("shows a safe report error message without the empty-state copy", () => {
    render(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [],
          month: "2026-03",
        }}
        reportLoadError="repository.listAll is not a function"
      />,
    );

    expect(
      screen.getByText(
        "No pudimos actualizar el reporte de deudas en este momento. Igual podés seguir cargando gastos y volver a intentarlo más tarde.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("No hay deudas registradas para los filtros seleccionados."),
    ).not.toBeInTheDocument();
  });

  it("shows a safe monthly expenses error message instead of a technical one", async () => {
    const user = userEvent.setup();
    const fetchMock = jest.fn().mockResolvedValue({
      json: async () => ({
        error:
          "Google authentication is required before saving monthly expenses to Drive.",
      }),
      ok: false,
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

    render(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [
            {
              currency: "ARS",
              description: "Expensas",
              id: "expense-1",
              occurrencesPerMonth: 1,
              subtotal: 55032.07,
              total: 55032.07,
            },
          ],
          month: "2026-03",
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Guardar gastos" }));

    expect(
      await screen.findByText(
        "Conectate con Google para guardar tus gastos mensuales en Drive.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Google authentication is required before saving monthly expenses to Drive.",
      ),
    ).not.toBeInTheDocument();
  });

  it("shows a safe lenders error message instead of a technical one", async () => {
    const user = userEvent.setup();
    const fetchMock = jest.fn().mockResolvedValue({
      json: async () => ({
        error:
          "The current Google session is missing the Drive permissions required to manage lenders.",
      }),
      ok: false,
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

    render(
      <MonthlyExpensesPage
        {...basePageProps}
        initialDocument={{
          items: [],
          month: "2026-03",
        }}
      />,
    );

    await user.type(screen.getByLabelText("Nombre"), "Papa");
    await user.click(screen.getByRole("button", { name: "Agregar prestador" }));

    expect(
      await screen.findByText(
        "Tu sesión actual no tiene permisos suficientes para gestionar prestadores en Drive.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "The current Google session is missing the Drive permissions required to manage lenders.",
      ),
    ).not.toBeInTheDocument();
  });
});
