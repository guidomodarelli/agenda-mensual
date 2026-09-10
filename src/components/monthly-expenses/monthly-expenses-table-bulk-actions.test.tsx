import { vi, describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  createRow,
  renderMonthlyExpensesTable,
} from "./monthly-expenses-table-test-utils";

const HOME_FOLDER = {
  color: null,
  icon: null,
  id: "folder-1",
  name: "Hogar",
};

async function selectAllVisibleRows(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole("columnheader", {
      name: "Seleccionar todas las filas visibles",
    }),
  );
}

describe("MonthlyExpensesTable bulk move to folder", () => {
  it("moves the selected visible expenses to the chosen folder after confirming", async () => {
    const user = userEvent.setup();
    const onMoveExpensesToFolder = vi.fn().mockResolvedValue(true);

    renderMonthlyExpensesTable(
      [
        createRow({ description: "Internet", id: "expense-1" }),
        createRow({ description: "Luz", id: "expense-2" }),
      ],
      {
        expenseFolders: [HOME_FOLDER],
        onMoveExpensesToFolder,
      },
    );

    await selectAllVisibleRows(user);
    await user.click(screen.getByRole("button", { name: "Acciones masivas" }));
    await user.click(screen.getByRole("menuitem", { name: "Mover a carpeta" }));

    expect(
      await screen.findByText("Mover gastos a una carpeta"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sin carpeta" }));
    await user.click(await screen.findByRole("button", { name: "Hogar" }));
    await user.click(screen.getByRole("button", { name: "Mover" }));

    await waitFor(() => {
      expect(onMoveExpensesToFolder).toHaveBeenCalledWith({
        expenseIds: ["expense-1", "expense-2"],
        folderId: "folder-1",
      });
    });

    await waitFor(() => {
      expect(
        screen.queryByText("Mover gastos a una carpeta"),
      ).not.toBeInTheDocument();
    });
  });

  it("does not move expenses when the dialog is cancelled", async () => {
    const user = userEvent.setup();
    const onMoveExpensesToFolder = vi.fn().mockResolvedValue(true);

    renderMonthlyExpensesTable(
      [createRow({ description: "Internet", id: "expense-1" })],
      {
        expenseFolders: [HOME_FOLDER],
        onMoveExpensesToFolder,
      },
    );

    await selectAllVisibleRows(user);
    await user.click(screen.getByRole("button", { name: "Acciones masivas" }));
    await user.click(screen.getByRole("menuitem", { name: "Mover a carpeta" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onMoveExpensesToFolder).not.toHaveBeenCalled();
    expect(
      screen.queryByText("Mover gastos a una carpeta"),
    ).not.toBeInTheDocument();
  });

  it("disables bulk actions without a selection", () => {
    renderMonthlyExpensesTable([
      createRow({ description: "Internet", id: "expense-1" }),
    ]);

    expect(
      screen.getByRole("button", { name: "Acciones masivas" }),
    ).toBeDisabled();
  });
});
