"use client";

import * as React from "react";
import type {
  ColumnDef,
  ColumnFiltersState,
  OnChangeFn,
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
import { CircleAlert, ChevronDown, Ellipsis, Eraser, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FilterQueryBar } from "@/components/ui/filter-query-bar";
import {
  parseFilterQuery,
  serializeFilterQuery,
  type AppliedFilter,
  type FilterQualifierConfig,
} from "@/components/ui/filter-query-grammar";
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PresenceFilterValue = "hasValue" | "noValue";

/**
 * Modos de un filtro de rango de año-mes:
 * - `hasValue` / `noValue`: presencia (con fechas / sin fechas).
 * - `range`: acota por cota inferior y superior.
 * - `from`: solo cota inferior.
 * - `to`: solo cota superior.
 */
type YearMonthRangeFilterMode = "hasValue" | "noValue" | "range" | "from" | "to";

export type DataTableColumnFilterValue =
  | {
      kind: "numberRange";
      max?: number;
      min?: number;
    }
  | {
      kind: "enum";
      value: string;
    }
  | {
      kind: "presence";
      value: PresenceFilterValue;
    }
  | {
      kind: "yearMonthRange";
      mode: YearMonthRangeFilterMode;
      max?: number;
      min?: number;
    };

/**
 * Controles imperativos de la barra unificada que la tabla expone vía
 * `queryFilterControlsRef`, para que el consumidor sincronice la barra desde
 * fuera (p. ej. al clickear un chip de carpeta).
 */
export interface DataTableQueryFilterControls {
  /**
   * Reemplaza los filtros de carpeta de la barra: deja un único `carpeta:<id>`
   * (o ninguno si `folderId` es `null`), preservando el resto de los filtros.
   */
  setSingleFolderFilter: (folderId: string | null) => void;
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  emptyMessage: string;
  toolbarActions?: React.ReactNode;
  onVisibleRowsChange?: (visibleRows: TData[]) => void;
  onCellClick?: (
    event: React.MouseEvent<HTMLTableCellElement>,
    row: TData,
    columnId: string,
  ) => void;
  getRowClassName?: (row: TData) => string | undefined;
  sorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>;
  filterColumnId?: string;
  filterLabel?: string;
  filterPlaceholder?: string;
  filterExtraContent?: React.ReactNode;
  filterValue?: string;
  onFilterValueChange?: (value: string) => void;
  /**
   * Cuando se provee, agrega una barra de query unificada estilo GitHub
   * (autocompletado de `clave:valor`) por encima de los controles de filtro
   * clásicos. Ambas vistas comparten la misma fuente de verdad: la barra parsea
   * la query y escribe en los canales de descripción, exclusiones y avanzados,
   * y se re-sincroniza cuando esos controles clásicos cambian.
   */
  queryFilterConfig?: FilterQualifierConfig[];
  queryFilterPlaceholder?: string;
  queryFilterLabel?: string;
  /**
   * Notifica los filtros estructurados parseados desde la barra unificada
   * (cualquier kind, con o sin columna, incluyendo negados) para que el
   * consumidor los aplique con su propio predicado de dominio.
   */
  onAppliedFiltersChange?: (appliedFilters: AppliedFilter[]) => void;
  /** Ref para acceder a los controles imperativos de la barra unificada. */
  queryFilterControlsRef?: React.MutableRefObject<DataTableQueryFilterControls | null>;
  showExcludeFilterToggle?: boolean;
  excludeFilterValues?: string[];
  onExcludeFilterValuesChange?: (values: string[]) => void;
  excludeFilterPlaceholder?: string;
  excludeFilterLabel?: string;
  excludeFilterToggleLabel?: string;
  excludeFilterRowsCountByValue?: Record<string, number>;
  excludeFilterUniqueRowsCount?: number;
  showColumnVisibilityToggle?: boolean;
  columnVisibilityButtonLabel?: string;
  columnVisibilityMenuLabel?: string;
  sortingBadgeLabelOverrides?: Record<string, string>;
  selectAllColumnsLabel?: string;
  deselectAllColumnsLabel?: string;
  hideableColumnsDefaultVisibility?: VisibilityState;
}

interface DataTableColumnMeta {
  label?: string;
  cellClassName?: string;
  headerClassName?: string;
  isClickable?: boolean;
  onHeaderClick?: (event: React.MouseEvent<HTMLTableCellElement>) => void;
}

const DIACRITICS_PATTERN = /[\u0300-\u036f]/g;
const CLEAR_FILTER_ARIA_LABEL = "Limpiar filtro";
const ACTIVE_EXCLUSIONS_SR_LABEL = "Filtros de exclusión activos";
const HIDE_EXCLUDE_FILTERS_ARIA_LABEL = "Ocultar filtros de exclusión";
const EMPTY_EXCLUDE_FILTER_ERROR_MESSAGE = "Ingresá un texto para excluir.";
const DUPLICATE_EXCLUDE_FILTER_ERROR_MESSAGE = "Esa exclusión ya está activa.";
const EXCLUDED_ROWS_SUMMARY_LABEL = "Total excluidas";
const CLEAR_ALL_EXCLUSIONS_ARIA_LABEL = "Quitar todas las exclusiones";
const CLEAR_ALL_EXCLUSIONS_FROM_INPUT_ARIA_LABEL = "Limpiar filtros excluidos";
const REVERSE_FILTER_PENDING_MESSAGE =
  "Estás escribiendo una exclusión. Presioná Enter para aplicarla.";
const YEAR_MONTH_INPUT_PATTERN = /^(0[1-9]|1[0-2])\/(\d{4})$/;

/**
 * Parsea un texto `MM/AAAA` a su valor numérico comparable `AAAAMM`
 * (por ejemplo `06/2026` → `202606`). Devuelve `null` cuando el texto no es
 * un mes-año válido.
 */
export function parseYearMonthFilterInput(value: string): number | null {
  const match = YEAR_MONTH_INPUT_PATTERN.exec(value.trim());

  if (!match) {
    return null;
  }

  const [, month, year] = match;

  return Number(`${year}${month}`);
}

/**
 * Formatea un valor numérico `AAAAMM` de vuelta a `MM/AAAA` para rehidratar
 * los inputs del filtro al reabrir el diálogo.
 */
/**
 * Evalúa un filtro de rango de año-mes contra el valor numérico `AAAAMM` de una
 * fila (`null` cuando la fila no tiene fecha). Devuelve `true` cuando el filtro
 * no aplica, replicando el contrato de los demás matchers de la tabla.
 */
export function matchesAdvancedYearMonthRangeFilter(
  columnFilterValue: unknown,
  value: number | null,
): boolean {
  if (
    !columnFilterValue ||
    typeof columnFilterValue !== "object" ||
    (columnFilterValue as DataTableColumnFilterValue).kind !== "yearMonthRange"
  ) {
    return true;
  }

  const filterValue = columnFilterValue as Extract<
    DataTableColumnFilterValue,
    { kind: "yearMonthRange" }
  >;
  const hasValue = value != null && Number.isFinite(value);

  if (filterValue.mode === "hasValue") {
    return hasValue;
  }

  if (filterValue.mode === "noValue") {
    return !hasValue;
  }

  if (!hasValue) {
    return false;
  }

  if (filterValue.min != null && (value as number) < filterValue.min) {
    return false;
  }

  if (filterValue.max != null && (value as number) > filterValue.max) {
    return false;
  }

  return true;
}

function normalizeFilterToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(DIACRITICS_PATTERN, "")
    .toLocaleLowerCase()
    .trim();
}

