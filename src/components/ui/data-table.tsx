"use client";

import * as React from "react";
import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  emptyMessage: string;
  filterColumnId?: string;
  filterLabel?: string;
  filterPlaceholder?: string;
  showColumnVisibilityToggle?: boolean;
  columnVisibilityButtonLabel?: string;
  columnVisibilityMenuLabel?: string;
  selectAllColumnsLabel?: string;
  deselectAllColumnsLabel?: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  emptyMessage,
  filterColumnId,
  filterLabel = "Filtrar",
  filterPlaceholder = "Filtrar...",
  showColumnVisibilityToggle = false,
  columnVisibilityButtonLabel = "Columnas",
  columnVisibilityMenuLabel = "Mostrar columnas",
  selectAllColumnsLabel = "Seleccionar todas",
  deselectAllColumnsLabel = "Deseleccionar todas",
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});

  // TanStack Table manages internal reactive state through this hook.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      columnFilters,
      columnVisibility,
      sorting,
    },
  });
  const hideableColumns = table
    .getAllLeafColumns()
    .filter((column) => column.getCanHide());
  const areAllHideableColumnsVisible = hideableColumns.every((column) =>
    column.getIsVisible(),
  );
  const areSomeHideableColumnsVisible = hideableColumns.some((column) =>
    column.getIsVisible(),
  );
  const shouldShowColumnVisibilityToggle =
    showColumnVisibilityToggle && hideableColumns.length > 0;
  const shouldShowToolbar = Boolean(filterColumnId) || shouldShowColumnVisibilityToggle;

  return (
    <div className="grid gap-4">
      {shouldShowToolbar ? (
        <div className="flex flex-wrap items-center gap-3">
          {filterColumnId ? (
            <Input
              aria-label={filterLabel}
              className="max-w-sm"
              onChange={(event) =>
                table.getColumn(filterColumnId)?.setFilterValue(event.target.value)
              }
              placeholder={filterPlaceholder}
              type="text"
              value={String(table.getColumn(filterColumnId)?.getFilterValue() ?? "")}
            />
          ) : null}

          {shouldShowColumnVisibilityToggle ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label={columnVisibilityButtonLabel}
                  className="ml-auto"
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {columnVisibilityButtonLabel}
                  <ChevronDown aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{columnVisibilityMenuLabel}</DropdownMenuLabel>
                <DropdownMenuItem
                  disabled={areAllHideableColumnsVisible}
                  onSelect={(event) => {
                    event.preventDefault();
                    hideableColumns.forEach((column) => {
                      column.toggleVisibility(true);
                    });
                  }}
                >
                  {selectAllColumnsLabel}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!areSomeHideableColumnsVisible}
                  onSelect={(event) => {
                    event.preventDefault();
                    hideableColumns.forEach((column) => {
                      column.toggleVisibility(false);
                    });
                  }}
                >
                  {deselectAllColumnsLabel}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {hideableColumns.map((column) => {
                  const columnMeta = column.columnDef.meta as
                    | { label?: string }
                    | undefined;
                  const label =
                    columnMeta?.label ??
                    (typeof column.columnDef.header === "string"
                      ? column.columnDef.header
                      : column.id);

                  return (
                    <DropdownMenuCheckboxItem
                      checked={column.getIsVisible()}
                      key={column.id}
                      onSelect={(event) => {
                        event.preventDefault();
                      }}
                      onCheckedChange={(nextVisible) => {
                        column.toggleVisibility(Boolean(nextVisible));
                      }}
                    >
                      {label}
                    </DropdownMenuCheckboxItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      ) : null}

      <div className="relative w-full overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  className="h-24 text-center"
                  colSpan={Math.max(table.getVisibleLeafColumns().length, 1)}
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
