import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { selectDropdownSubmenuItem } from "@/tests/utils/radix-menu-test-helpers";

import {
  createRow,
  getTableTextOrder,
  renderMonthlyExpensesTable,
} from "./monthly-expenses-table-test-utils";

const FOLDERS = [
  { color: null, icon: null, id: "folder-home", name: "Hogar" },
  { color: null, icon: null, id: "folder-services", name: "Servicios" },
];

const ROWS = [
  createRow({
    description: "Compra suelta",
    expenseFolderId: "",
    id: "expense-1",
    total: "200",
  }),
  createRow({
    description: "Internet",
    expenseFolderId: "folder-services",
    id: "expense-2",
    total: "50",
  }),
  createRow({
    description: "Alquiler",
    expenseFolderId: "folder-home",
    id: "expense-3",
    total: "100",
  }),
  createRow({
    description: "Luz",
    expenseFolderId: "folder-services",
    id: "expense-4",
    total: "300",
  }),
];

async function selectSortBy(
  user: ReturnType<typeof userEvent.setup>,
  optionName: RegExp | string,
) {
  await user.click(screen.getByRole("button", { name: /^Ordenar por/ }));
  await user.click(screen.getByRole("menuitemradio", { name: optionName }));
  await user.keyboard("{Escape}");
}

async function selectSortDirection(
  user: ReturnType<typeof userEvent.setup>,
  directionName: string,
) {
  await user.click(screen.getByRole("button", { name: /^Ordenar por/ }));
  await user.click(
    screen.getByRole("menuitemradio", { name: directionName }),
  );
  await user.keyboard("{Escape}");
}

