import { vi, describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LenderPicker } from "./lender-picker";

describe("LenderPicker", () => {
  it("closes the panel when clicking outside without selecting a lender", async () => {
    const user = userEvent.setup();
    const onAddLender = vi.fn();
    const onSelect = vi.fn();

    render(
      <div>
        <button type="button">Fuera</button>
        <LenderPicker
          onAddLender={onAddLender}
          onSelect={onSelect}
          options={[]}
          selectedLenderId=""
          selectedLenderName=""
        />
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "Seleccioná un prestamista" }));

    expect(screen.getByLabelText("Buscar prestamista")).toBeInTheDocument();
    expect(
      screen.getByText("No hay prestamistas registrados todavía."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Agregar prestamista" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Fuera" }));

    expect(screen.queryByLabelText("Buscar prestamista")).not.toBeInTheDocument();
    expect(
      screen.queryByText("No hay prestamistas registrados todavía."),
    ).not.toBeInTheDocument();
    expect(onAddLender).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("triggers lender creation from the picker panel", async () => {
    const user = userEvent.setup();
    const onAddLender = vi.fn();

    render(
      <LenderPicker
        onAddLender={onAddLender}
        onSelect={vi.fn()}
        options={[]}
        selectedLenderId=""
        selectedLenderName=""
      />,
    );

    await user.click(screen.getByRole("button", { name: "Seleccioná un prestamista" }));
    await user.click(screen.getByRole("button", { name: "Agregar prestamista" }));

    expect(onAddLender).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Buscar prestamista")).toBeInTheDocument();
  });

  it("keeps the add lender action visible when there are lender options", async () => {
    const user = userEvent.setup();

    render(
      <LenderPicker
        onAddLender={vi.fn()}
        onSelect={vi.fn()}
        options={[
          {
            id: "lender-1",
            name: "Banco Ciudad",
            type: "bank",
          },
        ]}
        selectedLenderId=""
        selectedLenderName=""
      />,
    );

    await user.click(screen.getByRole("button", { name: "Seleccioná un prestamista" }));

    expect(screen.getByRole("button", { name: /Banco Ciudad/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Agregar prestamista" }),
    ).toBeInTheDocument();
  });

  it("filters lenders using fuzzy, case-insensitive and accent-insensitive matching", async () => {
    const user = userEvent.setup();

    render(
      <LenderPicker
        onAddLender={vi.fn()}
        onSelect={vi.fn()}
        options={[
          {
            id: "lender-1",
            name: "Banco Nación",
            type: "bank",
          },
          {
            id: "lender-2",
            name: "Árbol Finanzas",
            type: "other",
          },
          {
            id: "lender-3",
            name: "Casa Central",
            type: "family",
          },
        ]}
        selectedLenderId=""
        selectedLenderName=""
      />,
    );

    await user.click(screen.getByRole("button", { name: "Seleccioná un prestamista" }));
    await user.type(screen.getByLabelText("Buscar prestamista"), "BNCN");

    expect(
      screen.getAllByText((_, element) => element?.textContent === "Banco Nación"),
    ).not.toHaveLength(0);
    expect(
      screen.queryByText((_, element) => element?.textContent === "Árbol Finanzas"),
    ).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Buscar prestamista"));
    await user.type(screen.getByLabelText("Buscar prestamista"), "NACION");

    expect(
      screen.getAllByText((_, element) => element?.textContent === "Banco Nación"),
    ).not.toHaveLength(0);
  });

  it("highlights matching lender name parts while typing", async () => {
    const user = userEvent.setup();

    render(
      <LenderPicker
        onAddLender={vi.fn()}
        onSelect={vi.fn()}
        options={[
          {
            id: "lender-1",
            name: "Nación",
            type: "bank",
          },
        ]}
        selectedLenderId=""
        selectedLenderName=""
      />,
    );

    await user.click(screen.getByRole("button", { name: "Seleccioná un prestamista" }));
    await user.type(screen.getByLabelText("Buscar prestamista"), "NACION");

    const lenderOption = screen.getByRole("button", {
      name: /Nación\s*Banco/i,
    });

    const highlightedText = Array.from(
      lenderOption.querySelectorAll("mark"),
      (element) => element.textContent ?? "",
    ).join("");

    expect(highlightedText).toBe("Nación");
  });

  it("shows lender notes in each option", async () => {
    const user = userEvent.setup();

    render(
      <LenderPicker
        onAddLender={vi.fn()}
        onSelect={vi.fn()}
        options={[
          {
            id: "lender-1",
            name: "Adrián Saúl Modarelli",
            notes: "Tío de la familia",
            type: "family",
          },
        ]}
        selectedLenderId=""
        selectedLenderName=""
      />,
    );

    await user.click(screen.getByRole("button", { name: "Seleccioná un prestamista" }));

    expect(
      screen.getByText((_, element) => element?.textContent === "Tío de la familia"),
    ).toBeInTheDocument();
  });

  it("filters by lender notes with fuzzy accent-insensitive matching and highlights note matches", async () => {
    const user = userEvent.setup();

    render(
      <LenderPicker
        onAddLender={vi.fn()}
        onSelect={vi.fn()}
        options={[
          {
            id: "lender-1",
            name: "Adrián Saúl Modarelli",
            notes: "Crédito ágil mensual",
            type: "family",
          },
          {
            id: "lender-2",
            name: "Banco Norte",
            notes: "Cuenta corriente",
            type: "bank",
          },
        ]}
        selectedLenderId=""
        selectedLenderName=""
      />,
    );

    await user.click(screen.getByRole("button", { name: "Seleccioná un prestamista" }));
    await user.type(screen.getByLabelText("Buscar prestamista"), "AGIL");

    const lenderOption = screen.getByRole("button", {
      name: /Adrián Saúl Modarelli/i,
    });
    // Varios ancestros comparten el mismo textContent; el último en orden de
    // documento es el nodo más interno, que contiene los <mark> resaltados.
    const notesElements = screen.getAllByText(
      (_, element) => element?.textContent === "Crédito ágil mensual",
    );
    const notesElement = notesElements[notesElements.length - 1];
    const highlightedText = Array.from(
      notesElement.querySelectorAll("mark"),
      (element) => element.textContent ?? "",
    ).join("");

    expect(lenderOption).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Banco Norte/i }),
    ).not.toBeInTheDocument();
    expect(highlightedText).toBe("ágil");
  });

  it("filters by lender type with fuzzy matching and highlights type matches", async () => {
    const user = userEvent.setup();

    render(
      <LenderPicker
        onAddLender={vi.fn()}
        onSelect={vi.fn()}
        options={[
          {
            id: "lender-1",
            name: "Lucía Pérez",
            type: "family",
          },
          {
            id: "lender-2",
            name: "Banco Sur",
            type: "bank",
          },
        ]}
        selectedLenderId=""
        selectedLenderName=""
      />,
    );

    await user.click(screen.getByRole("button", { name: "Seleccioná un prestamista" }));
    await user.type(screen.getByLabelText("Buscar prestamista"), "FMLR");

    const lenderOption = screen.getByRole("button", {
      name: /Lucía Pérez/i,
    });
    const typeElement = lenderOption.lastElementChild;

    expect(typeElement).not.toBeNull();

    if (typeElement === null) {
      throw new Error("Expected lender type element");
    }

    const highlightedText = Array.from(
      typeElement.querySelectorAll("mark"),
      (element) => element.textContent ?? "",
    ).join("");

    expect(
      screen.queryByRole("button", { name: /Banco Sur/i }),
    ).not.toBeInTheDocument();
    expect(highlightedText).toBe("Fmlr");
  });

  it("prioritizes lender matches with more contiguous letters", async () => {
    const user = userEvent.setup();

    render(
      <LenderPicker
        onAddLender={vi.fn()}
        onSelect={vi.fn()}
        options={[
          {
            id: "lender-1",
            name: "Impuestos del auto",
            type: "other",
          },
          {
            id: "lender-2",
            name: "Limpieza Domestica",
            type: "other",
          },
          {
            id: "lender-3",
            name: "Iphone",
            type: "other",
          },
        ]}
        selectedLenderId=""
        selectedLenderName=""
      />,
    );

    await user.click(screen.getByRole("button", { name: "Seleccioná un prestamista" }));
    await user.type(screen.getByLabelText("Buscar prestamista"), "ipe");

    const getOptionButtonByName = (name: string) => {
      const normalizedName = name.toLowerCase().replace(/\s+/g, "");
      const button = screen.getAllByRole("button").find((currentButton) => {
        const className =
          typeof currentButton.className === "string" ? currentButton.className : "";

        if (!className.includes("option")) {
          return false;
        }

        const normalizedContent = (currentButton.textContent ?? "")
          .toLowerCase()
          .replace(/\s+/g, "");

        return normalizedContent.includes(normalizedName);
      });

      expect(button).toBeDefined();

      if (button === undefined) {
        throw new Error(`Expected lender option with name \"${name}\"`);
      }

      return button;
    };

    const iphoneOption = getOptionButtonByName("Iphone");
    const impuestosOption = getOptionButtonByName("Impuestos del auto");
    const limpiezaOption = getOptionButtonByName("Limpieza Domestica");

    const allOptionButtons = [iphoneOption, impuestosOption, limpiezaOption];
    const orderedByDom = [...allOptionButtons].sort((leftButton, rightButton) => {
      if (leftButton === rightButton) {
        return 0;
      }

      return leftButton.compareDocumentPosition(rightButton) &
        Node.DOCUMENT_POSITION_FOLLOWING
        ? -1
        : 1;
    });

    expect(orderedByDom[0]).toBe(iphoneOption);
  });
});
