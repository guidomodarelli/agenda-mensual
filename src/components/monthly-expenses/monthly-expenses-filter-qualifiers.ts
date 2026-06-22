import {
  normalizeFilterSlug,
  UNASSIGNED_FOLDER_FILTER_VALUE,
  type FilterQualifierConfig,
  type FilterQualifierOption,
} from "@/components/ui/filter-query-grammar";

import type { ExpenseFolderOption } from "./expense-folder-picker";
import {
  LOAN_INSTALLMENT_RANGE_COLUMN_ID,
  LOAN_SORT_COLUMN_ID,
} from "./monthly-expenses-table-column-ids";

/**
 * Catálogo completo de qualifiers de la barra unificada estilo GitHub para la
 * tabla de gastos. Cada qualifier define la clave que el usuario tipea, su kind
 * y, cuando aplica, la columna TanStack que también lo filtra (path clásico).
 *
 * Los qualifiers SIN `columnId` (subtotal, link, enviados, cuotas, prestamista,
 * inicio, fin, carpeta) se filtran con el predicado de dominio
 * ({@link "./monthly-expenses-filter-predicate"}), desacoplado de las columnas.
 */

/** Etiqueta del qualifier de texto libre por defecto (descripción fuzzy). */
export const DESCRIPTION_QUALIFIER_LABEL = "Descripción";

/** Opciones de dirección de préstamo (slug tipeable → valor interno). */
const LOAN_DIRECTION_QUALIFIER_OPTIONS: FilterQualifierOption[] = [
  { label: "Yo debo", slug: "yo-debo", value: "payable" },
  { label: "Me deben", slug: "me-deben", value: "receivable" },
  { label: "Sin deuda/préstamo", slug: "sin-deuda", value: "none" },
];

/** Slug de la opción "sin carpeta asignada" dentro del qualifier de carpeta. */
export const UNASSIGNED_FOLDER_QUALIFIER_SLUG = "sin-carpeta";

function buildFolderQualifierOptions(
  expenseFolders: ExpenseFolderOption[],
): FilterQualifierOption[] {
  return [
    {
      label: "Sin carpeta",
      slug: UNASSIGNED_FOLDER_QUALIFIER_SLUG,
      value: UNASSIGNED_FOLDER_FILTER_VALUE,
    },
    ...expenseFolders.map((expenseFolder) => ({
      label: expenseFolder.name,
      slug: normalizeFilterSlug(expenseFolder.name),
      value: expenseFolder.id,
    })),
  ];
}

export interface BuildMonthlyExpensesFilterQualifiersOptions {
  expenseFolders: ExpenseFolderOption[];
}

/**
 * Construye los qualifiers de la barra para los gastos mensuales. Las opciones
 * de carpeta se derivan en runtime de las carpetas existentes.
 */
export function buildMonthlyExpensesFilterQualifiers({
  expenseFolders,
}: BuildMonthlyExpensesFilterQualifiersOptions): FilterQualifierConfig[] {
  return [
    { key: "", kind: "text", label: DESCRIPTION_QUALIFIER_LABEL },
    { key: "subtotal", kind: "numberRange", label: "Subtotal" },
    { columnId: "total", key: "total", kind: "numberRange", label: "Total" },
    { columnId: "usd", key: "usd", kind: "numberRange", label: "USD" },
    {
      columnId: "paymentsProgress",
      key: "pagos",
      kind: "numberRange",
      label: "Pagos",
    },
    {
      columnId: "paymentHistory",
      key: "registros",
      kind: "numberRange",
      label: "Registros",
    },
    { key: "enviados", kind: "numberRange", label: "Enviados (cantidad)" },
    { key: "enviado", kind: "presence", label: "Tiene enviados" },
    { key: "cuotas-pagadas", kind: "numberRange", label: "Cuotas pagadas" },
    { key: "cuotas-restantes", kind: "numberRange", label: "Cuotas restantes" },
    { key: "cuotas-total", kind: "numberRange", label: "Cuotas totales" },
    { key: "link", kind: "textMatch", label: "Link de pago" },
    { key: "prestamista", kind: "textMatch", label: "Prestamista" },
    {
      columnId: "lenderName",
      key: "direccion",
      kind: "enum",
      label: "Dirección",
      options: LOAN_DIRECTION_QUALIFIER_OPTIONS,
    },
    {
      columnId: LOAN_SORT_COLUMN_ID,
      key: "deuda",
      kind: "presence",
      label: "Deuda / cuotas",
    },
    { key: "inicio", kind: "yearMonthRange", label: "Inicio de cuota" },
    { key: "fin", kind: "yearMonthRange", label: "Fin de cuota" },
    {
      columnId: LOAN_INSTALLMENT_RANGE_COLUMN_ID,
      key: "vigencia",
      kind: "yearMonthRange",
      label: "Vigencia",
    },
    {
      key: "carpeta",
      kind: "folder",
      label: "Carpeta",
      options: buildFolderQualifierOptions(expenseFolders),
    },
  ];
}

/** Claves de qualifiers respaldadas por una columna TanStack (path clásico). */
export const COLUMN_BACKED_QUALIFIER_KEYS: ReadonlySet<string> = new Set([
  "total",
  "usd",
  "pagos",
  "registros",
  "direccion",
  "deuda",
  "vigencia",
]);
