import { vi, describe, it, expect } from "vitest";
import { TooltipProvider } from "beez-ui";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  ExpenseFolderFilterBar,
  ExpenseFolderRowBadge,
} from "./expense-folder-organizer";

const SAMPLE_FOLDERS = [
  { color: "blue" as const, icon: "home" as const, id: "folder-1", name: "Hogar" },
  { color: "green" as const, icon: "cart" as const, id: "folder-2", name: "Compras" },
];

function renderFilterBar(
  overrides: Partial<Parameters<typeof ExpenseFolderFilterBar>[0]> = {},
) {
  return render(
    <TooltipProvider>
      <ExpenseFolderFilterBar
        countsByFolderId={{ "folder-1": 3, "folder-2": 5 }}
        folders={SAMPLE_FOLDERS}
        onManageFolders={vi.fn()}
        onMoveExpenseToFolder={vi.fn()}
        onReorderFolders={vi.fn()}
        onSelectFilter={vi.fn()}
        totalCount={8}
        unassignedCount={2}
        {...overrides}
      />
    </TooltipProvider>,
  );
}

describe("ExpenseFolderFilterBar", () => {
  it("shows the drag help inside a popover instead of permanent text", async () => {
    const user = userEvent.setup();

    renderFilterBar();

    expect(
      screen.queryByText(/Arrastrá la etiqueta de carpeta/),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Ayuda sobre carpetas" }),
    );

    // Radix Tooltip duplica el contenido en un nodo oculto para lectores de
    // pantalla, así que puede haber más de una coincidencia.
    expect(
      (await screen.findAllByText(/Arrastrá la etiqueta de carpeta/)).length,
    ).toBeGreaterThan(0);
  });

  it("opens the folders manager from the chips row", async () => {
    const user = userEvent.setup();
    const onManageFolders = vi.fn();

    renderFilterBar({ onManageFolders });

    await user.click(
      screen.getByRole("button", { name: "Administrar carpetas" }),
    );

    expect(onManageFolders).toHaveBeenCalledTimes(1);
  });

  it("renders the unassigned chip right after the all-folders chip", () => {
    renderFilterBar();

    const chipLabels = screen
      .getAllByRole("button")
      .map((chip) => chip.textContent);

    expect(chipLabels[0]).toContain("Todas");
    expect(chipLabels[1]).toContain("Sin carpeta");
    expect(chipLabels[2]).toContain("Hogar");
    expect(chipLabels[3]).toContain("Compras");
  });

  it("highlights folders included from the bar and marks excluded ones", () => {
    renderFilterBar({
      excludedFilterIds: new Set(["folder-2"]),
      includedFilterIds: new Set(["folder-1"]),
    });

    expect(screen.getByRole("button", { name: /Hogar/ })).toHaveClass(
      "chipSelected",
    );
    expect(screen.getByRole("button", { name: /Compras/ })).toHaveClass(
      "chipExcluded",
    );
    // Con filtros de carpeta en la barra, "Todas" deja de estar activo.
    expect(screen.getByRole("button", { name: /Todas/ })).not.toHaveClass(
      "chipSelected",
    );
  });

});

describe("ExpenseFolderRowBadge", () => {
  it("reassigns the expense folder by clicking the badge and picking another", async () => {
    const user = userEvent.setup();
    const onSelectFolder = vi.fn();

    render(
      <ExpenseFolderRowBadge
        expenseId="expense-1"
        folder={SAMPLE_FOLDERS[0]}
        folders={SAMPLE_FOLDERS}
        onSelectFolder={onSelectFolder}
      />,
    );

    await user.click(screen.getByRole("button", { name: /cambiar carpeta/i }));
    await user.click(screen.getByRole("button", { name: "Compras" }));

    expect(onSelectFolder).toHaveBeenCalledWith("folder-2");
  });

  it("clears the folder by choosing the unassigned option", async () => {
    const user = userEvent.setup();
    const onSelectFolder = vi.fn();

    render(
      <ExpenseFolderRowBadge
        expenseId="expense-1"
        folder={SAMPLE_FOLDERS[0]}
        folders={SAMPLE_FOLDERS}
        onSelectFolder={onSelectFolder}
      />,
    );

    await user.click(screen.getByRole("button", { name: /cambiar carpeta/i }));
    await user.click(screen.getByRole("button", { name: "Sin carpeta" }));

    expect(onSelectFolder).toHaveBeenCalledWith(null);
  });
});
