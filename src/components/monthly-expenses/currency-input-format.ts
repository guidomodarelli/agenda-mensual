export function normalizeCurrencyInput(value: string): string {
  const sanitizedValue = value.replace(/[^\d,.-]/g, "");

  if (!sanitizedValue) {
    return "";
  }

  const hasCommaDecimalSeparator = sanitizedValue.includes(",");

  if (!hasCommaDecimalSeparator) {
    return sanitizedValue.replace(/[^\d-]/g, "");
  }

  const decimalSeparatorIndex = sanitizedValue.lastIndexOf(",");
  const integerPart = sanitizedValue.slice(0, decimalSeparatorIndex);
  const decimalPart = sanitizedValue.slice(decimalSeparatorIndex + 1);
  const normalizedIntegerPart = integerPart.replace(/[^\d-]/g, "");
  const normalizedDecimalPart = decimalPart.replace(/[^\d]/g, "").slice(0, 2);

  if (normalizedDecimalPart.length === 0) {
    return `${normalizedIntegerPart}.`;
  }

  return `${normalizedIntegerPart}.${normalizedDecimalPart}`;
}

export function formatCurrencyDisplay(value: string): string {
  return formatCurrencyDisplayWithOptions(value);
}

export function formatCurrencyDisplayWithOptions(
  value: string,
  options?: {
    preserveExplicitFractionDigits?: boolean;
  },
): string {
  const preserveExplicitFractionDigits =
    options?.preserveExplicitFractionDigits ?? false;
  const normalizedValue = /^-?\d+\.(\d{1,2})?$/.test(value)
    ? value
    : normalizeCurrencyInput(value);

  if (!normalizedValue) {
    return "";
  }

  const numericValue = Number(normalizedValue);

  if (!Number.isFinite(numericValue)) {
    return "";
  }

  if (normalizedValue.endsWith(".")) {
    return `${new Intl.NumberFormat("es-AR", {
      maximumFractionDigits: 0,
    }).format(numericValue)},`;
  }

  const [, decimalPart = ""] = normalizedValue.split(".");
  const normalizedDecimalPart = decimalPart.slice(0, 2);
  const minimumFractionDigits =
    preserveExplicitFractionDigits
      ? normalizedDecimalPart.length
      : normalizedDecimalPart.length === 0 || /^0+$/.test(normalizedDecimalPart)
      ? 0
      : normalizedDecimalPart.length;

  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: Math.max(minimumFractionDigits, 0),
    minimumFractionDigits,
  }).format(numericValue);
}
