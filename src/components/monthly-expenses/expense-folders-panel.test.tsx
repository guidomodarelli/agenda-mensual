import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ExpenseFoldersPanel } from "./expense-folders-panel";

const SAMPLE_FOLDERS = [
  { color: "blue" as const, icon: "home" as const, id: "folder-1", name: "Hogar" },
];

function renderPanel(
  overrides: Partial<Parameters<typeof ExpenseFoldersPanel>[0]> = {},
) {
  const props = {
    feedbackErrorCode: null,
    feedbackMessage: null,
    feedbackTone: "default" as const,
    folders: SAMPLE_FOLDERS,
    isSubmitting: false,
    onCreate: jest.fn(),
    onDelete: jest.fn(),
    onUpdate: jest.fn(),
    ...overrides,
  };

  render(<ExpenseFoldersPanel {...props} />);

  return props;
}

describe("ExpenseFoldersPanel", () => {
  it("creates a folder with the typed name", async () => {
    const user = userEvent.setup();
    const onCreate = jest.fn();
    renderPanel({ onCreate });

    await user.type(screen.getByLabelText("Nombre"), "Servicios");
    await user.click(screen.getByRole("button", { name: "Agregar carpeta" }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Servicios" }),
    );
  });

  it("keeps the create action disabled until a name is entered", () => {
    renderPanel();

    expect(
      screen.getByRole("button", { name: "Agregar carpeta" }),
    ).toBeDisabled();
  });

  it("reveals the editor and saves folder changes", async () => {
    const user = userEvent.setup();
    const onUpdate = jest.fn();
    renderPanel({ onUpdate });

    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.click(
      screen.getByRole("button", { name: "Guardar cambios" }),
    );

    expect(onUpdate).toHaveBeenCalledWith(
      "folder-1",
      expect.objectContaining({ name: "Hogar" }),
    );
  });
});
