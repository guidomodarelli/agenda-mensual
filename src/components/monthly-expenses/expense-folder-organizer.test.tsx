import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  ExpenseFolderFilterBar,
  ExpenseFolderRowBadge,
} from "./expense-folder-organizer";

const SAMPLE_FOLDERS = [
  { color: "blue" as const, icon: "home" as const, id: "folder-1", name: "Hogar" },
  { color: "green" as const, icon: "cart" as const, id: "folder-2", name: "Compras" },
];

function renderFilterBar() {
  return render(
    <ExpenseFolderFilterBar
      countsByFolderId={{ "folder-1": 3, "folder-2": 5 }}
      folders={SAMPLE_FOLDERS}
      onMoveExpenseToFolder={jest.fn()}
      onReorderFolders={jest.fn()}
      onSelectFilter={jest.fn()}
      totalCount={8}
      unassignedCount={2}
    />,
  );
}

describe("ExpenseFolderFilterBar", () => {
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
    render(
      <ExpenseFolderFilterBar
        countsByFolderId={{ "folder-1": 3, "folder-2": 5 }}
        excludedFilterIds={new Set(["folder-2"])}
        folders={SAMPLE_FOLDERS}
        includedFilterIds={new Set(["folder-1"])}
        onMoveExpenseToFolder={jest.fn()}
        onReorderFolders={jest.fn()}
        onSelectFilter={jest.fn()}
        totalCount={8}
        unassignedCount={2}
      />,
    );

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

  it("shows the drag-and-drop hint below the chips", () => {
    renderFilterBar();

    const hint = screen.getByText(/arrastrá un chip de carpeta sobre otro/i);
    const filterBar = hint.parentElement as HTMLElement;
    const filterBarChildren = Array.from(filterBar.children);

    expect(filterBarChildren[0]).toHaveTextContent("Todas");
    expect(filterBarChildren.at(-1)).toBe(hint);
    expect(within(filterBarChildren[0] as HTMLElement).getByText("Todas"))
      .toBeInTheDocument();
  });
});

describe("ExpenseFolderRowBadge", () => {
  it("reassigns the expense folder by clicking the badge and picking another", async () => {
    const user = userEvent.setup();
    const onSelectFolder = jest.fn();

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
    const onSelectFolder = jest.fn();

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
