import {
  normalizeFilterSlug,
  UNASSIGNED_FOLDER_FILTER_VALUE,
  type FilterQualifierConfig,
  type FilterQualifierOption,
} from "@/components/ui/filter-query-grammar";

import type { ExpenseFolderOption } from "./expense-folder-picker";
import type { LenderOption } from "./lender-picker";
import { LOAN_SORT_COLUMN_ID } from "./monthly-expenses-table-column-ids";

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
// "Sin deuda/préstamo" se omite a propósito: equivale a `no:direccion` (ausencia
// de préstamo), así que se filtra con la meta-clave de ausencia, no como enum.
const LOAN_DIRECTION_QUALIFIER_OPTIONS: FilterQualifierOption[] = [
  { label: "Yo debo", slug: "yo-debo", value: "payable" },
  { label: "Me deben", slug: "me-deben", value: "receivable" },
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

/**
 * Convierte el nombre de un prestamista en un slug tipeable de un solo token.
 * Extiende {@link slugifyFolderName} eliminando también las comillas simples y
 * dobles: sin esto, un nombre como `O'Connor` produce el slug `o'connor`, que el
 * tokenizer interpreta como inicio de un segmento entrecomillado y consume el
 * resto de la query cuando hay tokens adicionales después.
 */
export function slugifyLenderName(name: string): string {
  return slugifyFolderName(name.replace(/['"]/g, ""));
}

/**
 * Construye opciones (`slug` tipeable → id) para entidades con nombre,
 * desambiguando los slugs de forma ESTABLE por id: cuando varias entidades
 * comparten el slug base, o este colisiona con un slug reservado, se sufija con
 * el id de la entidad. Una pass final garantiza unicidad. Es determinístico por
 * id (no por orden): reordenar las entidades no cambia a qué id resuelve un
 * `<slug>` ya tipeado.
 *
 * La unicidad final se resuelve en dos pasos separados para evitar dependencia
 * del orden de iteración:
 *  1. Se computan los candidatos de TODAS las entidades y se ordenan por
 *     `(candidate, id)` antes de asignar slugs finales.
 *  2. Se aplica `ensureUniqueSlug` sobre el orden determinista, de modo que
 *     cuando dos candidatos colisionan entre sí el que tiene el id
 *     lexicográficamente menor siempre gana el slug sin sufijo numérico.
 */
function buildUniqueSlugOptions(
  entities: ReadonlyArray<{ id: string; name: string }>,
  {
    fallbackSlug,
    reservedSlugs = [],
    slugify = slugifyFolderName,
  }: {
    fallbackSlug: string;
    reservedSlugs?: string[];
    slugify?: (name: string) => string;
  },
): FilterQualifierOption[] {
  const toBaseSlug = (name: string): string => slugify(name) || fallbackSlug;
  const baseSlugCounts = new Map<string, number>();

  for (const entity of entities) {
    const base = toBaseSlug(entity.name);
    baseSlugCounts.set(base, (baseSlugCounts.get(base) ?? 0) + 1);
  }

  // Paso 1: calcular el candidato crudo de cada entidad (sin llamar a
  // ensureUniqueSlug todavía) y ordenar por (candidate, id) para que la
  // resolución de colisiones sea independiente del orden de la lista original.
  const entityCandidates = entities
    .map((entity) => {
      const base = toBaseSlug(entity.name);
      const collides =
        (baseSlugCounts.get(base) ?? 0) > 1 || reservedSlugs.includes(base);
      const candidate = collides
        ? `${base}-${slugify(entity.id) || entity.id}`
        : base;
      return { entity, candidate };
    })
    .sort((entryA, entryB) => {
      const candidateOrder = entryA.candidate.localeCompare(entryB.candidate);
      return candidateOrder !== 0
        ? candidateOrder
        : entryA.entity.id.localeCompare(entryB.entity.id);
    });

  // Paso 2: asignar slugs finales en el orden determinista.
  const usedSlugs = new Set<string>(reservedSlugs);

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

  const slugById = new Map<string, string>(
    entityCandidates.map(({ entity, candidate }) => [
      entity.id,
      ensureUniqueSlug(candidate),
    ]),
  );

  // Paso 3: devolver los resultados en el orden original de la lista.
  return entities.map((entity) => ({
    label: entity.name,
    // slugById siempre tiene la clave porque entityCandidates fue derivado de
    // las mismas entidades; el fallback es defensivo.
    slug: slugById.get(entity.id) ?? toBaseSlug(entity.name),
    value: entity.id,
  }));
}

/** Opciones de carpeta: "Sin carpeta" + una por carpeta existente (slug único). */
function buildFolderQualifierOptions(
  expenseFolders: ExpenseFolderOption[],
): FilterQualifierOption[] {
  return [
    {
      label: "Sin carpeta",
      slug: UNASSIGNED_FOLDER_QUALIFIER_SLUG,
      value: UNASSIGNED_FOLDER_FILTER_VALUE,
    },
    ...buildUniqueSlugOptions(expenseFolders, {
      fallbackSlug: "carpeta",
      reservedSlugs: [UNASSIGNED_FOLDER_QUALIFIER_SLUG],
    }),
  ];
}

/** Opciones de prestamista: una por prestamista cargado (slug único, valor=id). */
function buildLenderQualifierOptions(
  lenders: LenderOption[],
): FilterQualifierOption[] {
  return buildUniqueSlugOptions(lenders, {
    fallbackSlug: "prestamista",
    slugify: slugifyLenderName,
  });
}

export interface BuildMonthlyExpensesFilterQualifiersOptions {
  expenseFolders: ExpenseFolderOption[];
  lenders: LenderOption[];
}

/**
 * Construye los qualifiers de la barra para los gastos mensuales. Las opciones
 * de carpeta y prestamista se derivan en runtime de las entidades existentes.
 */
export function buildMonthlyExpensesFilterQualifiers({
  expenseFolders,
  lenders,
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
    { key: "enviados", kind: "numberRange", label: "Enviados" },
    { key: "cuotas-pagadas", kind: "numberRange", label: "Cuotas pagadas" },
    { key: "cuotas-restantes", kind: "numberRange", label: "Cuotas restantes" },
    { key: "cuotas-total", kind: "numberRange", label: "Cuotas totales" },
    { key: "link", kind: "textMatch", label: "Link de pago" },
    lenders.length > 0
      ? {
          iconName: "user",
          key: "prestamista",
          kind: "enum",
          label: "Prestamista",
          options: buildLenderQualifierOptions(lenders),
        }
      : {
          iconName: "user",
          key: "prestamista",
          kind: "textMatch",
          label: "Prestamista",
        },
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
]);
