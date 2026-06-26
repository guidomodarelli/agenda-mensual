import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FilterQueryBar } from "./filter-query-bar";
import type { FilterQualifierConfig } from "./filter-query-grammar";

const CONFIGS: FilterQualifierConfig[] = [
  { key: "", kind: "text", label: "Descripción" },
  { columnId: "subtotal", key: "subtotal", kind: "numberRange", label: "Subtotal" },
  {
    columnId: "lenderName",
    key: "direccion",
    kind: "enum",
    label: "Dirección",
    options: [
      { label: "Yo debo", slug: "yo-debo", value: "payable" },
      { label: "Me deben", slug: "me-deben", value: "receivable" },
    ],
  },
  { columnId: "loanProgress", key: "deuda", kind: "presence", label: "Deuda / cuotas" },
  { key: "inicio", kind: "yearMonthRange", label: "Inicio de cuota" },
  { key: "link", kind: "textMatch", label: "Link de pago" },
  {
    key: "carpeta",
    kind: "folder",
    label: "Carpeta",
    options: [
      { label: "Hogar", slug: "hogar", value: "folder-1" },
    ],
  },
];

function FilterQueryBarHarness() {
  const [value, setValue] = useState("");

  return (
    <FilterQueryBar configs={CONFIGS} onValueChange={setValue} value={value} />
  );
}

function installPointerCapturePolyfills() {
  if (typeof HTMLElement !== "undefined") {
    if (!HTMLElement.prototype.hasPointerCapture) {
      Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
        configurable: true,
        value: () => false,
      });
    }

    if (!HTMLElement.prototype.setPointerCapture) {
      Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
        configurable: true,
        value: () => undefined,
      });
    }

    if (!HTMLElement.prototype.releasePointerCapture) {
      Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
        configurable: true,
        value: () => undefined,
      });
    }
  }

  if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: () => undefined,
    });
  }
}