function getTableFilterValue(
  filterValue: string,
  showExcludeFilterToggle: boolean,
): string {
  const normalizedFilterValue = filterValue.trimStart();

  if (showExcludeFilterToggle && normalizedFilterValue.startsWith("-")) {
    return "";
  }

  return filterValue;
}

function areColumnFiltersEqual(
  leftFilters: ColumnFiltersState,
  rightFilters: ColumnFiltersState,
): boolean {
  if (leftFilters.length !== rightFilters.length) {
    return false;
  }

  return leftFilters.every(
    (leftFilter, index) =>
      leftFilter.id === rightFilters[index]?.id &&
      leftFilter.value === rightFilters[index]?.value,
  );
}

function areStringArraysEqual(
  leftValues: readonly string[],
  rightValues: readonly string[],
): boolean {
  if (leftValues.length !== rightValues.length) {
    return false;
  }

  return leftValues.every((value, index) => value === rightValues[index]);
}

function areColumnFilterValuesEqual(
  leftValue: DataTableColumnFilterValue,
  rightValue: DataTableColumnFilterValue,
): boolean {
  if (leftValue.kind !== rightValue.kind) {
    return false;
  }

  if (leftValue.kind === "numberRange" && rightValue.kind === "numberRange") {
    return leftValue.min === rightValue.min && leftValue.max === rightValue.max;
  }

  if (leftValue.kind === "yearMonthRange" && rightValue.kind === "yearMonthRange") {
    return (
      leftValue.mode === rightValue.mode &&
      leftValue.min === rightValue.min &&
      leftValue.max === rightValue.max
    );
  }

  if (leftValue.kind === "enum" && rightValue.kind === "enum") {
    return leftValue.value === rightValue.value;
  }

  if (leftValue.kind === "presence" && rightValue.kind === "presence") {
    return leftValue.value === rightValue.value;
  }

  return false;
}

function areAdvancedFilterMapsEqual(
  leftMap: Record<string, DataTableColumnFilterValue>,
  rightMap: Record<string, DataTableColumnFilterValue>,
): boolean {
  const leftKeys = Object.keys(leftMap);
  const rightKeys = Object.keys(rightMap);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => {
    const rightValue = rightMap[key];

    return (
      rightValue != null && areColumnFilterValuesEqual(leftMap[key], rightValue)
    );
  });
}

