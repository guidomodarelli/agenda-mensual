import type {
  ExchangeRateSnapshot,
  MonthlyExpenseCurrency,
  MonthlyExpensesEditableRow,
} from "./monthly-expenses-table.types";

const CURRENCY_FORMATTER_BY_CURRENCY: Record<
  MonthlyExpenseCurrency,
  Intl.NumberFormat
> = {
  ARS: new Intl.NumberFormat("es-AR", {
    currency: "ARS",
    style: "currency",
  }),
  USD: new Intl.NumberFormat("es-AR", {
    currency: "USD",
    style: "currency",
  }),
};

/** Formats a raw string amount in its own currency, echoing non-numeric input. */
export function formatCurrencyAmount(
  currency: MonthlyExpenseCurrency,
  value: string,
): string {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return value;
  }

  return CURRENCY_FORMATTER_BY_CURRENCY[currency].format(numericValue);
}

/** Formats an already-converted numeric amount, using "-" for missing values. */
export function formatConvertedAmount(
  currency: MonthlyExpenseCurrency,
  value: number | null,
): string {
  if (value == null) {
    return "-";
  }

  return CURRENCY_FORMATTER_BY_CURRENCY[currency].format(value);
}

/** Formats an exchange-rate figure as a plain ARS amount (no currency code). */
export function formatExchangeRateAmount(value: number): string {
  return `$ ${new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value)}`;
}

/**
 * Converts a row amount into the requested currency using the solidarity rate.
 * Returns `null` when the amount is not finite or the snapshot is unavailable.
 */
export function getConvertedAmountForCurrency({
  currency,
  exchangeRateSnapshot,
  rowCurrency,
  total,
}: {
  currency: MonthlyExpenseCurrency;
  exchangeRateSnapshot: ExchangeRateSnapshot | null;
  rowCurrency: MonthlyExpenseCurrency;
  total: number;
}): number | null {
  if (!Number.isFinite(total)) {
    return null;
  }

  if (currency === "ARS") {
    if (rowCurrency === "ARS") {
      return total;
    }

    if (!exchangeRateSnapshot) {
      return null;
    }

    return total * exchangeRateSnapshot.solidarityRate;
  }

  if (rowCurrency === "USD") {
    return total;
  }

  if (!exchangeRateSnapshot) {
    return null;
  }

  return total / exchangeRateSnapshot.solidarityRate;
}

/** Returns a row amount expressed in ARS for cross-currency comparison/sorting. */
export function getArsComparableAmount({
  exchangeRateSnapshot,
  rowCurrency,
  value,
}: {
  exchangeRateSnapshot: ExchangeRateSnapshot | null;
  rowCurrency: MonthlyExpenseCurrency;
  value: string;
}): number | null {
  return getConvertedAmountForCurrency({
    currency: "ARS",
    exchangeRateSnapshot,
    rowCurrency,
    total: Number(value),
  });
}

/** Sums the given rows in the requested currency, ignoring unconvertible rows. */
export function getConvertedTotalAmount({
  currency,
  exchangeRateSnapshot,
  rows,
}: {
  currency: MonthlyExpenseCurrency;
  exchangeRateSnapshot: ExchangeRateSnapshot | null;
  rows: MonthlyExpensesEditableRow[];
}): number | null {
  let total = 0;
  let hasValues = false;

  for (const row of rows) {
    const convertedAmount = getConvertedAmountForCurrency({
      currency,
      exchangeRateSnapshot,
      rowCurrency: row.currency,
      total: Number(row.total),
    });

    if (convertedAmount == null) {
      continue;
    }

    total += convertedAmount;
    hasValues = true;
  }

  return hasValues ? total : null;
}
