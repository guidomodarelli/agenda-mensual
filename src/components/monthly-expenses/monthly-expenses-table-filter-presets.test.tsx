import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  getPersistedMonthlyExpensesFilterPresets,
  persistMonthlyExpensesFilterPresets,
} from "./monthly-expenses-filter-presets";
import {
  createRow,
  renderMonthlyExpensesTable,
} from "./monthly-expenses-table-test-utils";

const ROWS = [
  createRow({ description: "Internet", id: "expense-1", total: "2000" }),
  createRow({ description: "Luz", id: "expense-2", total: "500" }),
];

async function typeInQueryBar(
  user: ReturnType<typeof userEvent.setup>,
  query: string,
) {
  const queryBar = screen.getByRole("combobox", {
    name: "Filtro unificado de gastos",
  });

  await user.click(queryBar);
  await user.type(queryBar, query);
}

describe("MonthlyExpensesTable filter presets", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("disables saving while the filter bar has no active filters", () => {
    renderMonthlyExpensesTable(ROWS);

    expect(
      screen.getByRole("button", { name: "Guardar filtro" }),
    ).toBeDisabled();
  });

  it("saves the current query as a named preset chip", async () => {
    const user = userEvent.setup();

    renderMonthlyExpensesTable(ROWS);

    await typeInQueryBar(user, "Internet");
    await user.click(screen.getByRole("button", { name: "Guardar filtro" }));
    await user.type(
      await screen.findByLabelText("Nombre del filtro"),
      "Solo Internet",
    );
    await user.click(
      screen.getByRole("button", { name: "Guardar filtro con nombre" }),
    );

    expect(
      await screen.findByRole("button", {
        name: "Aplicar filtro guardado Solo Internet",
      }),
    ).toBeInTheDocument();
    expect(getPersistedMonthlyExpensesFilterPresets()).toEqual([
      { name: "Solo Internet", query: "Internet" },
    ]);
  });

  it("applies a saved preset with one click", async () => {
    persistMonthlyExpensesFilterPresets([
      { name: "Solo Internet", query: "Internet" },
    ]);
    const user = userEvent.setup();

    renderMonthlyExpensesTable(ROWS);

    expect(screen.getByText("Luz")).toBeInTheDocument();

    await user.click(
      await screen.findByRole("button", {
        name: "Aplicar filtro guardado Solo Internet",
      }),
    );

    await waitFor(() => {
      expect(screen.queryByText("Luz")).not.toBeInTheDocument();
    });
    // La descripción resaltada anida varios nodos con el mismo texto.
    expect(screen.getAllByText("Internet").length).toBeGreaterThan(0);
  });

  it("edits the name and query of a saved preset", async () => {
    persistMonthlyExpensesFilterPresets([
      { name: "Solo Internet", query: "Internet" },
    ]);
    const user = userEvent.setup();

    renderMonthlyExpensesTable(ROWS);

    await user.click(
      await screen.findByRole("button", {
        name: "Editar filtro guardado Solo Internet",
      }),
    );

    const nameInput = await screen.findByLabelText("Nombre del filtro");
    const queryInput = screen.getByLabelText("Búsqueda del filtro");

    expect(nameInput).toHaveValue("Solo Internet");
    expect(queryInput).toHaveValue("Internet");

    await user.clear(nameInput);
    await user.type(nameInput, "Solo Luz");
    await user.clear(queryInput);
    await user.type(queryInput, "Luz");
    await user.click(
      screen.getByRole("button", { name: "Guardar cambios del filtro" }),
    );

    expect(
      await screen.findByRole("button", {
        name: "Aplicar filtro guardado Solo Luz",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Aplicar filtro guardado Solo Internet",
      }),
    ).not.toBeInTheDocument();
    expect(getPersistedMonthlyExpensesFilterPresets()).toEqual([
      { name: "Solo Luz", query: "Luz" },
    ]);

    await user.click(
      screen.getByRole("button", { name: "Aplicar filtro guardado Solo Luz" }),
    );

    await waitFor(() => {
      expect(screen.queryByText("Internet")).not.toBeInTheDocument();
    });
    expect(screen.getAllByText("Luz").length).toBeGreaterThan(0);
  });

  it("offers the unified bar suggestions inside the preset query editor", async () => {
    persistMonthlyExpensesFilterPresets([
      { name: "Solo Internet", query: "Internet" },
    ]);
    const user = userEvent.setup();

    renderMonthlyExpensesTable(ROWS);

    await user.click(
      await screen.findByRole("button", {
        name: "Editar filtro guardado Solo Internet",
      }),
    );

    const queryInput = await screen.findByLabelText("Búsqueda del filtro");

    await user.clear(queryInput);
    await user.type(queryInput, "tot");

    expect(
      await screen.findByRole("option", { name: "Total" }),
    ).toBeInTheDocument();

    await user.keyboard("{ArrowDown}{Enter}");

    expect(queryInput).toHaveValue("total:");
    // Elegir una sugerencia no debe cerrar el popover de edición.
    expect(screen.getByLabelText("Nombre del filtro")).toBeInTheDocument();
  });

  it("rejects renaming a preset to another existing preset name", async () => {
    persistMonthlyExpensesFilterPresets([
      { name: "Solo Internet", query: "Internet" },
      { name: "Solo Luz", query: "Luz" },
    ]);
    const user = userEvent.setup();

    renderMonthlyExpensesTable(ROWS);

    await user.click(
      await screen.findByRole("button", {
        name: "Editar filtro guardado Solo Internet",
      }),
    );

    const nameInput = await screen.findByLabelText("Nombre del filtro");

    await user.clear(nameInput);
    await user.type(nameInput, "Solo Luz");
    await user.click(
      screen.getByRole("button", { name: "Guardar cambios del filtro" }),
    );

    expect(
      await screen.findByText("Ya existe un filtro con ese nombre."),
    ).toBeInTheDocument();
    expect(getPersistedMonthlyExpensesFilterPresets()).toEqual([
      { name: "Solo Internet", query: "Internet" },
      { name: "Solo Luz", query: "Luz" },
    ]);
  });

  it("deletes a saved preset after confirming", async () => {
    persistMonthlyExpensesFilterPresets([
      { name: "Solo Internet", query: "Internet" },
    ]);
    const user = userEvent.setup();

    renderMonthlyExpensesTable(ROWS);

    await user.click(
      await screen.findByRole("button", {
        name: "Eliminar filtro guardado Solo Internet",
      }),
    );

    // La X abre una confirmación; todavía no borra nada.
    expect(
      await screen.findByText(
        '¿Querés eliminar el filtro guardado "Solo Internet"?',
      ),
    ).toBeInTheDocument();
    expect(getPersistedMonthlyExpensesFilterPresets()).toEqual([
      { name: "Solo Internet", query: "Internet" },
    ]);

    await user.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("button", {
          name: "Aplicar filtro guardado Solo Internet",
        }),
      ).not.toBeInTheDocument();
    });
    expect(getPersistedMonthlyExpensesFilterPresets()).toEqual([]);
  });

  it("keeps the preset when the delete confirmation is cancelled", async () => {
    persistMonthlyExpensesFilterPresets([
      { name: "Solo Internet", query: "Internet" },
    ]);
    const user = userEvent.setup();

    renderMonthlyExpensesTable(ROWS);

    await user.click(
      await screen.findByRole("button", {
        name: "Eliminar filtro guardado Solo Internet",
      }),
    );
    await user.click(await screen.findByRole("button", { name: "Cancelar" }));

    expect(
      screen.getByRole("button", {
        name: "Aplicar filtro guardado Solo Internet",
      }),
    ).toBeInTheDocument();
    expect(getPersistedMonthlyExpensesFilterPresets()).toEqual([
      { name: "Solo Internet", query: "Internet" },
    ]);
  });
});