describe("FilterQueryBar", () => {
  beforeEach(() => {
    installPointerCapturePolyfills();
  });

  it("exposes combobox semantics", () => {
    render(<FilterQueryBarHarness />);

    const combobox = screen.getByRole("combobox");

    expect(combobox).toHaveAttribute("aria-autocomplete", "list");
    expect(combobox).toHaveAttribute("aria-expanded", "false");
  });

  it("suggests fields while typing a key", async () => {
    const user = userEvent.setup();
    render(<FilterQueryBarHarness />);

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("sub");

    const listbox = await screen.findByRole("listbox");
    const options = within(listbox).getAllByRole("option");

    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Subtotal");
  });

  it("suggests enum values after the colon", async () => {
    const user = userEvent.setup();
    render(<FilterQueryBarHarness />);

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("direccion:");

    const listbox = await screen.findByRole("listbox");
    const options = within(listbox).getAllByRole("option");

    expect(options.map((option) => option.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Yo debo"),
        expect.stringContaining("Me deben"),
      ]),
    );
  });

  it("inserts a selected field with Enter and chains to value mode", async () => {
    const user = userEvent.setup();
    render(<FilterQueryBarHarness />);

    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await user.keyboard("sub");
    await user.keyboard("{Enter}");

    expect(combobox).toHaveValue("subtotal:");
    // Tras insertar la clave, el popover sigue abierto sugiriendo valores.
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
  });

  it("moves the active option with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<FilterQueryBarHarness />);

    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await user.keyboard("direccion:");
    await screen.findByRole("listbox");

    await user.keyboard("{ArrowDown}");

    const activeDescendantId = combobox.getAttribute("aria-activedescendant");
    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    const selectedOption = options.find(
      (option) => option.getAttribute("aria-selected") === "true",
    );

    expect(selectedOption?.id).toBe(activeDescendantId);
    // El bloque universal (No tiene / Tiene / Excluir) encabeza la lista, así que
    // la primera flecha hacia abajo resalta la segunda opción universal.
    expect(selectedOption).toHaveTextContent("Tiene Dirección");
  });

  it("applies an enum value by clicking it", async () => {
    const user = userEvent.setup();
    render(<FilterQueryBarHarness />);

    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await user.keyboard("direccion:");

    const listbox = await screen.findByRole("listbox");
    await user.click(within(listbox).getByText("Me deben"));

    expect(combobox).toHaveValue("direccion:me-deben ");
  });

  it("closes the popover on Escape without clearing the query", async () => {
    const user = userEvent.setup();
    render(<FilterQueryBarHarness />);

    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await user.keyboard("sub");
    await screen.findByRole("listbox");

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(combobox).toHaveValue("sub");
  });

  it("suggests fields to exclude inside a negated key token", async () => {
    const user = userEvent.setup();
    render(<FilterQueryBarHarness />);

    const combobox = screen.getByRole("combobox");
    await user.click(combobox);

    // Modo clave negado (`-dir`): se sugieren los campos a excluir (`-direccion:`).
    await user.keyboard("-dir");
    const keyListbox = await screen.findByRole("listbox");
    expect(within(keyListbox).getByText("Dirección")).toBeInTheDocument();

    // Modo valor negado (`-direccion:`): se sugieren los valores del enum.
    await user.keyboard("eccion:");
    const valueListbox = await screen.findByRole("listbox");
    expect(within(valueListbox).getAllByRole("option").length).toBeGreaterThan(0);
  });

  it("offers Exclude last on the empty bar and starts a field exclusion", async () => {
    const user = userEvent.setup();
    render(<FilterQueryBarHarness />);

    const combobox = screen.getByRole("combobox");
    await user.click(combobox);

    const listbox = await screen.findByRole("listbox");
    const labels = within(listbox)
      .getAllByRole("option")
      .map((option) => option.textContent ?? "");
    // "Excluir" es la última opción del estado vacío.
    expect(labels[labels.length - 1]).toContain("Excluir");

    await user.click(within(listbox).getByText("Excluir"));
    expect(combobox).toHaveValue("-");

    // Tras elegir "Excluir", la lista de campos reaparece para elegir cuál excluir.
    const fieldListbox = await screen.findByRole("listbox");
    await user.click(within(fieldListbox).getByText("Dirección"));
    expect(combobox).toHaveValue("-direccion:");
  });

  it("lets Tab move focus when no suggestion was navigated", async () => {
    const user = userEvent.setup();
    render(
      <>
        <FilterQueryBarHarness />
        <button type="button">Después</button>
      </>,
    );

    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await screen.findByRole("listbox");

    await user.tab();

    // Tab no insertó la primera sugerencia y movió el foco al botón siguiente.
    expect(combobox).toHaveValue("");
    expect(screen.getByRole("button", { name: "Después" })).toHaveFocus();
  });

  it("accepts a suggestion with Tab after navigating with the arrows", async () => {
    const user = userEvent.setup();
    render(<FilterQueryBarHarness />);

    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await user.keyboard("sub");
    await screen.findByRole("listbox");

    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Tab}");

    expect(combobox).toHaveValue("subtotal:");
  });

  it("clears the whole query with the clear button", async () => {
    const user = userEvent.setup();
    render(<FilterQueryBarHarness />);

    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await user.keyboard("subtotal:>100");

    await user.click(
      screen.getByRole("button", { name: "Limpiar todos los filtros" }),
    );

    expect(combobox).toHaveValue("");
  });

  it("suggests starts/contains/ends operators for a text qualifier", async () => {
    const user = userEvent.setup();
    render(<FilterQueryBarHarness />);

    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await user.keyboard("link:");

    const listbox = await screen.findByRole("listbox");
    const labels = within(listbox)
      .getAllByRole("option")
      .map((option) => option.textContent ?? "");

    expect(labels.some((label) => label.includes("Empieza por"))).toBe(true);
    expect(labels.some((label) => label.includes("Contiene"))).toBe(true);
    expect(labels.some((label) => label.includes("Termina con"))).toBe(true);
  });

  it("builds an ends-with glob token (*texto) via the operator", async () => {
    const user = userEvent.setup();
    render(<FilterQueryBarHarness />);

    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await user.keyboard("link:");

    const listbox = await screen.findByRole("listbox");
    await user.click(within(listbox).getByText("Termina con…"));

    // Inserta `*` y el caret queda después; al escribir forma `*texto`.
    await user.keyboard("pdf");
    expect(combobox).toHaveValue("link:*pdf");
  });

  it("builds a contains glob token (*texto*) with the caret between the stars", async () => {
    const user = userEvent.setup();
    render(<FilterQueryBarHarness />);

    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await user.keyboard("link:");

    const listbox = await screen.findByRole("listbox");
    await user.click(within(listbox).getByText("Contiene…"));

    // Inserta `**` con el caret en medio; al escribir forma `*texto*`.
    await user.keyboard("mp");
    expect(combobox).toHaveValue("link:*mp*");
  });

  it("suggests folder values without an unassigned value", async () => {
    const user = userEvent.setup();
    render(<FilterQueryBarHarness />);

    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await user.keyboard("carpeta:");

    const listbox = await screen.findByRole("listbox");
    const labels = within(listbox)
      .getAllByRole("option")
      .map((option) => option.textContent);

    expect(labels.some((label) => label?.includes("Hogar"))).toBe(true);
    expect(labels.some((label) => label?.includes("Sin carpeta"))).toBe(false);
  });

  it("suggests folder values inside a negated qualifier token", async () => {
    const user = userEvent.setup();
    render(<FilterQueryBarHarness />);

    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await user.keyboard("-carpeta:");

    const listbox = await screen.findByRole("listbox");
    const labels = within(listbox)
      .getAllByRole("option")
      .map((option) => option.textContent);

    expect(labels.some((label) => label?.includes("Hogar"))).toBe(true);
    // Dentro de un token negado no aparece el bloque universal No/Tiene/Excluir.
    expect(labels.some((label) => label?.includes("No tiene"))).toBe(false);
  });

  it("does not suggest a folder value that is already applied with the same polarity", async () => {
    const user = userEvent.setup();
    render(<FilterQueryBarHarness />);

    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await user.keyboard("-carpeta:hogar -carpeta:h");

    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });

  it("does not suggest a folder value that is already applied with the opposite polarity", async () => {
    const user = userEvent.setup();
    render(<FilterQueryBarHarness />);

    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await user.keyboard("-carpeta:hogar carpeta:h");

    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });

  it("does not suggest folder values when folder absence is required", async () => {
    const user = userEvent.setup();
    render(<FilterQueryBarHarness />);

    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await user.keyboard("no:carpeta -carpeta:");

    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });

  it("does not suggest an enum value that is already applied with the same polarity", async () => {
    const user = userEvent.setup();
    render(<FilterQueryBarHarness />);

    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await user.keyboard("direccion:yo-debo direccion:y");

    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });

  it("does not suggest an enum value that is already applied with the opposite polarity", async () => {
    const user = userEvent.setup();
    render(<FilterQueryBarHarness />);

    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await user.keyboard("-direccion:yo-debo direccion:y");

    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });

  it("does not suggest a presence meta value that is already applied", async () => {
    const user = userEvent.setup();
    render(<FilterQueryBarHarness />);

    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await user.keyboard("tiene:link tiene:l");

    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });

  it("does not suggest an opposite presence meta value for an already filtered field", async () => {
    const user = userEvent.setup();
    render(<FilterQueryBarHarness />);

    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await user.keyboard("no:carpeta tiene:c");

    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    await user.clear(combobox);
    await user.keyboard("tiene:carpeta no:c");

    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });

  it("heads every filter with the universal No/Tiene/Excluir block", async () => {
    const user = userEvent.setup();
    render(<FilterQueryBarHarness />);

    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await user.keyboard("link:");

    const listbox = await screen.findByRole("listbox");
    const labels = within(listbox)
      .getAllByRole("option")
      .map((option) => option.textContent ?? "");

    expect(labels[0]).toContain("No tiene Link de pago");
    expect(labels[1]).toContain("Tiene Link de pago");
    expect(labels[2]).toContain("Excluir Link de pago");
  });

  it("inserts the presence meta-key when picking Tiene", async () => {
    const user = userEvent.setup();
    render(<FilterQueryBarHarness />);

    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await user.keyboard("link:");

    const listbox = await screen.findByRole("listbox");
    await user.click(within(listbox).getByText("Tiene Link de pago"));

    expect(combobox).toHaveValue("tiene:link ");
  });

  it("switches to an exclusion token when picking Excluir", async () => {
    const user = userEvent.setup();
    render(<FilterQueryBarHarness />);

    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await user.keyboard("carpeta:");

    const listbox = await screen.findByRole("listbox");
    await user.click(within(listbox).getByText(/Excluir Carpeta/));

    expect(combobox).toHaveValue("-carpeta:");
    // El popover sigue abierto ofreciendo los valores a excluir.
    const reopened = await screen.findByRole("listbox");
    const labels = within(reopened)
      .getAllByRole("option")
      .map((option) => option.textContent ?? "");
    expect(labels.some((label) => label.includes("Hogar"))).toBe(true);
  });

  it("suggests date comparators (>=, <=, ..) for a year-month qualifier", async () => {
    const user = userEvent.setup();
    render(<FilterQueryBarHarness />);

    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await user.keyboard("inicio:");

    const listbox = await screen.findByRole("listbox");
    const labels = within(listbox)
      .getAllByRole("option")
      .map((option) => option.textContent ?? "");

    expect(labels.some((label) => label.includes("Desde"))).toBe(true);
    expect(labels.some((label) => label.includes("Hasta"))).toBe(true);
    expect(labels.some((label) => label.includes("Rango"))).toBe(true);
  });

  it("suggests target fields after typing a tiene: meta-key", async () => {
    const user = userEvent.setup();
    render(<FilterQueryBarHarness />);

    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await user.keyboard("tiene:");

    const listbox = await screen.findByRole("listbox");
    const labels = within(listbox)
      .getAllByRole("option")
      .map((option) => option.textContent ?? "");

    expect(labels.some((label) => label.includes("Subtotal"))).toBe(true);
    expect(labels.some((label) => label.includes("Carpeta"))).toBe(true);
  });
});