describe("MonthlyExpensesTable sort menu", () => {
  beforeEach(() => {
    // El sorting persiste en localStorage: sin limpiar, el restore asincrónico
    // de preferencias pisa el estado del test siguiente.
    window.localStorage.clear();
  });

  it("sorts all rows by total when no grouping is active", async () => {
    const user = userEvent.setup();

    renderMonthlyExpensesTable(ROWS, { expenseFolders: FOLDERS });

    await selectSortBy(user, /Total/);
    await selectSortDirection(user, "Descendente");

    await waitFor(() => {
      expect(
        getTableTextOrder(["Luz", "Compra suelta", "Alquiler", "Internet"]),
      ).toEqual(["Luz", "Compra suelta", "Alquiler", "Internet"]);
    });

    expect(
      screen.getByRole("button", { name: "Ordenar por: Total" }),
    ).toBeInTheDocument();
  });

  it("keeps the folder groups and sorts within each group", async () => {
    const user = userEvent.setup();

    renderMonthlyExpensesTable(ROWS, { expenseFolders: FOLDERS });

    await user.click(screen.getByRole("button", { name: /^Agrupar por/ }));
    await user.click(screen.getByRole("menuitemradio", { name: /Carpeta/ }));
    await user.keyboard("{Escape}");

    await selectSortBy(user, /Total/);
    await selectSortDirection(user, "Descendente");

    // El agrupado manda: Hogar → Servicios → Sin carpeta; adentro, total desc.
    await waitFor(() => {
      expect(
        getTableTextOrder([
          "Hogar",
          "Alquiler",
          "Servicios",
          "Luz",
          "Internet",
          "Sin carpeta",
          "Compra suelta",
        ]),
      ).toEqual([
        "Hogar",
        "Alquiler",
        "Servicios",
        "Luz",
        "Internet",
        "Sin carpeta",
        "Compra suelta",
      ]);
    });
  });

  it("sorts by description ascending", async () => {
    const user = userEvent.setup();

    renderMonthlyExpensesTable(ROWS, { expenseFolders: FOLDERS });

    await selectSortBy(user, /Descripción/);

    await waitFor(() => {
      expect(
        getTableTextOrder(["Alquiler", "Compra suelta", "Internet", "Luz"]),
      ).toEqual(["Alquiler", "Compra suelta", "Internet", "Luz"]);
    });
  });

  it("offers every sortable column as a criterion", async () => {
    const user = userEvent.setup();

    renderMonthlyExpensesTable(ROWS, { expenseFolders: FOLDERS });

    await user.click(screen.getByRole("button", { name: /^Ordenar por/ }));

    for (const optionName of [
      "Sin ordenar",
      "Descripción",
      "Total",
      "USD",
      "Pagos",
      "Contraparte",
      "Vigencia",
    ]) {
      expect(
        screen.getByRole("menuitemradio", { name: optionName }),
      ).toBeInTheDocument();
    }

    // Registros ya no es criterio de orden: quedó solo como filtro
    // (`registros:`) sobre la columna oculta.
    expect(
      screen.queryByRole("menuitemradio", { name: "Registros" }),
    ).not.toBeInTheDocument();

    // Deuda / cuotas es un submenú con sus tres criterios reales.
    await user.click(
      screen.getByRole("menuitem", { name: "Deuda / cuotas" }),
    );

    for (const loanOptionName of [
      "Cuotas pagadas",
      "Cuotas restantes",
      "Total de cuotas",
    ]) {
      expect(
        await screen.findByRole("menuitemradio", { name: loanOptionName }),
      ).toBeInTheDocument();
    }
  });

  it("sorts by remaining installments from the loan submenu", async () => {
    const user = userEvent.setup();

    renderMonthlyExpensesTable(
      [
        createRow({
          description: "Préstamo largo",
          id: "expense-1",
          isLoan: true,
          loanRemainingInstallments: 8,
        }),
        createRow({
          description: "Préstamo corto",
          id: "expense-2",
          isLoan: true,
          loanRemainingInstallments: 2,
        }),
        createRow({
          description: "Gasto común",
          id: "expense-3",
          isLoan: false,
        }),
      ],
      { expenseFolders: FOLDERS },
    );

    await user.click(screen.getByRole("button", { name: /^Ordenar por/ }));
    await selectDropdownSubmenuItem(
      user,
      "Deuda / cuotas",
      "Cuotas restantes",
      "menuitemradio",
    );
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(
        getTableTextOrder([
          "Préstamo corto",
          "Préstamo largo",
          "Gasto común",
        ]),
      ).toEqual(["Préstamo corto", "Préstamo largo", "Gasto común"]);
    });

    expect(
      screen.getByRole("button", { name: "Ordenar por: Cuotas restantes" }),
    ).toBeInTheDocument();
  });

  it("sorts by covered payments from the dropdown", async () => {
    const user = userEvent.setup();

    renderMonthlyExpensesTable(
      [
        createRow({
          description: "Sin pagos",
          id: "expense-1",
          manualCoveredPayments: "0",
          occurrencesPerMonth: "3",
        }),
        createRow({
          description: "Dos pagos",
          id: "expense-2",
          manualCoveredPayments: "2",
          occurrencesPerMonth: "3",
        }),
        createRow({
          description: "Un pago",
          id: "expense-3",
          manualCoveredPayments: "1",
          occurrencesPerMonth: "3",
        }),
      ],
      { expenseFolders: FOLDERS },
    );

    await selectSortBy(user, "Pagos");

    await waitFor(() => {
      expect(
        getTableTextOrder(["Sin pagos", "Un pago", "Dos pagos"]),
      ).toEqual(["Sin pagos", "Un pago", "Dos pagos"]);
    });

    expect(
      screen.getByRole("button", { name: "Ordenar por: Pagos" }),
    ).toBeInTheDocument();
  });

  it("cycles the header sort through ascending, descending and unsorted", async () => {
    const user = userEvent.setup();

    renderMonthlyExpensesTable(ROWS, { expenseFolders: FOLDERS });

    const insertionOrder = ["Compra suelta", "Internet", "Alquiler", "Luz"];

    expect(getTableTextOrder(insertionOrder)).toEqual(insertionOrder);

    // El header se re-monta con cada cambio de orden: el botón se re-consulta
    // en cada click para no clickear un nodo detached.
    // 1er click: ascendente.
    await user.click(screen.getByRole("button", { name: "Ordenar Total" }));
    await waitFor(() => {
      expect(
        getTableTextOrder(["Internet", "Alquiler", "Compra suelta", "Luz"]),
      ).toEqual(["Internet", "Alquiler", "Compra suelta", "Luz"]);
    });

    // 2do click: descendente.
    await user.click(screen.getByRole("button", { name: "Ordenar Total" }));
    await waitFor(() => {
      expect(
        getTableTextOrder(["Luz", "Compra suelta", "Alquiler", "Internet"]),
      ).toEqual(["Luz", "Compra suelta", "Alquiler", "Internet"]);
    });

    // 3er click: vuelve al estado sin ordenamiento (orden original).
    await user.click(screen.getByRole("button", { name: "Ordenar Total" }));
    await waitFor(() => {
      expect(getTableTextOrder(insertionOrder)).toEqual(insertionOrder);
    });
  });

  it("syncs the dropdown with a column header sort", async () => {
    const user = userEvent.setup();

    renderMonthlyExpensesTable(ROWS, { expenseFolders: FOLDERS });

    await user.click(screen.getByRole("button", { name: "Ordenar Total" }));

    expect(
      screen.getByRole("button", { name: "Ordenar por: Total" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Ordenar por: Total" }),
    );

    expect(
      screen.getByRole("menuitemradio", { name: "Total" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("menuitemradio", { name: "Ascendente" }),
    ).toHaveAttribute("aria-checked", "true");
  });
});
