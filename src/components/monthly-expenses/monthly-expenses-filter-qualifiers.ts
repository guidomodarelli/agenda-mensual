import type { DataTableAdvancedFilterConfig } from "@/components/ui/data-table";
import type {
  FilterQualifierConfig,
  FilterQualifierOption,
} from "@/components/ui/filter-query-grammar";

import {
  LOAN_INSTALLMENT_RANGE_COLUMN_ID,
  LOAN_SORT_COLUMN_ID,
} from "./monthly-expenses-table-column-ids";

/**
 * Builds the GitHub-style filter qualifiers for the monthly expenses table from
 * the existing advanced-filter config, so the query bar and the legacy column
 * matchers stay in sync (same columnId + filter kind, just exposed as `key:value`
 * tokens with Spanish slugs).
 */

/** Slug del qualifier de texto libre por defecto (búsqueda fuzzy por descripción). */
export const DESCRIPTION_QUALIFIER_LABEL = "Descripción";

interface QualifierDescriptor {
  slug: string;
  label: string;
}

/** Mapeo de columnId → slug en español + etiqueta visible del qualifier. */
const QUALIFIER_DESCRIPTORS: Record<string, QualifierDescriptor> = {
  subtotal: { label: "Subtotal", slug: "subtotal" },
  total: { label: "Total", slug: "total" },
  usd: { label: "USD", slug: "usd" },
  paymentsProgress: { label: "Pagos", slug: "pagos" },
  paymentHistory: { label: "Registros", slug: "registros" },
  [LOAN_SORT_COLUMN_ID]: { label: "Deuda / cuotas", slug: "deuda" },
  lenderName: { label: "Dirección", slug: "direccion" },
  [LOAN_INSTALLMENT_RANGE_COLUMN_ID]: { label: "Vigencia", slug: "vigencia" },
};

/** Mapeo del valor interno de dirección → slug tipeable en la barra. */
const LOAN_DIRECTION_VALUE_SLUGS: Record<string, string> = {
  payable: "yo-debo",
  receivable: "me-deben",
  none: "sin-deuda",
};

function buildEnumOptions(
  config: DataTableAdvancedFilterConfig,
): FilterQualifierOption[] {
  return (config.enumOptions ?? []).map((enumOption) => ({
    label: enumOption.label,
    slug: LOAN_DIRECTION_VALUE_SLUGS[enumOption.value] ?? enumOption.value,
    value: enumOption.value,
  }));
}

/**
 * Traduce la config de filtros avanzados a qualifiers de la barra de query.
 * Antepone el qualifier de texto libre (descripción) y omite columnas sin
 * descriptor conocido.
 */
export function buildMonthlyExpensesFilterQualifiers(
  advancedFiltersConfig: DataTableAdvancedFilterConfig[],
): FilterQualifierConfig[] {
  const qualifiers: FilterQualifierConfig[] = [
    { key: "", kind: "text", label: DESCRIPTION_QUALIFIER_LABEL },
  ];

  for (const advancedFilterConfig of advancedFiltersConfig) {
    const descriptor = QUALIFIER_DESCRIPTORS[advancedFilterConfig.columnId];

    if (!descriptor) {
      continue;
    }

    qualifiers.push({
      columnId: advancedFilterConfig.columnId,
      key: descriptor.slug,
      kind: advancedFilterConfig.type,
      label: descriptor.label,
      ...(advancedFilterConfig.type === "enum"
        ? { options: buildEnumOptions(advancedFilterConfig) }
        : {}),
    });
  }

  return qualifiers;
}
