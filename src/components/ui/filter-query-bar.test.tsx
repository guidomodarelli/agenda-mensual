import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
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
    expect(selectedOption).toHaveTextContent("Me deben");
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

  it("does not suggest qualifiers for a negated token", async () => {
    const user = userEvent.setup();
    render(<FilterQueryBarHarness />);

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("-direccion:");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
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
});
