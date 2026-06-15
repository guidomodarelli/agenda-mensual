import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ExpenseFolderPicker } from "./expense-folder-picker";

const SAMPLE_FOLDERS = [
  { color: "blue" as const, icon: "home" as const, id: "folder-1", name: "Hogar" },
  { color: "green" as const, icon: "cart" as const, id: "folder-2", name: "Compras" },
];

describe("ExpenseFolderPicker", () => {
  it("selects a folder from the panel", async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();

    render(
      <ExpenseFolderPicker
        onManageFolders={jest.fn()}
        onSelect={onSelect}
        options={SAMPLE_FOLDERS}
        selectedFolderId=""
      />,
    );

    await user.click(screen.getByRole("button", { name: "Sin carpeta" }));
    await user.click(screen.getByRole("button", { name: "Hogar" }));

    expect(onSelect).toHaveBeenCalledWith("folder-1");
  });

  it("clears the folder when choosing the unassigned option", async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();

    render(
      <ExpenseFolderPicker
        onManageFolders={jest.fn()}
        onSelect={onSelect}
        options={SAMPLE_FOLDERS}
        selectedFolderId="folder-1"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Hogar" }));
    await user.click(
      screen.getByRole("button", { name: "Sin carpeta" }),
    );

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("opens the folders manager from the panel", async () => {
    const user = userEvent.setup();
    const onManageFolders = jest.fn();

    render(
      <ExpenseFolderPicker
        onManageFolders={onManageFolders}
        onSelect={jest.fn()}
        options={SAMPLE_FOLDERS}
        selectedFolderId=""
      />,
    );

    await user.click(screen.getByRole("button", { name: "Sin carpeta" }));
    await user.click(
      screen.getByRole("button", { name: "Administrar carpetas" }),
    );

    expect(onManageFolders).toHaveBeenCalledTimes(1);
  });
});
