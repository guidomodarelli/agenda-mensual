import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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
  }),
  createRow({
    description: "Luz",
    expenseFolderId: "folder-services",
    id: "expense-2",
  }),
  createRow({
    description: "Alquiler",
    expenseFolderId: "folder-home",
    id: "expense-3",
  }),
  createRow({
    description: "Internet",
    expenseFolderId: "folder-services",
    id: "expense-4",
  }),
];

async function selectGroupByMode(
  user: ReturnType<typeof userEvent.setup>,
  modeLabel: string | RegExp,
) {
  await user.click(screen.getByRole("button", { name: /^Agrupar por/ }));
  await user.click(screen.getByRole("menuitemradio", { name: modeLabel }));
  await user.keyboard("{Escape}");
}

async function selectGroupByFolder(user: ReturnType<typeof userEvent.setup>) {
  await selectGroupByMode(user, /Carpeta/);
}

describe("MonthlyExpensesTable group by folder", () => {
  beforeEach(() => {
    // El sorting persiste en localStorage: sin limpiar, el restore asincrónico
    // de preferencias pisa el estado del test siguiente.
    window.localStorage.clear();
  });

  it("renders no group headers by default", () => {
    renderMonthlyExpensesTable(ROWS, { expenseFolders: FOLDERS });

    expect(
      screen.queryByLabelText("Grupo Hogar: 1 gasto"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Grupo Sin carpeta: 1 gasto"),
    ).not.toBeInTheDocument();
  });

  it("groups the rows under folder pill headers with their visible counts", async () => {
    const user = userEvent.setup();

    renderMonthlyExpensesTable(ROWS, { expenseFolders: FOLDERS });

    await selectGroupByFolder(user);

    expect(
      await screen.findByLabelText("Grupo Hogar: 1 gasto"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Grupo Servicios: 2 gastos"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Grupo Sin carpeta: 1 gasto"),
    ).toBeInTheDocument();
    // El botón refleja la agrupación activa.
    expect(
      screen.getByRole("button", { name: "Agrupar por: Carpeta" }),
    ).toBeInTheDocument();

    // Dentro del <table>, los nombres de carpeta solo aparecen en los pills de
    // grupo (los chips de filtro viven fuera de la tabla).
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

  it("removes the group headers when going back to ungrouped", async () => {
    const user = userEvent.setup();

    renderMonthlyExpensesTable(ROWS, { expenseFolders: FOLDERS });

    await selectGroupByFolder(user);

    expect(
      await screen.findByLabelText("Grupo Hogar: 1 gasto"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Agrupar por/ }));
    await user.click(
      screen.getByRole("menuitemradio", { name: "Sin agrupar" }),
    );
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(
        screen.queryByLabelText("Grupo Hogar: 1 gasto"),
      ).not.toBeInTheDocument();
    });
  });

  it("collapses and expands a group from its header like an accordion", async () => {
    const user = userEvent.setup();

    renderMonthlyExpensesTable(ROWS, { expenseFolders: FOLDERS });

    await selectGroupByFolder(user);

    const servicesGroupHeader = await screen.findByRole("button", {
      name: "Grupo Servicios: 2 gastos",
    });

    expect(servicesGroupHeader).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Luz")).toBeInTheDocument();
    expect(screen.getByText("Internet")).toBeInTheDocument();

    await user.click(servicesGroupHeader);

    expect(servicesGroupHeader).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Luz")).not.toBeInTheDocument();
    expect(screen.queryByText("Internet")).not.toBeInTheDocument();
    // Los demás grupos no se ven afectados.
    expect(screen.getByText("Alquiler")).toBeInTheDocument();
    expect(screen.getByText("Compra suelta")).toBeInTheDocument();

    await user.click(servicesGroupHeader);

    expect(servicesGroupHeader).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Luz")).toBeInTheDocument();
    expect(screen.getByText("Internet")).toBeInTheDocument();
  });

  it("keeps the folder groups when sorting from a column header", async () => {
    const user = userEvent.setup();

    renderMonthlyExpensesTable(ROWS, { expenseFolders: FOLDERS });

    await selectGroupByFolder(user);
    await screen.findByLabelText("Grupo Hogar: 1 gasto");

    await user.click(screen.getByRole("button", { name: "Ordenar Total" }));

    // Los grupos siguen intactos y el orden aplica adentro de cada uno.
    expect(
      screen.getByLabelText("Grupo Servicios: 2 gastos"),
    ).toBeInTheDocument();
    expect(
      getTableTextOrder(["Hogar", "Servicios", "Sin carpeta"]),
    ).toEqual(["Hogar", "Servicios", "Sin carpeta"]);
    // Y el menú «Ordenar por» queda sincronizado con el header.
    expect(
      screen.getByRole("button", { name: "Ordenar por: Total" }),
    ).toBeInTheDocument();
  });

  it("shows each group total with its paid/pending breakdown, also when collapsed", async () => {
    const user = userEvent.setup();

    renderMonthlyExpensesTable(
      [
        createRow({
          description: "Luz",
          expenseFolderId: "folder-services",
          id: "expense-1",
          manualCoveredPayments: "1",
          subtotal: "300",
          total: "300",
        }),
        createRow({
          description: "Internet",
          expenseFolderId: "folder-services",
          id: "expense-2",
          manualCoveredPayments: "0",
          subtotal: "200",
          total: "200",
        }),
      ],
      { expenseFolders: FOLDERS },
    );

    await selectGroupByFolder(user);

    const servicesGroupHeader = await screen.findByRole("button", {
      name: "Grupo Servicios: 2 gastos",
    });
    const normalizeSpaces = (text: string) => text.replace(/\s/g, " ");

    expect(normalizeSpaces(servicesGroupHeader.textContent ?? "")).toContain(
      "500,00",
    );
    expect(normalizeSpaces(servicesGroupHeader.textContent ?? "")).toContain(
      "Pagado: $ 300,00",
    );
    expect(normalizeSpaces(servicesGroupHeader.textContent ?? "")).toContain(
      "Pendiente: $ 200,00",
    );

    // Colapsado, el total sigue visible.
    await user.click(servicesGroupHeader);
    expect(servicesGroupHeader).toHaveAttribute("aria-expanded", "false");
    expect(normalizeSpaces(servicesGroupHeader.textContent ?? "")).toContain(
      "500,00",
    );
  });

  it("restores the grouping mode and collapsed groups from persisted preferences", async () => {
    const user = userEvent.setup();

    const { unmount } = renderMonthlyExpensesTable(ROWS, {
      expenseFolders: FOLDERS,
    });

    await selectGroupByFolder(user);

    const servicesGroupHeader = await screen.findByRole("button", {
      name: "Grupo Servicios: 2 gastos",
    });

    await user.click(servicesGroupHeader);
    expect(servicesGroupHeader).toHaveAttribute("aria-expanded", "false");

    unmount();
    renderMonthlyExpensesTable(ROWS, { expenseFolders: FOLDERS });

    // El agrupado vuelve activo y Servicios sigue colapsado.
    const restoredServicesGroupHeader = await screen.findByRole("button", {
      name: "Grupo Servicios: 2 gastos",
    });

    expect(restoredServicesGroupHeader).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByText("Luz")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Agrupar por: Carpeta" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Alquiler")).toBeInTheDocument();
  });

  it("groups the rows by counterpart with unassigned rows at the end", async () => {
    const user = userEvent.setup();

    renderMonthlyExpensesTable(
      [
        createRow({ description: "Sin deuda", id: "expense-1" }),
        createRow({
          description: "Cuota Camila",
          id: "expense-2",
          isLoan: true,
          lenderId: "lender-camila",
          lenderName: "Camila",
        }),
        createRow({
          description: "Cuota Banco",
          id: "expense-3",
          isLoan: true,
          lenderId: "lender-banco",
          lenderName: "Banco Nación",
        }),
      ],
      {
        lenders: [
          { id: "lender-camila", name: "Camila", type: "other" },
          { id: "lender-banco", name: "Banco Nación", type: "bank" },
        ],
      },
    );

    await selectGroupByMode(user, /Contraparte/);

    expect(
      await screen.findByLabelText("Grupo Banco Nación: 1 gasto"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Grupo Camila: 1 gasto"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Grupo Sin contraparte: 1 gasto"),
    ).toBeInTheDocument();
    // Alfabético por nombre; sin contraparte al final.
    expect(
      getTableTextOrder([
        "Banco Nación",
        "Camila",
        "Sin contraparte",
      ]),
    ).toEqual(["Banco Nación", "Camila", "Sin contraparte"]);
    expect(
      screen.getByRole("button", { name: "Agrupar por: Contraparte" }),
    ).toBeInTheDocument();
  });

  it("groups the rows by currency with ARS before USD", async () => {
    const user = userEvent.setup();

    renderMonthlyExpensesTable([
      createRow({ currency: "USD", description: "Suscripción", id: "expense-1" }),
      createRow({ currency: "ARS", description: "Alquiler", id: "expense-2" }),
    ]);

    await selectGroupByMode(user, /Moneda/);

    expect(
      await screen.findByLabelText("Grupo ARS: 1 gasto"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Grupo USD: 1 gasto")).toBeInTheDocument();
    expect(getTableTextOrder(["Alquiler", "Suscripción"])).toEqual([
      "Alquiler",
      "Suscripción",
    ]);
  });

  it("groups the rows by payment status with pending before paid", async () => {
    const user = userEvent.setup();

    renderMonthlyExpensesTable([
      createRow({
        description: "Pagada",
        id: "expense-1",
        manualCoveredPayments: "1",
        occurrencesPerMonth: "1",
      }),
      createRow({
        description: "Pendiente todavía",
        id: "expense-2",
        manualCoveredPayments: "0",
        occurrencesPerMonth: "1",
      }),
    ]);

    await selectGroupByMode(user, /Estado de pago/);

    expect(
      await screen.findByLabelText("Grupo Pendiente: 1 gasto"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Grupo Pagado: 1 gasto")).toBeInTheDocument();
    expect(
      getTableTextOrder(["Pendiente todavía", "Pagada"]),
    ).toEqual(["Pendiente todavía", "Pagada"]);
  });

  it("groups the rows by loan direction with Yo debo, Me deben and Sin deuda", async () => {
    const user = userEvent.setup();

    renderMonthlyExpensesTable([
      createRow({ description: "Compra suelta", id: "expense-1" }),
      createRow({
        description: "Préstamo recibido",
        id: "expense-2",
        isLoan: true,
        lenderId: "lender-1",
        lenderName: "Camila",
        loanDirection: "payable",
      }),
      createRow({
        description: "Préstamo otorgado",
        id: "expense-3",
        isLoan: true,
        lenderId: "lender-2",
        lenderName: "Adrián",
        loanDirection: "receivable",
      }),
    ]);

    await selectGroupByMode(user, /Dirección/);

    expect(
      await screen.findByLabelText("Grupo Yo debo: 1 gasto"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Grupo Me deben: 1 gasto"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Grupo Sin deuda: 1 gasto"),
    ).toBeInTheDocument();
    expect(
      getTableTextOrder([
        "Préstamo recibido",
        "Préstamo otorgado",
        "Compra suelta",
      ]),
    ).toEqual(["Préstamo recibido", "Préstamo otorgado", "Compra suelta"]);
  });

  it("groups the rows by lender type with unassigned rows at the end", async () => {
    const user = userEvent.setup();

    renderMonthlyExpensesTable(
      [
        createRow({ description: "Sin deuda", id: "expense-1" }),
        createRow({
          description: "Cuota fintech",
          id: "expense-2",
          isLoan: true,
          lenderId: "lender-mp",
          lenderName: "Mercado Pago",
        }),
        createRow({
          description: "Cuota banco",
          id: "expense-3",
          isLoan: true,
          lenderId: "lender-banco",
          lenderName: "Banco Nación",
        }),
      ],
      {
        lenders: [
          { id: "lender-mp", name: "Mercado Pago", type: "fintech" },
          { id: "lender-banco", name: "Banco Nación", type: "bank" },
        ],
      },
    );

    await selectGroupByMode(user, /Tipo de contraparte/);

    expect(
      await screen.findByLabelText("Grupo Banco: 1 gasto"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Grupo Fintech / Billetera: 1 gasto"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Grupo Sin contraparte: 1 gasto"),
    ).toBeInTheDocument();
    // Banco antes que Fintech; sin contraparte al final.
    expect(
      getTableTextOrder(["Cuota banco", "Cuota fintech", "Sin deuda"]),
    ).toEqual(["Cuota banco", "Cuota fintech", "Sin deuda"]);
  });

  it("groups the rows by recurrence with loans as their own recurrence kind", async () => {
    const user = userEvent.setup();

    renderMonthlyExpensesTable([
      createRow({ description: "Compra puntual", id: "expense-1" }),
      createRow({
        description: "Cuota del préstamo",
        id: "expense-2",
        isLoan: true,
        lenderId: "lender-1",
        lenderName: "Banco",
        loanEndMonth: "2026-12",
      }),
      createRow({
        description: "Alquiler mensual",
        id: "expense-3",
        isRecurring: true,
        recurrenceIsActive: true,
        recurrenceStartMonth: "2026-01",
      }),
    ]);

    await selectGroupByMode(user, /Recurrencia/);

    expect(
      await screen.findByLabelText("Grupo Recurrentes: 1 gasto"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Grupo Deuda / cuotas: 1 gasto"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Grupo Puntuales: 1 gasto"),
    ).toBeInTheDocument();
    // Recurrentes → Deuda / cuotas → Puntuales.
    expect(
      getTableTextOrder([
        "Alquiler mensual",
        "Cuota del préstamo",
        "Compra puntual",
      ]),
    ).toEqual(["Alquiler mensual", "Cuota del préstamo", "Compra puntual"]);
  });

  it("groups the rows by vigencia end month in chronological order", async () => {
    const user = userEvent.setup();

    renderMonthlyExpensesTable([
      createRow({ description: "Sin plazo", id: "expense-1" }),
      createRow({
        description: "Cuota larga",
        id: "expense-2",
        isLoan: true,
        loanEndMonth: "2027-02",
      }),
      createRow({
        description: "Cuota corta",
        id: "expense-3",
        isLoan: true,
        loanEndMonth: "2026-08",
      }),
    ]);

    await selectGroupByMode(user, /Vigencia/);

    expect(
      await screen.findByLabelText("Grupo Termina 08/26: 1 gasto"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Grupo Termina 02/27: 1 gasto"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Grupo Sin vigencia: 1 gasto"),
    ).toBeInTheDocument();
    expect(
      getTableTextOrder(["Cuota corta", "Cuota larga", "Sin plazo"]),
    ).toEqual(["Cuota corta", "Cuota larga", "Sin plazo"]);
  });

  it("does not overwrite the persisted preferences with defaults during the StrictMode remount", async () => {
    const preferencesStorageKey =
      "control-mensual.monthly-expenses.table-preferences";
    window.localStorage.setItem(
      preferencesStorageKey,
      JSON.stringify({
        collapsedGroupKeys: [],
        columnVisibility: {},
        groupByMode: "folder",
        loanSortMode: "paidInstallments",
        moveCompletedToEnd: true,
        sorting: [],
        vigenciaSortMode: "startMonth",
      }),
    );

    renderMonthlyExpensesTable(
      ROWS,
      { expenseFolders: FOLDERS },
      { strictMode: true },
    );

    // El restore corre en un requestAnimationFrame posterior al montaje: hasta
    // entonces la preferencia guardada no debe pisarse con los defaults.
    const persistedPreferencesAfterMount = JSON.parse(
      window.localStorage.getItem(preferencesStorageKey) ?? "{}",
    );
    expect(persistedPreferencesAfterMount.groupByMode).toBe("folder");

    // Y al terminar el restore, el agrupado guardado vuelve activo.
    expect(
      await screen.findByLabelText("Grupo Servicios: 2 gastos"),
    ).toBeInTheDocument();
    expect(
      JSON.parse(window.localStorage.getItem(preferencesStorageKey) ?? "{}")
        .groupByMode,
    ).toBe("folder");
  });
});
