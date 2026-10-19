import {
  normalizeFilterSlug,
  type AppliedFilter,
  type FilterQualifierConfig,
  type FilterQualifierOption,
  type ParsedFilterQuery,
} from "@golfo/ui";


import { buildLenderQualifierOptions } from "./monthly-expenses-filter-qualifiers";

/** Clave de orden del listado de deudas, elegida vía `orden:` en la barra. */
export type LoansReportSortKey = "amount" | "due" | "lender";

export const DEFAULT_LOANS_REPORT_SORT_KEY: LoansReportSortKey = "amount";

/** Etiqueta del qualifier de texto libre (fuzzy sobre el nombre de la contraparte). */
export const LOANS_REPORT_TEXT_QUALIFIER_LABEL = "Contraparte";

const LENDER_TYPE_QUALIFIER_OPTIONS: FilterQualifierOption[] = [
  { label: "Bancos", slug: "banco", value: "bank" },
  { label: "Familiares", slug: "familiar", value: "family" },
  { label: "Amigos", slug: "amigo", value: "friend" },
  { label: "Fintech / Billeteras", slug: "fintech", value: "fintech" },
  { label: "Parejas", slug: "pareja", value: "partner" },
  { label: "Otros", slug: "otro", value: "other" },
  { label: "Sin prestamista", slug: "sin-prestamista", value: "unassigned" },
];

/** Opciones del dropdown "Ordenar por" del listado de deudas. */
export const LOANS_REPORT_SORT_OPTIONS: Array<{
  label: string;
  value: LoansReportSortKey;
}> = [
  { label: "Monto", value: "amount" },
  { label: "Vencimiento", value: "due" },
  { label: "Contraparte", value: "lender" },
];

export interface LoansReportLenderFilterOption {
  id: string;
  label: string;
}

/**
 * Qualifiers de la barra unificada del reporte de deudas: texto libre por
 * nombre de contraparte, `tipo:` y `contraparte:` (una opción por contraparte
 * con deuda). Todas las entradas tienen tipo y contraparte, así que ningún
 * campo ofrece las meta-claves de presencia (`tiene:`/`no:`). El orden del
 * listado vive en un dropdown aparte, no en la barra.
 */
export function buildLoansReportFilterQualifiers(
  lenderOptions: LoansReportLenderFilterOption[],
): FilterQualifierConfig[] {
  return [
    { key: "", kind: "text", label: LOANS_REPORT_TEXT_QUALIFIER_LABEL },
    {
      key: "tipo",
      kind: "enum",
      label: "Tipo",
      options: LENDER_TYPE_QUALIFIER_OPTIONS,
      supportsPresence: false,
    },
    lenderOptions.length > 0
      ? {
          iconName: "user",
          key: "contraparte",
          kind: "enum",
          label: "Contraparte",
          options: buildLenderQualifierOptions(
            lenderOptions.map((option) => ({
              id: option.id,
              name: option.label,
            })),
          ),
          supportsPresence: false,
        }
      : {
          iconName: "user",
          key: "contraparte",
          kind: "textMatch",
          label: "Contraparte",
          supportsPresence: false,
        },
  ];
}

/** Campos mínimos de una entrada del reporte que el filtro necesita evaluar. */
export interface LoansReportFilterableEntry {
  lenderId: string | null;
  lenderName: string;
  lenderType: string;
}

function getEnumFilterValues(
  appliedFilters: AppliedFilter[],
  key: string,
  negated: boolean,
): string[] {
  return appliedFilters
    .filter(
      (filter) =>
        filter.key === key &&
        filter.negated === negated &&
        filter.value.kind === "enum",
    )
    .map((filter) => (filter.value as { value: string }).value);
}

function matchesLenderNameText(
  entry: LoansReportFilterableEntry,
  text: string,
): boolean {
  return normalizeFilterSlug(entry.lenderName).includes(
    normalizeFilterSlug(text),
  );
}

/**
 * Aplica la query parseada a las entradas del reporte: `tipo:`/`contraparte:`
 * (OR entre valores repetidos, exclusión con `-`), y el texto libre matchea el
 * nombre de la contraparte. `orden:` no filtra (ver {@link getLoansReportSortKey}).
 */
export function filterLoansReportEntries<T extends LoansReportFilterableEntry>(
  entries: T[],
  parsed: ParsedFilterQuery,
): T[] {
  const includedTypes = getEnumFilterValues(parsed.appliedFilters, "tipo", false);
  const excludedTypes = getEnumFilterValues(parsed.appliedFilters, "tipo", true);
  const includedLenderIds = getEnumFilterValues(
    parsed.appliedFilters,
    "contraparte",
    false,
  );
  const excludedLenderIds = getEnumFilterValues(
    parsed.appliedFilters,
    "contraparte",
    true,
  );
  const freeText = parsed.descriptionFilter.trim();

  return entries.filter((entry) => {
    if (includedTypes.length > 0 && !includedTypes.includes(entry.lenderType)) {
      return false;
    }

    if (excludedTypes.includes(entry.lenderType)) {
      return false;
    }

    if (
      includedLenderIds.length > 0 &&
      (entry.lenderId === null || !includedLenderIds.includes(entry.lenderId))
    ) {
      return false;
    }

    if (entry.lenderId !== null && excludedLenderIds.includes(entry.lenderId)) {
      return false;
    }

    if (freeText && !matchesLenderNameText(entry, freeText)) {
      return false;
    }

    if (
      parsed.excludedDescriptionFilters.some((excludedText) =>
        matchesLenderNameText(entry, excludedText),
      )
    ) {
      return false;
    }

    return true;
  });
}

