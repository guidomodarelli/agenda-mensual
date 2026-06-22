import type { DataTableAdvancedFilterConfig } from "@/components/ui/data-table";

import { buildMonthlyExpensesFilterQualifiers } from "./monthly-expenses-filter-qualifiers";
import {
  LOAN_INSTALLMENT_RANGE_COLUMN_ID,
  LOAN_SORT_COLUMN_ID,
} from "./monthly-expenses-table-column-ids";

const ADVANCED_CONFIG: DataTableAdvancedFilterConfig[] = [
  { columnId: "subtotal", label: "Subtotal", type: "numberRange" },
  { columnId: "total", label: "Total", type: "numberRange" },
  { columnId: "usd", label: "USD", type: "numberRange" },
  { columnId: LOAN_SORT_COLUMN_ID, label: "Deuda / cuotas", type: "presence" },
  {
    columnId: "lenderName",
    enumOptions: [
      { label: "Yo debo", value: "payable" },
      { label: "Me deben", value: "receivable" },
      { label: "Sin deuda/préstamo", value: "none" },
    ],
    label: "Dirección",
    type: "enum",
  },
  {
    columnId: LOAN_INSTALLMENT_RANGE_COLUMN_ID,
    label: "Vigencia",
    type: "yearMonthRange",
  },
];

describe("buildMonthlyExpensesFilterQualifiers", () => {
  it("prepends the free-text description qualifier", () => {
    const [first] = buildMonthlyExpensesFilterQualifiers(ADVANCED_CONFIG);

    expect(first).toEqual({ key: "", kind: "text", label: "Descripción" });
  });

  it("maps each advanced column to a Spanish slug preserving columnId and kind", () => {
    const qualifiers = buildMonthlyExpensesFilterQualifiers(ADVANCED_CONFIG);
    const byColumnId = new Map(
      qualifiers
        .filter((qualifier) => qualifier.columnId != null)
        .map((qualifier) => [qualifier.columnId, qualifier]),
    );

    expect(byColumnId.get("total")).toMatchObject({
      key: "total",
      kind: "numberRange",
    });
    expect(byColumnId.get(LOAN_SORT_COLUMN_ID)).toMatchObject({
      key: "deuda",
      kind: "presence",
    });
    expect(byColumnId.get(LOAN_INSTALLMENT_RANGE_COLUMN_ID)).toMatchObject({
      key: "vigencia",
      kind: "yearMonthRange",
    });
  });

  it("does not expose the subtotal qualifier (no backing table column)", () => {
    const qualifiers = buildMonthlyExpensesFilterQualifiers(ADVANCED_CONFIG);

    expect(
      qualifiers.some((qualifier) => qualifier.columnId === "subtotal"),
    ).toBe(false);
  });

  it("derives direction enum options with typeable slugs", () => {
    const qualifiers = buildMonthlyExpensesFilterQualifiers(ADVANCED_CONFIG);
    const direction = qualifiers.find(
      (qualifier) => qualifier.columnId === "lenderName",
    );

    expect(direction?.options).toEqual([
      { label: "Yo debo", slug: "yo-debo", value: "payable" },
      { label: "Me deben", slug: "me-deben", value: "receivable" },
      { label: "Sin deuda/préstamo", slug: "sin-deuda", value: "none" },
    ]);
  });
});
