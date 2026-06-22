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

/**
 * Convierte el nombre de una carpeta en un slug tipeable de un solo token. Más
 * allá de quitar acentos/mayúsculas, reemplaza los separadores de token del
 * tokenizer (espacios y `:`) por guiones: sin esto, un nombre como
 * "Tarjeta Visa" produciría el slug `tarjeta visa`, que `carpeta:tarjeta visa`
 * parsearía como `carpeta:tarjeta` + texto libre `visa` (filtro inválido).
 */
export function slugifyFolderName(name: string): string {
  return normalizeFilterSlug(name)
    .replace(/[\s:]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Slug base de una carpeta (no vacío). */
function getFolderBaseSlug(name: string): string {
  return slugifyFolderName(name) || "carpeta";
}

/**
 * Desambigua el slug de una carpeta de forma ESTABLE por id. Cuando varias
 * carpetas comparten el slug base (p. ej. `Hogar` y `Hógar`), o cuando el base
 * colisiona con el slug reservado de "sin carpeta", se sufija con el id de la
 * carpeta. Es deterministico por id (no por orden): reordenar las carpetas no
 * cambia a qué carpeta resuelve un `carpeta:<slug>` ya tipeado.
 */
function buildFolderQualifierOptions(
  expenseFolders: ExpenseFolderOption[],
): FilterQualifierOption[] {
  const baseSlugCounts = new Map<string, number>();

  for (const expenseFolder of expenseFolders) {
    const base = getFolderBaseSlug(expenseFolder.name);
    baseSlugCounts.set(base, (baseSlugCounts.get(base) ?? 0) + 1);
  }

  // Pass de unicidad FINAL: el slug por id puede chocar con el base de otra
  // carpeta (p. ej. `hogar-01abc` vs una carpeta llamada "Hogar 01abc"). Si el
  // slug ya está usado, se sufija con un contador como último recurso para
  // garantizar que `parseFolderValue` resuelva cada carpeta sin ambigüedad.
  const usedSlugs = new Set<string>([UNASSIGNED_FOLDER_QUALIFIER_SLUG]);

  const ensureUniqueSlug = (candidate: string): string => {
    if (!usedSlugs.has(candidate)) {
      usedSlugs.add(candidate);
      return candidate;
    }

    let suffix = 2;

    while (usedSlugs.has(`${candidate}-${suffix}`)) {
      suffix += 1;
    }

    const unique = `${candidate}-${suffix}`;
    usedSlugs.add(unique);
    return unique;
  };

  return [
    {
      label: "Sin carpeta",
      slug: UNASSIGNED_FOLDER_QUALIFIER_SLUG,
      value: UNASSIGNED_FOLDER_FILTER_VALUE,
    },
    ...expenseFolders.map((expenseFolder) => {
      const base = getFolderBaseSlug(expenseFolder.name);
      const collides =
        (baseSlugCounts.get(base) ?? 0) > 1 ||
        base === UNASSIGNED_FOLDER_QUALIFIER_SLUG;
      const candidate = collides
        ? `${base}-${slugifyFolderName(expenseFolder.id) || expenseFolder.id}`
        : base;

      return {
        label: expenseFolder.name,
        slug: ensureUniqueSlug(candidate),
        value: expenseFolder.id,
      };
    }),
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
