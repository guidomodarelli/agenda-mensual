import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSession } from "next-auth/react";

import type { StorageBootstrapResult } from "@/modules/storage/application/results/storage-bootstrap";
import MonthlyExpensesPage from "@/pages/monthly-expenses";

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
        bootstrap={bootstrap}
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
        loadError={null}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Registro mensual de gastos" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Mes")).toHaveValue("2026-03");
    expect(screen.getByDisplayValue("Agua")).toBeInTheDocument();
  });

  it("recalculates the row total when subtotal and occurrences change", async () => {
    const user = userEvent.setup();

    render(
      <MonthlyExpensesPage
        bootstrap={bootstrap}
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
        loadError={null}
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
        bootstrap={bootstrap}
        initialDocument={{
          items: [],
          month: "2026-03",
        }}
        loadError={null}
      />,
    );

    expect(screen.queryByText("Cuenta activa: Gus")).not.toBeInTheDocument();
    expect(screen.queryByText("Email: gus@example.com")).not.toBeInTheDocument();
  });

  it("adds and removes manual expense rows", async () => {
    const user = userEvent.setup();

    render(
      <MonthlyExpensesPage
        bootstrap={bootstrap}
        initialDocument={{
          items: [],
          month: "2026-03",
        }}
        loadError={null}
      />,
    );

    expect(screen.getAllByLabelText("Descripción")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Agregar gasto" }));

    expect(screen.getAllByLabelText("Descripción")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Eliminar gasto 2" }));

    expect(screen.getAllByLabelText("Descripción")).toHaveLength(1);
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
        bootstrap={bootstrap}
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
        loadError={null}
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
        bootstrap={bootstrap}
        initialDocument={{
          items: [],
          month: "2026-03",
        }}
        loadError={null}
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
});
