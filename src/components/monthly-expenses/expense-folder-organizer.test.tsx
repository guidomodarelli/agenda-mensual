import { render, screen, within } from "@testing-library/react";

import { ExpenseFolderFilterBar } from "./expense-folder-organizer";

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
      selectedFilterId=""
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
