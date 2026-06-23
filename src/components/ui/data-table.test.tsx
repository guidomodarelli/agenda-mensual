import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "./data-table";

type TableRow = {
  label: string;
  paid: boolean;
};

describe("DataTable", () => {
  beforeEach(() => {
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
  });

  it("applies custom row class names based on the provided callback", () => {
    const rows: TableRow[] = [
      { label: "Pagado", paid: true },
      { label: "Pendiente", paid: false },
    ];

    const columns: ColumnDef<TableRow>[] = [
      {
        accessorKey: "label",
        header: "Estado",
      },
    ];

    render(
      <DataTable
        columns={columns}
        data={rows}
        emptyMessage="Sin datos"
        getRowClassName={(row) => (row.paid ? "paid-row" : undefined)}
      />,
    );

    expect(screen.getByText("Pagado").closest("tr")).toHaveClass("paid-row");
    expect(screen.getByText("Pendiente").closest("tr")).not.toHaveClass(
      "paid-row",
    );
  });

  it("adds and removes normalized unique exclusion tags from the toolbar", async () => {
    const user = userEvent.setup();
    const rows: TableRow[] = [{ label: "Agua", paid: true }];
    const columns: ColumnDef<TableRow>[] = [
      {
        accessorKey: "label",
        header: "Estado",
      },
    ];

    function DataTableWithExclusions() {
      const [excludeFilterValues, setExcludeFilterValues] = useState<string[]>([]);

      return (
        <DataTable
          columns={columns}
          data={rows}
          emptyMessage="Sin datos"
          excludeFilterLabel="Excluir resultados"
          excludeFilterValues={excludeFilterValues}
          filterColumnId="label"
          onExcludeFilterValuesChange={setExcludeFilterValues}
          showExcludeFilterToggle
        />
      );
    }

    render(<DataTableWithExclusions />);

    expect(
      screen.queryByText("Filtros de exclusión activos"),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Mostrar filtros de exclusión" }),
    );

    const exclusionInput = screen.getByRole("textbox", {
      name: "Excluir resultados",
    });

    await user.type(exclusionInput, "   {enter}");

    expect(
      screen.getByText("Ingresá un texto para excluir."),
    ).toBeInTheDocument();

    await user.type(exclusionInput, " Agua {enter}");

    expect(screen.getByText("− Agua")).toBeInTheDocument();
    expect(screen.getByText("Filtros de exclusión activos")).toBeInTheDocument();
    expect(
      screen.queryByText("Ingresá un texto para excluir."),
    ).not.toBeInTheDocument();

    await user.type(exclusionInput, "água{enter}");

    expect(screen.getAllByText("− Agua")).toHaveLength(1);
    expect(screen.getByText("Esa exclusión ya está activa.")).toBeInTheDocument();

    await user.type(exclusionInput, "internet");

    expect(
      screen.queryByText("Esa exclusión ya está activa."),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Limpiar filtros excluidos" }),
    );

    expect(screen.queryByText("− Agua")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Filtros de exclusión activos"),
    ).not.toBeInTheDocument();

    await user.type(exclusionInput, "Agua{enter}");

    await user.click(screen.getByRole("button", { name: "Quitar exclusión Agua" }));

    expect(screen.queryByText("− Agua")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Filtros de exclusión activos"),
    ).not.toBeInTheDocument();
  });

  it("adds a new exclusion when pressing Enter on the main filter with spaces before the leading minus", async () => {
    const user = userEvent.setup();
    const rows: TableRow[] = [
      { label: "Internet", paid: true },
      { label: "Agua", paid: false },
    ];
    const columns: ColumnDef<TableRow>[] = [
      {
        accessorKey: "label",
        header: "Estado",
      },
    ];

    function DataTableWithMainAndExcludeFilters() {
      const [excludeFilterValues, setExcludeFilterValues] = useState<string[]>([]);

      return (
        <DataTable
          columns={columns}
          data={rows}
          emptyMessage="Sin datos"
          excludeFilterValues={excludeFilterValues}
          filterColumnId="label"
          onExcludeFilterValuesChange={setExcludeFilterValues}
          showExcludeFilterToggle
        />
      );
    }

    render(<DataTableWithMainAndExcludeFilters />);

    const mainFilterInput = screen.getByRole("textbox", { name: "Filtrar" });
    await user.type(mainFilterInput, "   -internet");

    expect(mainFilterInput).toHaveClass("text-red-400");
    expect(
      screen.getByText("Estás escribiendo una exclusión. Presioná Enter para aplicarla."),
    ).toBeInTheDocument();

    await user.keyboard("{Enter}");

    expect(screen.getByText("− internet")).toBeInTheDocument();
    expect(mainFilterInput).toHaveValue("");
    expect(mainFilterInput).not.toHaveClass("text-red-400");
    expect(
      screen.queryByText("Estás escribiendo una exclusión. Presioná Enter para aplicarla."),
    ).not.toBeInTheDocument();
  });

  it("renders per-tag excluded rows counters and unique excluded rows summary", () => {
    const rows: TableRow[] = [
      { label: "Préstamo auto", paid: false },
      { label: "Préstamo tarjeta", paid: true },
    ];
    const columns: ColumnDef<TableRow>[] = [
      {
        accessorKey: "label",
        header: "Estado",
      },
    ];

    render(
      <DataTable
        columns={columns}
        data={rows}
        emptyMessage="Sin datos"
        excludeFilterRowsCountByValue={{
          auto: 2,
          tarjeta: 2,
        }}
        excludeFilterUniqueRowsCount={3}
        excludeFilterValues={["auto", "tarjeta"]}
        filterColumnId="label"
        showExcludeFilterToggle
      />,
    );

    expect(
      screen.getByLabelText("Filas excluidas por auto: 2"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Filas excluidas por tarjeta: 2"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Total de filas excluidas únicas: 3"),
    ).toBeInTheDocument();
    expect(screen.getByText("Total excluidas:")).toBeInTheDocument();
  });

  it("clears all exclusions from the summary badge action", async () => {
    const user = userEvent.setup();
    const rows: TableRow[] = [
      { label: "Préstamo auto", paid: false },
      { label: "Préstamo tarjeta", paid: true },
    ];
    const columns: ColumnDef<TableRow>[] = [
      {
        accessorKey: "label",
        header: "Estado",
      },
    ];

    function DataTableWithSummaryAndExclusions() {
      const [excludeFilterValues, setExcludeFilterValues] = useState<string[]>([
        "auto",
        "tarjeta",
      ]);

      return (
        <DataTable
          columns={columns}
          data={rows}
          emptyMessage="Sin datos"
          excludeFilterRowsCountByValue={{
            auto: 2,
            tarjeta: 2,
          }}
          excludeFilterUniqueRowsCount={3}
          excludeFilterValues={excludeFilterValues}
          filterColumnId="label"
          onExcludeFilterValuesChange={setExcludeFilterValues}
          showExcludeFilterToggle
        />
      );
    }

    render(<DataTableWithSummaryAndExclusions />);

    expect(screen.getByText("− auto")).toBeInTheDocument();
    expect(screen.getByText("− tarjeta")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Total de filas excluidas únicas: 3"),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Quitar todas las exclusiones" }),
    );

    expect(screen.queryByText("− auto")).not.toBeInTheDocument();
    expect(screen.queryByText("− tarjeta")).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Total de filas excluidas únicas: 3"),
    ).not.toBeInTheDocument();
  });

  it("does not render per-tag excluded rows counters when metrics are not provided", () => {
    const rows: TableRow[] = [
      { label: "Préstamo auto", paid: false },
      { label: "Préstamo tarjeta", paid: true },
    ];
    const columns: ColumnDef<TableRow>[] = [
      {
        accessorKey: "label",
        header: "Estado",
      },
    ];

    render(
      <DataTable
        columns={columns}
        data={rows}
        emptyMessage="Sin datos"
        excludeFilterValues={["auto", "tarjeta"]}
        filterColumnId="label"
        showExcludeFilterToggle
      />,
    );

    expect(screen.getByText("− auto")).toBeInTheDocument();
    expect(screen.getByText("− tarjeta")).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/Filas excluidas por auto:/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/Filas excluidas por tarjeta:/),
    ).not.toBeInTheDocument();
  });

  it("filters rows by a column-backed qualifier from the unified query bar", async () => {
    const user = userEvent.setup();
    type QueryRow = { amount: number; label: string };
    const allRows: QueryRow[] = [
      { amount: 10, label: "Item 10" },
      { amount: 25, label: "Item 25" },
      { amount: 40, label: "Item 40" },
    ];
    const columns: ColumnDef<QueryRow>[] = [
      {
        accessorKey: "label",
        filterFn: (row, columnId, filterValue) => {
          const query = String(filterValue ?? "").toLowerCase();
          return String(row.getValue(columnId) ?? "")
            .toLowerCase()
            .includes(query);
        },
        header: "Descripción",
      },
      {
        accessorKey: "amount",
        cell: ({ row }) => String(row.original.amount),
        filterFn: (row, _columnId, filterValue) => {
          if (
            !filterValue ||
            typeof filterValue !== "object" ||
            (filterValue as { kind?: string }).kind !== "numberRange"
          ) {
            return true;
          }

          const parsed = filterValue as { max?: number; min?: number };
          const rowAmount = row.original.amount;

          if (parsed.min != null && rowAmount < parsed.min) {
            return false;
          }

          return parsed.max == null || rowAmount <= parsed.max;
        },
        header: "Monto",
      },
    ];

    function QueryHarness() {
      const [descriptionFilter, setDescriptionFilter] = useState("");
      const [excluded, setExcluded] = useState<string[]>([]);
      const data = allRows.filter(
        (row) =>
          !excluded.some((value) =>
            row.label.toLowerCase().includes(value.toLowerCase()),
          ),
      );

      return (
        <DataTable
          columns={columns}
          data={data}
          emptyMessage="Sin datos"
          excludeFilterValues={excluded}
          filterColumnId="label"
          filterValue={descriptionFilter}
          onExcludeFilterValuesChange={setExcluded}
          onFilterValueChange={setDescriptionFilter}
          queryFilterConfig={[
            { key: "", kind: "text", label: "Descripción" },
            { columnId: "amount", key: "monto", kind: "numberRange", label: "Monto" },
          ]}
          queryFilterLabel="Filtro unificado"
          showExcludeFilterToggle
        />
      );
    }

    render(<QueryHarness />);

    const queryBar = screen.getByRole("combobox", { name: "Filtro unificado" });
    await user.click(queryBar);
    await user.type(queryBar, "monto:>20");

    expect(screen.queryByText("Item 10")).not.toBeInTheDocument();
    expect(screen.getByText("Item 25")).toBeInTheDocument();
    expect(screen.getByText("Item 40")).toBeInTheDocument();

    // Un rango cerrado desde la barra acota por ambos extremos.
    await user.clear(queryBar);
    await user.type(queryBar, "monto:20..30");

    expect(screen.queryByText("Item 10")).not.toBeInTheDocument();
    expect(screen.getByText("Item 25")).toBeInTheDocument();
    expect(screen.queryByText("Item 40")).not.toBeInTheDocument();
  });

  it("keeps non-column query filters in the bar after it loses focus", async () => {
    const user = userEvent.setup();
    type LinkRow = { label: string; link: string };
    const rows: LinkRow[] = [{ label: "Item", link: "https://x" }];
    const columns: ColumnDef<LinkRow>[] = [
      { accessorKey: "label", filterFn: () => true, header: "Descripción" },
    ];

    function QueryHarness() {
      const [descriptionFilter, setDescriptionFilter] = useState("");

      return (
        <DataTable
          columns={columns}
          data={rows}
          emptyMessage="Sin datos"
          filterColumnId="label"
          filterValue={descriptionFilter}
          onFilterValueChange={setDescriptionFilter}
          queryFilterConfig={[
            { key: "", kind: "text", label: "Descripción" },
            { key: "link", kind: "textMatch", label: "Link de pago" },
          ]}
          queryFilterLabel="Filtro unificado"
        />
      );
    }

    render(<QueryHarness />);

    const queryBar = screen.getByRole("combobox", { name: "Filtro unificado" });
    await user.click(queryBar);
    await user.type(queryBar, "link:https*");
    // Al perder el foco la barra se re-sincroniza con la forma canónica; el
    // filtro sin columna debe sobrevivir y no quedar como filtro invisible.
    await user.tab();

    expect(
      screen.getByRole("combobox", { name: "Filtro unificado" }),
    ).toHaveValue("link:https*");
  });

  it("clears an applied filter when its backing option disappears", async () => {
    const user = userEvent.setup();
    const onAppliedFiltersChange = jest.fn();
    const folderQualifier = {
      key: "carpeta",
      kind: "folder" as const,
      label: "Carpeta",
      options: [{ label: "Hogar", slug: "hogar", value: "folder-1" }],
    };

    function QueryHarness() {
      const [hasFolder, setHasFolder] = useState(true);

      return (
        <>
          <button onClick={() => setHasFolder(false)} type="button">
            Borrar carpeta
          </button>
          <DataTable
            columns={[{ accessorKey: "label", filterFn: () => true, header: "L" }]}
            data={[{ label: "Item" }]}
            emptyMessage="Sin datos"
            onAppliedFiltersChange={onAppliedFiltersChange}
            queryFilterConfig={[
              { key: "", kind: "text", label: "Descripción" },
              ...(hasFolder ? [folderQualifier] : []),
            ]}
            queryFilterLabel="Filtro unificado"
          />
        </>
      );
    }

    render(<QueryHarness />);

    await user.click(screen.getByRole("combobox", { name: "Filtro unificado" }));
    await user.type(screen.getByRole("combobox", { name: "Filtro unificado" }), "carpeta:hogar");

    expect(onAppliedFiltersChange).toHaveBeenLastCalledWith([
      { key: "carpeta", negated: false, value: { kind: "folder", folderId: "folder-1" } },
    ]);

    // Al desaparecer la opción de carpeta, el filtro huérfano debe limpiarse.
    onAppliedFiltersChange.mockClear();
    await user.click(screen.getByRole("button", { name: "Borrar carpeta" }));

    expect(onAppliedFiltersChange).toHaveBeenLastCalledWith([]);
  });

  it("keeps a folder filter selected when its folder is renamed", async () => {
    const user = userEvent.setup();
    const onAppliedFiltersChange = jest.fn();

    function QueryHarness() {
      // El renombrado cambia el slug visible de la opción pero conserva el mismo
      // `folderId`, replicando una edición de catálogo de carpetas.
      const [folderSlug, setFolderSlug] = useState("hogar");

      return (
        <>
          <button onClick={() => setFolderSlug("casa")} type="button">
            Renombrar carpeta
          </button>
          <DataTable
            columns={[{ accessorKey: "label", filterFn: () => true, header: "L" }]}
            data={[{ label: "Item" }]}
            emptyMessage="Sin datos"
            onAppliedFiltersChange={onAppliedFiltersChange}
            queryFilterConfig={[
              { key: "", kind: "text", label: "Descripción" },
              {
                key: "carpeta",
                kind: "folder" as const,
                label: "Carpeta",
                options: [
                  { label: "Hogar", slug: folderSlug, value: "folder-1" },
                ],
              },
            ]}
            queryFilterLabel="Filtro unificado"
          />
        </>
      );
    }

    render(<QueryHarness />);

    await user.click(screen.getByRole("combobox", { name: "Filtro unificado" }));
    await user.type(
      screen.getByRole("combobox", { name: "Filtro unificado" }),
      "carpeta:hogar",
    );

    expect(onAppliedFiltersChange).toHaveBeenLastCalledWith([
      { key: "carpeta", negated: false, value: { kind: "folder", folderId: "folder-1" } },
    ]);

    // Al renombrar la carpeta, el slug serializado cambia, pero el filtro
    // id-backed (mismo `folderId`) debe sobrevivir y no quedar huérfano.
    onAppliedFiltersChange.mockClear();
    await user.click(screen.getByRole("button", { name: "Renombrar carpeta" }));

    expect(onAppliedFiltersChange).toHaveBeenLastCalledWith([
      { key: "carpeta", negated: false, value: { kind: "folder", folderId: "folder-1" } },
    ]);
    expect(
      screen.getByRole("combobox", { name: "Filtro unificado" }),
    ).toHaveValue("carpeta:casa");
  });
});