export function DataTable<TData, TValue>({
  columns,
  data,
  emptyMessage,
  toolbarActions,
  onVisibleRowsChange,
  onCellClick,
  getRowClassName,
  sorting: controlledSorting,
  onSortingChange,
  columnVisibility: controlledColumnVisibility,
  onColumnVisibilityChange,
  filterColumnId,
  filterLabel = "Filtrar",
  filterPlaceholder = "Filtrar...",
  filterExtraContent,
  filterValue: controlledFilterValue,
  onFilterValueChange,
  queryFilterConfig,
  queryFilterPlaceholder,
  queryFilterLabel,
  onAppliedFiltersChange,
  queryFilterControlsRef,
  showExcludeFilterToggle = false,
  excludeFilterValues: controlledExcludeFilterValues,
  onExcludeFilterValuesChange,
  excludeFilterPlaceholder = "Excluir por descripción",
  excludeFilterLabel = "Filtro de exclusión",
  excludeFilterToggleLabel = "Mostrar filtros de exclusión",
  excludeFilterRowsCountByValue,
  excludeFilterUniqueRowsCount,
  showColumnVisibilityToggle = false,
  columnVisibilityButtonLabel = "Columnas",
  columnVisibilityMenuLabel = "Mostrar columnas",
  sortingBadgeLabelOverrides,
  selectAllColumnsLabel = "Mostrar todas",
  deselectAllColumnsLabel = "Ocultar todas",
  hideableColumnsDefaultVisibility,
}: DataTableProps<TData, TValue>) {
  const [uncontrolledSorting, setUncontrolledSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [uncontrolledFilterValue, setUncontrolledFilterValue] = React.useState("");
  const [filterQueryDraft, setFilterQueryDraft] = React.useState("");
  // Filtros estructurados de la última query parseada. Se preservan para que la
  // re-sincronización canónica (al perder foco) NO descarte los qualifiers sin
  // columna (textMatch/folder) ni los negados, que no viven en
  // `advancedFiltersAppliedByColumn` y quedarían como filtros activos invisibles.
  const [appliedFiltersDraft, setAppliedFiltersDraft] = React.useState<
    AppliedFilter[]
  >([]);
  const [isQueryFilterFocused, setIsQueryFilterFocused] = React.useState(false);
  const [uncontrolledExcludeFilterValues, setUncontrolledExcludeFilterValues] =
    React.useState<string[]>([]);
  const [excludeFilterInputValue, setExcludeFilterInputValue] = React.useState("");
  const [excludeFilterErrorMessage, setExcludeFilterErrorMessage] = React.useState<
    string | null
  >(null);
  const [isExcludeFilterInputVisible, setIsExcludeFilterInputVisible] =
    React.useState(false);
  const [uncontrolledColumnVisibility, setUncontrolledColumnVisibility] =
    React.useState<VisibilityState>({});
  const [advancedFiltersAppliedByColumn, setAdvancedFiltersAppliedByColumn] =
    React.useState<Record<string, DataTableColumnFilterValue>>({});
  const sorting = controlledSorting ?? uncontrolledSorting;
  const columnVisibility = controlledColumnVisibility ?? uncontrolledColumnVisibility;
  const shouldShowQueryFilter = queryFilterConfig != null;
  const isFilterValueControlled = controlledFilterValue != null;
  const isExcludeFilterValuesControlled = controlledExcludeFilterValues != null;
  const resolvedFilterValue = isFilterValueControlled
    ? controlledFilterValue
    : uncontrolledFilterValue;
  const resolvedExcludeFilterValues = isExcludeFilterValuesControlled
    ? controlledExcludeFilterValues
    : uncontrolledExcludeFilterValues;
  const hasActiveExcludeFilterValues = resolvedExcludeFilterValues.length > 0;
  const tableFilterValue = getTableFilterValue(
    resolvedFilterValue,
    showExcludeFilterToggle,
  );
  const hasPendingReverseFilter =
    showExcludeFilterToggle && resolvedFilterValue.trimStart().startsWith("-");
  const advancedFilterColumnIds = React.useMemo(() => {
    const columnIds = new Set<string>();

    for (const queryQualifier of queryFilterConfig ?? []) {
      if (queryQualifier.columnId) {
        columnIds.add(queryQualifier.columnId);
      }
    }

    return columnIds;
  }, [queryFilterConfig]);

  const handleExcludeFilterValuesChange = React.useCallback(
    (nextExcludeFilterValues: string[]) => {
      if (!isExcludeFilterValuesControlled) {
        setUncontrolledExcludeFilterValues(nextExcludeFilterValues);
      }

      onExcludeFilterValuesChange?.(nextExcludeFilterValues);
    },
    [isExcludeFilterValuesControlled, onExcludeFilterValuesChange],
  );

  // La barra de query es la fuente de verdad mientras se tipea: parsea el texto
  // y escribe en los mismos canales que usan los controles clásicos (descripción,
  // exclusiones y avanzados), de modo que ambas vistas queden sincronizadas.
  const handleQueryFilterChange = React.useCallback(
    (nextQuery: string) => {
      // Update urgente: mantiene el input y el dropdown de sugerencias
      // respondiendo de inmediato a cada tecla.
      setFilterQueryDraft(nextQuery);

      if (!queryFilterConfig) {
        return;
      }

      const parsedQuery = parseFilterQuery(nextQuery, queryFilterConfig);

      // El re-filtrado vuelve a renderizar toda la tabla (celdas con popovers,
      // tooltips y menús por fila), lo que bloquearía el commit del dropdown si
      // corriera urgente. Se difiere como transición de baja prioridad para que
      // el tipeo y las sugerencias no se cuelguen.
      React.startTransition(() => {
        // Cada canal se actualiza solo si cambió. Propagar valores iguales
        // (p. ej. una lista de exclusiones vacía nueva en cada tecla) dispararía
        // re-cálculos de memos y un re-render extra de todas las filas sin
        // ningún cambio observable.
        if (parsedQuery.descriptionFilter !== resolvedFilterValue) {
          if (!isFilterValueControlled) {
            setUncontrolledFilterValue(parsedQuery.descriptionFilter);
          }

          onFilterValueChange?.(parsedQuery.descriptionFilter);
        }

        if (
          !areStringArraysEqual(
            parsedQuery.excludedDescriptionFilters,
            resolvedExcludeFilterValues,
          )
        ) {
          handleExcludeFilterValuesChange(parsedQuery.excludedDescriptionFilters);
        }

        if (
          !areAdvancedFilterMapsEqual(
            parsedQuery.advancedFiltersByColumn,
            advancedFiltersAppliedByColumn,
          )
        ) {
          setAdvancedFiltersAppliedByColumn(parsedQuery.advancedFiltersByColumn);
        }

        setAppliedFiltersDraft(parsedQuery.appliedFilters);
        onAppliedFiltersChange?.(parsedQuery.appliedFilters);
      });
    },
    [
      advancedFiltersAppliedByColumn,
      handleExcludeFilterValuesChange,
      isFilterValueControlled,
      onAppliedFiltersChange,
      onFilterValueChange,
      queryFilterConfig,
      resolvedExcludeFilterValues,
      resolvedFilterValue,
    ],
  );

  // Forma canónica de los filtros activos, para reflejarlos en la barra de query.
  // Se serializa desde los filtros aplicados id-backed (no desde el texto de la
  // barra), de modo que un filtro de carpeta apunte siempre por `folderId`: si la
  // carpeta se renombra, su slug se re-deriva del nombre nuevo; si desaparece, el
  // filtro se descarta. Definida antes del efecto de reparse para que este pueda
  // re-propagar la forma id-backed cuando cambia la config.
  const canonicalQueryFromFilters = React.useMemo(() => {
    if (!queryFilterConfig) {
      return "";
    }

    return serializeFilterQuery(
      {
        advancedFiltersByColumn: advancedFiltersAppliedByColumn,
        appliedFilters: appliedFiltersDraft,
        descriptionFilter: tableFilterValue,
        excludedDescriptionFilters: resolvedExcludeFilterValues,
        invalidTokens: [],
      },
      queryFilterConfig,
    );
  }, [
    advancedFiltersAppliedByColumn,
    appliedFiltersDraft,
    queryFilterConfig,
    resolvedExcludeFilterValues,
    tableFilterValue,
  ]);

  // Firma estructural de la config de qualifiers: dispara la reconciliación solo
  // cuando su CONTENIDO cambia (no en cada render con una referencia de array
  // nueva), evitando re-propagar la forma canónica mientras el usuario tipea.
  const queryFilterConfigSignature = React.useMemo(
    () => (queryFilterConfig ? JSON.stringify(queryFilterConfig) : ""),
    [queryFilterConfig],
  );
  const previousQueryFilterConfigSignatureRef = React.useRef<string | null>(null);

  // Si la config de qualifiers cambia (p. ej. se renombra una carpeta y su opción
  // pasa de `carpeta:hogar` a `carpeta:casa`, o se borra y desaparece), se
  // re-propaga la forma canónica id-backed contra la NUEVA config en vez de
  // re-parsear el texto con el slug viejo. Así un filtro de carpeta seleccionado
  // sobrevive a renames y colisiones de slug (se vuelve a serializar por
  // `folderId`), mientras que un filtro realmente huérfano (cuyo `folderId` ya no
  // existe) se descarta del predicado en vez de seguir filtrando de forma
  // invisible.
  React.useEffect(() => {
    const previousSignature = previousQueryFilterConfigSignatureRef.current;
    previousQueryFilterConfigSignatureRef.current = queryFilterConfigSignature;

    // Primer render o config sin contenido: nada que reconciliar todavía.
    if (previousSignature === null) {
      return;
    }

    if (
      !queryFilterConfig ||
      !filterQueryDraft ||
      previousSignature === queryFilterConfigSignature
    ) {
      return;
    }

    handleQueryFilterChange(canonicalQueryFromFilters);
    // Solo debe re-correr cuando cambia el contenido de la config; el resto de los
    // valores se leen como estado actual y no como disparadores para no re-parsear
    // en cada tecla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryFilterConfigSignature]);

  // Reemplaza los filtros de carpeta de la barra por un único `carpeta:<id>` (o
  // ninguno si `folderId` es `null`), preservando el resto. Lo usa el consumidor
  // al clickear un chip de carpeta, para que la barra sea la única fuente de
  // verdad y no queden filtros de carpeta inconsistentes.
  const setSingleFolderFilter = React.useCallback(
    (folderId: string | null) => {
      if (!queryFilterConfig) {
        return;
      }

      const folderQualifierKey = queryFilterConfig.find(
        (config) => config.kind === "folder",
      )?.key;

      if (!folderQualifierKey) {
        return;
      }

      const parsedQuery = parseFilterQuery(filterQueryDraft, queryFilterConfig);
      // Limpia TODO filtro que apunte a la key de carpeta —tanto `carpeta:<id>`
      // (kind "folder") como la presencia `tiene:carpeta`/`no:carpeta`—, para que
      // el chip sea la única fuente de verdad y no queden filtros contradictorios
      // (p. ej. `no:carpeta` + `carpeta:hogar`, que oculta todas las filas).
      const nonFolderFilters = parsedQuery.appliedFilters.filter(
        (appliedFilter) =>
          appliedFilter.value.kind !== "folder" &&
          appliedFilter.key !== folderQualifierKey,
      );
      const nextAppliedFilters =
        folderId == null
          ? nonFolderFilters
          : [
              ...nonFolderFilters,
              {
                key: folderQualifierKey,
                negated: false,
                value: { folderId, kind: "folder" as const },
              },
            ];

      handleQueryFilterChange(
        serializeFilterQuery(
          { ...parsedQuery, appliedFilters: nextAppliedFilters },
          queryFilterConfig,
        ),
      );
    },
    [filterQueryDraft, handleQueryFilterChange, queryFilterConfig],
  );

  React.useEffect(() => {
    if (!queryFilterControlsRef) {
      return;
    }

    queryFilterControlsRef.current = { setSingleFolderFilter };

    return () => {
      queryFilterControlsRef.current = null;
    };
  }, [queryFilterControlsRef, setSingleFolderFilter]);

  const addExcludeFilterValue = React.useCallback(
    (
      rawExcludeFilterValue: string,
      options: { clearExcludeInputValue?: boolean } = {},
    ): boolean => {
      const normalizedCandidate = normalizeFilterToken(rawExcludeFilterValue);

      if (!normalizedCandidate) {
        setExcludeFilterErrorMessage(EMPTY_EXCLUDE_FILTER_ERROR_MESSAGE);
        return false;
      }

      const hasDuplicateExcludeFilter = resolvedExcludeFilterValues.some(
        (excludeFilterValue) =>
          normalizeFilterToken(excludeFilterValue) === normalizedCandidate,
      );

      if (hasDuplicateExcludeFilter) {
        setExcludeFilterErrorMessage(DUPLICATE_EXCLUDE_FILTER_ERROR_MESSAGE);
        return false;
      }

      handleExcludeFilterValuesChange([
        ...resolvedExcludeFilterValues,
        rawExcludeFilterValue.trim(),
      ]);

      if (options.clearExcludeInputValue ?? true) {
        setExcludeFilterInputValue("");
      }

      setExcludeFilterErrorMessage(null);
      return true;
    },
    [handleExcludeFilterValuesChange, resolvedExcludeFilterValues],
  );

  const removeExcludeFilterValue = React.useCallback(
    (excludeFilterValueToRemove: string) => {
      handleExcludeFilterValuesChange(
        resolvedExcludeFilterValues.filter(
          (excludeFilterValue) => excludeFilterValue !== excludeFilterValueToRemove,
        ),
      );
    },
    [handleExcludeFilterValuesChange, resolvedExcludeFilterValues],
  );

  const handleClearAllExcludeFilters = React.useCallback(() => {
    handleExcludeFilterValuesChange([]);
    setExcludeFilterInputValue("");
    setExcludeFilterErrorMessage(null);
  }, [handleExcludeFilterValuesChange]);

  const handleSortingChange = React.useCallback(
    (updater: SortingState | ((previousState: SortingState) => SortingState)) => {
      const nextSorting =
        typeof updater === "function" ? updater(sorting) : updater;

      if (controlledSorting == null) {
        setUncontrolledSorting(nextSorting);
      }

      onSortingChange?.(nextSorting);
    },
    [controlledSorting, onSortingChange, sorting],
  );

  const handleColumnVisibilityChange = React.useCallback(
    (
      updater:
        | VisibilityState
        | ((previousState: VisibilityState) => VisibilityState),
    ) => {
      if (controlledColumnVisibility == null) {
        setUncontrolledColumnVisibility(updater);
      }

      onColumnVisibilityChange?.(updater);
    },
    [controlledColumnVisibility, onColumnVisibilityChange],
  );

  // TanStack Table manages internal reactive state through this hook.
  const table = useReactTable({
    columns,
    data,
    // La tabla no pagina (no hay `getPaginationRowModel`). Con el auto-reset por
    // defecto, cada cambio de filtro dispara `resetPageIndex` → `setPagination`,
    // que vuelve a renderizar y re-dispara el reset en bucle: "Maximum update
    // depth exceeded" y la página colgada al tipear. Se desactivan los
    // auto-resets porque no hay estado de paginado/expansión que reiniciar.
    autoResetPageIndex: false,
    autoResetExpanded: false,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: handleSortingChange,
    onColumnVisibilityChange: handleColumnVisibilityChange,
    state: {
      columnFilters,
      columnVisibility,
      sorting,
    },
  });
  const hideableColumns = table
    .getAllLeafColumns()
    .filter((column) => column.getCanHide());
  const getHideableColumnDefaultVisibility = React.useCallback(
    (columnId: string): boolean =>
      hideableColumnsDefaultVisibility?.[columnId] ?? true,
    [hideableColumnsDefaultVisibility],
  );
  const areHideableColumnsAtDefaultVisibility = hideableColumns.every(
    (column) =>
      column.getIsVisible() === getHideableColumnDefaultVisibility(column.id),
  );
  const areSomeHideableColumnsVisible = hideableColumns.some((column) =>
    column.getIsVisible(),
  );
  const shouldShowColumnVisibilityToggle =
    showColumnVisibilityToggle && hideableColumns.length > 0;
  const hasModifiedColumnVisibility =
    shouldShowColumnVisibilityToggle && !areHideableColumnsAtDefaultVisibility;
  const hasToolbarChanges = hasModifiedColumnVisibility;
  const shouldShowToolbarActions =
    shouldShowColumnVisibilityToggle || toolbarActions != null;
  const shouldShowToolbar =
    shouldShowQueryFilter ||
    Boolean(filterColumnId) ||
    shouldShowToolbarActions;
  const filterColumn = filterColumnId ? table.getColumn(filterColumnId) : undefined;
  const activeSortingEntry = sorting[0];
  const activeSortingColumn = activeSortingEntry
    ? table.getColumn(activeSortingEntry.id)
    : undefined;
  const activeSortingColumnMeta = activeSortingColumn?.columnDef.meta as
    | DataTableColumnMeta
    | undefined;
  const activeSortingColumnLabel =
    (activeSortingEntry
      ? sortingBadgeLabelOverrides?.[activeSortingEntry.id]
      : undefined) ??
    activeSortingColumnMeta?.label ??
    (typeof activeSortingColumn?.columnDef.header === "string"
      ? activeSortingColumn.columnDef.header
      : activeSortingEntry?.id);
  const shouldShowSortingBadge =
    activeSortingEntry != null && activeSortingColumnLabel != null;
  const activeSortingDirectionSymbol = activeSortingEntry?.desc ? "↓" : "↑";
  const activeSortingDirectionLabel = activeSortingEntry?.desc
    ? "descendente"
    : "ascendente";
  const footerGroups = table.getFooterGroups();
  const hasFooterContent = footerGroups.some((footerGroup) =>
    footerGroup.headers.some(
      (footer) => !footer.isPlaceholder && footer.column.columnDef.footer != null,
    ),
  );

  const handleResetSorting = React.useCallback(() => {
    handleSortingChange([]);
  }, [handleSortingChange]);

  const handleClearMainFilter = React.useCallback(() => {
    if (!isFilterValueControlled) {
      setUncontrolledFilterValue("");
    }

    onFilterValueChange?.("");
    filterColumn?.setFilterValue("");
  }, [filterColumn, isFilterValueControlled, onFilterValueChange]);

  React.useEffect(() => {
    if (!filterColumn) {
      return;
    }

    const currentFilterValue = String(filterColumn.getFilterValue() ?? "");

    if (currentFilterValue === tableFilterValue) {
      return;
    }

    filterColumn.setFilterValue(tableFilterValue);
  }, [filterColumn, tableFilterValue]);

  // Mientras la barra está enfocada, el usuario es la fuente de verdad y no se
  // pisa su texto; al perder el foco (o al editar los controles clásicos) la
  // barra se re-sincroniza con la forma canónica de los filtros activos.
  React.useEffect(() => {
    if (!queryFilterConfig || isQueryFilterFocused) {
      return;
    }

    setFilterQueryDraft((previousDraft) =>
      previousDraft === canonicalQueryFromFilters
        ? previousDraft
        : canonicalQueryFromFilters,
    );
  }, [canonicalQueryFromFilters, isQueryFilterFocused, queryFilterConfig]);

  React.useEffect(() => {
    if (
      advancedFilterColumnIds.size === 0 &&
      Object.keys(advancedFiltersAppliedByColumn).length === 0
    ) {
      return;
    }

    setColumnFilters((previousColumnFilters) => {
      const nextColumnFilters = previousColumnFilters.filter(
        (columnFilter) => !advancedFilterColumnIds.has(columnFilter.id),
      );

      for (const [columnId, filterValue] of Object.entries(
        advancedFiltersAppliedByColumn,
      )) {
        nextColumnFilters.push({
          id: columnId,
          value: filterValue,
        });
      }

      if (areColumnFiltersEqual(previousColumnFilters, nextColumnFilters)) {
        return previousColumnFilters;
      }

      return nextColumnFilters;
    });
  }, [advancedFilterColumnIds, advancedFiltersAppliedByColumn]);

  React.useEffect(() => {
    onVisibleRowsChange?.(table.getRowModel().rows.map((row) => row.original));
  }, [
    columnFilters,
    columnVisibility,
    data,
    onVisibleRowsChange,
    sorting,
    table,
  ]);

  const sortingBadgeNode = shouldShowSortingBadge ? (
    <Badge
      aria-live="polite"
      className="inline-flex w-fit items-center gap-1.5"
      variant="secondary"
    >
      <span>
        {`Ordenado por: ${activeSortingColumnLabel} ${activeSortingDirectionSymbol}`}
      </span>
      <span className="sr-only">{`Orden ${activeSortingDirectionLabel}`}</span>
      <button
        aria-label="Quitar orden"
        className="inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={handleResetSorting}
        type="button"
      >
        <X aria-hidden="true" className="size-3" />
      </button>
    </Badge>
  ) : null;
  const filterExtraContentNode = filterExtraContent ? (
    <div className="grid gap-1">{filterExtraContent}</div>
  ) : null;

  const tableRowModelRows = table.getRowModel().rows;
  const visibleLeafColumnsCount = table.getVisibleLeafColumns().length;
  // El cuerpo de la tabla es la parte más cara de renderizar (cientos de celdas
  // con popovers, tooltips y menús). Se memoiza para que los cambios de estado
  // locales del toolbar —el draft de la barra de query, el foco, los inputs de
  // filtros— no vuelvan a renderizar todas las filas. Solo se recalcula cuando
  // cambia el row model (datos/filtros/orden), la visibilidad de columnas o los
  // callbacks de fila. Sin esto, cada tecla disparaba varios re-render completos
  // del cuerpo y colgaba la página. Se sigue el patrón de memoización de
  // TanStack: no se depende de la identidad de `table`, que cambia en cada render.
  const tableBodyRows = React.useMemo(() => {
    return tableRowModelRows.map((row) => {
      const rowClassName = getRowClassName?.(row.original);

      return (
        <TableRow className={rowClassName} key={row.id}>
          {row.getVisibleCells().map((cell) => {
            const columnMeta = cell.column.columnDef.meta as
              | DataTableColumnMeta
              | undefined;
            const handleCellClick =
              onCellClick && columnMeta?.isClickable
                ? (event: React.MouseEvent<HTMLTableCellElement>) => {
                    onCellClick(event, row.original, cell.column.id);
                  }
                : undefined;

            return (
              <TableCell
                className={columnMeta?.cellClassName}
                data-label={columnMeta?.label}
                key={cell.id}
                onClick={handleCellClick}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            );
          })}
        </TableRow>
      );
    });
    // `columnVisibility` se incluye a propósito: alterna qué celdas devuelve
    // `row.getVisibleCells()` sin cambiar la referencia de `tableRowModelRows`,
    // por lo que es necesaria para invalidar la memo al mostrar/ocultar columnas
    // aunque el linter no la vea referenciada léxicamente.
    // `emptyMessage` se mantiene FUERA de esta memo a propósito: cambia al pasar
    // de "sin filtro" a "con filtro" y, si estuviera acá, invalidaría la memo y
    // re-renderizaría todas las filas en la primera tecla aunque no cambien.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnVisibility, getRowClassName, onCellClick, tableRowModelRows]);

  const tableBodyContent = tableBodyRows.length ? (
    tableBodyRows
  ) : (
    <TableRow>
      <TableCell
        className="h-24 text-center"
        colSpan={Math.max(visibleLeafColumnsCount, 1)}
      >
        {emptyMessage}
      </TableCell>
    </TableRow>
  );

  return (
    <div className="grid gap-4">
      {shouldShowToolbar ? (
        <div className="grid gap-2">
          {shouldShowQueryFilter ? (
            <FilterQueryBar
              ariaLabel={queryFilterLabel}
              configs={queryFilterConfig}
              onFocusChange={setIsQueryFilterFocused}
              onValueChange={handleQueryFilterChange}
              placeholder={queryFilterPlaceholder}
              value={filterQueryDraft}
            />
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            {filterColumnId ? (
              <div className="grid w-full max-w-sm gap-2">
                {/* La barra unificada reemplaza estos inputs: solo se renderizan
                    los de descripción/exclusión cuando NO hay barra de query. */}
                {!shouldShowQueryFilter ? (
                  <>
                <div className="relative w-full">
                  <Input
                    aria-label={filterLabel}
                    className={`w-full pr-16 ${
                      hasPendingReverseFilter ? "text-red-400" : ""
                    }`}
                    onChange={(event) => {
                      const nextFilterValue = event.target.value;

                      if (!isFilterValueControlled) {
                        setUncontrolledFilterValue(nextFilterValue);
                      }

                      onFilterValueChange?.(nextFilterValue);
                      filterColumn?.setFilterValue(
                        getTableFilterValue(nextFilterValue, showExcludeFilterToggle),
                      );
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") {
                        return;
                      }

                      const trimmedResolvedFilterValue = resolvedFilterValue.trimStart();

                      if (
                        !showExcludeFilterToggle ||
                        !trimmedResolvedFilterValue.startsWith("-")
                      ) {
                        return;
                      }

                      event.preventDefault();

                      const excludeFilterCandidate =
                        trimmedResolvedFilterValue.slice(1);
                      const wasExcludeFilterAdded = addExcludeFilterValue(
                        excludeFilterCandidate,
                        {
                          clearExcludeInputValue: false,
                        },
                      );

                      if (wasExcludeFilterAdded) {
                        handleClearMainFilter();
                      }
                    }}
                    placeholder={filterPlaceholder}
                    type="text"
                    value={resolvedFilterValue}
                  />
                  <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
                    {resolvedFilterValue ? (
                      <Button
                        aria-label={CLEAR_FILTER_ARIA_LABEL}
                        className="active:-translate-y-0"
                        onClick={handleClearMainFilter}
                        size="icon-xs"
                        type="button"
                        variant="ghost"
                      >
                        <X aria-hidden="true" />
                      </Button>
                    ) : null}
                    {showExcludeFilterToggle ? (
                      <Button
                        aria-expanded={isExcludeFilterInputVisible}
                        aria-label={
                          isExcludeFilterInputVisible
                            ? HIDE_EXCLUDE_FILTERS_ARIA_LABEL
                            : excludeFilterToggleLabel
                        }
                        className="relative"
                        onClick={() => {
                          setIsExcludeFilterInputVisible((previousState) => {
                            const nextState = !previousState;

                            if (!nextState) {
                              setExcludeFilterInputValue("");
                              setExcludeFilterErrorMessage(null);
                            }

                            return nextState;
                          });
                        }}
                        size="icon-xs"
                        type="button"
                        variant="ghost"
                      >
                        <Ellipsis aria-hidden="true" />
                        {hasActiveExcludeFilterValues ? (
                          <>
                            <span
                              aria-hidden="true"
                              className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-destructive ring-2 ring-background"
                            />
                            <span className="sr-only">{ACTIVE_EXCLUSIONS_SR_LABEL}</span>
                          </>
                        ) : null}
                      </Button>
                    ) : null}
                  </div>
                </div>
                {showExcludeFilterToggle && isExcludeFilterInputVisible ? (
                  <div className="grid gap-1">
                    <div className="flex items-center gap-1">
                      <Input
                        aria-invalid={excludeFilterErrorMessage != null}
                        aria-label={excludeFilterLabel}
                        onChange={(event) => {
                          setExcludeFilterInputValue(event.target.value);

                          if (excludeFilterErrorMessage != null) {
                            setExcludeFilterErrorMessage(null);
                          }
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") {
                            return;
                          }

                          event.preventDefault();
                          addExcludeFilterValue(excludeFilterInputValue);
                        }}
                        placeholder={excludeFilterPlaceholder}
                        type="text"
                        value={excludeFilterInputValue}
                      />
                      <Button
                        aria-label={CLEAR_ALL_EXCLUSIONS_FROM_INPUT_ARIA_LABEL}
                        className="shrink-0"
                        disabled={!hasActiveExcludeFilterValues}
                        onClick={handleClearAllExcludeFilters}
                        size="icon-xs"
                        type="button"
                        variant="ghost"
                      >
                        <Eraser aria-hidden="true" />
                      </Button>
                    </div>
                    {excludeFilterErrorMessage ? (
                      <p aria-live="polite" className="text-sm text-destructive">
                        {excludeFilterErrorMessage}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {hasPendingReverseFilter ? (
                  <div
                    aria-live="polite"
                    className="rounded-md border border-border/80 bg-muted/40 px-3 py-2 text-muted-foreground"
                    role="status"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
                      <CircleAlert aria-hidden="true" className="size-4" />
                      <span>Exclusión pendiente</span>
                    </div>
                    <p className="mt-1 text-xs">
                      {REVERSE_FILTER_PENDING_MESSAGE}
                    </p>
                  </div>
                ) : null}
                  </>
                ) : null}
                {showExcludeFilterToggle && resolvedExcludeFilterValues.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {excludeFilterUniqueRowsCount != null ? (
                      <Badge
                        aria-label={`Total de filas excluidas únicas: ${excludeFilterUniqueRowsCount}`}
                        className="inline-flex h-6 items-center gap-1.5 px-2.5"
                        variant="destructive"
                      >
                        <span>{`${EXCLUDED_ROWS_SUMMARY_LABEL}:`}</span>
                        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-destructive/20 px-1.5 text-[10px] leading-4 font-semibold">
                          {excludeFilterUniqueRowsCount}
                        </span>
                        <button
                          aria-label={CLEAR_ALL_EXCLUSIONS_ARIA_LABEL}
                          className="inline-flex size-4 items-center justify-center rounded-sm text-destructive transition-colors hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
                          onClick={handleClearAllExcludeFilters}
                          type="button"
                        >
                          <X aria-hidden="true" className="size-3" />
                        </button>
                      </Badge>
                    ) : null}
                    {resolvedExcludeFilterValues.map((excludeFilterValue) => {
                      const excludedRowsCount =
                        excludeFilterRowsCountByValue?.[excludeFilterValue];

                      return (
                      <Badge
                        className="inline-flex h-6 items-center gap-1.5 px-2.5"
                        key={excludeFilterValue}
                        variant="destructive"
                      >
                        <span>{`− ${excludeFilterValue}`}</span>
                        {excludedRowsCount != null ? (
                          <span
                            aria-label={`Filas excluidas por ${excludeFilterValue}: ${excludedRowsCount}`}
                            className="inline-flex min-w-5 items-center justify-center rounded-full bg-destructive/20 px-1.5 text-[10px] leading-4 font-semibold"
                          >
                            {excludedRowsCount}
                          </span>
                        ) : null}
                        <button
                          aria-label={`Quitar exclusión ${excludeFilterValue}`}
                          className="inline-flex size-4 items-center justify-center rounded-sm text-destructive transition-colors hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
                          onClick={() => removeExcludeFilterValue(excludeFilterValue)}
                          type="button"
                        >
                          <X aria-hidden="true" className="size-3" />
                        </button>
                      </Badge>
                      );
                    })}
                  </div>
                ) : null}
                {sortingBadgeNode}
                {filterExtraContentNode}
              </div>
            ) : null}

            {shouldShowToolbarActions ? (
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {toolbarActions}
                {shouldShowColumnVisibilityToggle ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        aria-label={columnVisibilityButtonLabel}
                        className="relative"
                        type="button"
                        variant="outline"
                      >
                        {columnVisibilityButtonLabel}
                        <ChevronDown aria-hidden="true" />
                        {hasToolbarChanges ? (
                          <>
                            <span
                              aria-hidden="true"
                              className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-destructive ring-2 ring-background"
                            />
                            <span className="sr-only">Columnas modificadas</span>
                          </>
                        ) : null}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>{columnVisibilityMenuLabel}</DropdownMenuLabel>
                      <DropdownMenuItem
                        disabled={areHideableColumnsAtDefaultVisibility}
                        onSelect={(event) => {
                          event.preventDefault();
                          hideableColumns.forEach((column) => {
                            column.toggleVisibility(
                              getHideableColumnDefaultVisibility(column.id),
                            );
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
                          | DataTableColumnMeta
                          | undefined;
                        const isColumnVisible = column.getIsVisible();
                        const label =
                          columnMeta?.label ??
                          (typeof column.columnDef.header === "string"
                            ? column.columnDef.header
                            : column.id);

                        return (
                          <DropdownMenuCheckboxItem
                            checked={isColumnVisible}
                            key={column.id}
                            onSelect={(event) => {
                              event.preventDefault();
                            }}
                            onCheckedChange={(nextVisible) => {
                              column.toggleVisibility(Boolean(nextVisible));
                            }}
                          >
                            {label}
                            {!isColumnVisible ? (
                              <>
                                <span
                                  aria-hidden="true"
                                  className="absolute right-2 top-1.5 size-2 rounded-full bg-destructive ring-2 ring-background"
                                />
                                <span className="sr-only">Columna deseleccionada</span>
                              </>
                            ) : null}
                          </DropdownMenuCheckboxItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="relative w-full overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const columnMeta = header.column.columnDef.meta as
                    | DataTableColumnMeta
                    | undefined;

                  return (
                    <TableHead
                      className={columnMeta?.headerClassName}
                      key={header.id}
                      onClick={columnMeta?.onHeaderClick}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>{tableBodyContent}</TableBody>

          {hasFooterContent ? (
            <TableFooter>
              {footerGroups.map((footerGroup) => (
                <TableRow className="hover:bg-transparent" key={footerGroup.id}>
                  {footerGroup.headers.map((footer) => (
                    <TableCell
                      data-label={
                        (
                          footer.column.columnDef.meta as
                            | DataTableColumnMeta
                            | undefined
                        )?.label
                      }
                      key={footer.id}
                    >
                      {footer.isPlaceholder
                        ? null
                        : flexRender(
                            footer.column.columnDef.footer,
                            footer.getContext(),
                          )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableFooter>
          ) : null}
        </Table>
      </div>

    </div>
  );
}
