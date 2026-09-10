import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  createRow,
  renderMonthlyExpensesTable,
} from "./monthly-expenses-table-test-utils";

async function typeQuery(
  user: ReturnType<typeof userEvent.setup>,
  query: string,
) {
  const queryBar = screen.getByRole("combobox", {
    name: "Filtro unificado de gastos",
  });

  await user.click(queryBar);
  await user.type(queryBar, query);
}

describe("MonthlyExpensesTable unified bar qualifiers", () => {
  it("filters by payment status with estado:", async () => {
    const user = userEvent.setup();

    renderMonthlyExpensesTable([
      createRow({
        description: "Luz al día",
        id: "expense-1",
        manualCoveredPayments: "1",
      }),
      createRow({
        description: "Internet adeudado",
        id: "expense-2",
        manualCoveredPayments: "0",
      }),
    ]);

    await typeQuery(user, "estado:pendiente");

    await waitFor(() => {
      expect(screen.queryByText("Luz al día")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Internet adeudado")).toBeInTheDocument();
  });

  it("filters by currency with moneda:", async () => {
    const user = userEvent.setup();

    renderMonthlyExpensesTable([
      createRow({ currency: "USD", description: "Streaming", id: "expense-1" }),
      createRow({ currency: "ARS", description: "Expensas", id: "expense-2" }),
    ]);

    await typeQuery(user, "moneda:usd");

    await waitFor(() => {
      expect(screen.queryByText("Expensas")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Streaming")).toBeInTheDocument();
  });

  it("filters by receipt share phone presence with no:telefono", async () => {
    const user = userEvent.setup();

    renderMonthlyExpensesTable([
      createRow({
        description: "Con destino",
        id: "expense-1",
        receiptSharePhoneDigits: "5491111231234",
      }),
      createRow({
        description: "Sin destino",
        id: "expense-2",
        receiptSharePhoneDigits: "",
      }),
    ]);

    await typeQuery(user, "no:telefono");

    await waitFor(() => {
      expect(screen.queryByText("Con destino")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Sin destino")).toBeInTheDocument();
  });

  it("filters by receipt share message text with mensaje:", async () => {
    const user = userEvent.setup();

    renderMonthlyExpensesTable([
      createRow({
        description: "Alquiler",
        id: "expense-1",
        receiptShareMessage: "Pago alquiler abril",
      }),
      createRow({
        description: "Expensas",
        id: "expense-2",
        receiptShareMessage: "Expensas abril",
      }),
    ]);

    // Sin comodines el textMatch es igualdad exacta; `*texto*` es "contiene".
    await typeQuery(user, "mensaje:*alquiler*");

    await waitFor(() => {
      expect(screen.queryByText("Expensas")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Alquiler")).toBeInTheDocument();
  });

  it("filters by attached receipts count with comprobantes:", async () => {
    const user = userEvent.setup();
    const receipt = {
      allReceiptsFolderId: "",
      allReceiptsFolderViewUrl: "",
      coveredPayments: 1,
      fileId: "file-1",
      fileName: "comprobante.pdf",
      fileViewUrl: "",
      monthlyFolderId: "",
      monthlyFolderViewUrl: "",
    };

    renderMonthlyExpensesTable([
      createRow({
        description: "Con respaldo",
        id: "expense-1",
        receipts: [receipt],
      }),
      createRow({ description: "Sin respaldo", id: "expense-2", receipts: [] }),
    ]);

    await typeQuery(user, "comprobantes:>=1");

    await waitFor(() => {
      expect(screen.queryByText("Sin respaldo")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Con respaldo")).toBeInTheDocument();
  });
});
