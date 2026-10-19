/**
 * Centralizes the choices of the monthly expenses `Select` fields, in the
 * closed `options` shape that the @astra-kit/ui `Select` renders.
 *
 * @module select-options.constants
 */
import type { SelectOption } from "@astra-kit/ui";

/** Currencies of the expense sheet, with their full names. */
export const EXPENSE_CURRENCY_OPTIONS = [
  { label: "Peso argentino (ARS)", value: "ARS" },
  { label: "Dolar estadounidense (USD)", value: "USD" },
] as const satisfies readonly SelectOption[];

/** Currencies of the quick add row, labelled by their ISO code. */
export const QUICK_ADD_CURRENCY_OPTIONS = [
  { label: "ARS", value: "ARS" },
  { label: "USD", value: "USD" },
] as const satisfies readonly SelectOption[];

/** Units an expense subtotal can be expressed in. */
export const EXPENSE_SUBTOTAL_UNIT_OPTIONS = [
  { label: "Por ocurrencia", value: "occurrence" },
  { label: "Por hora", value: "hour" },
] as const satisfies readonly SelectOption[];

/** Kinds of lender of the lender catalog. */
export const LENDER_TYPE_OPTIONS = [
  { label: "Banco", value: "bank" },
  { label: "Familiar", value: "family" },
  { label: "Amigo", value: "friend" },
  { label: "Fintech / Billetera", value: "fintech" },
  { label: "Pareja", value: "partner" },
  { label: "Otro", value: "other" },
] as const satisfies readonly SelectOption[];

/** Send states of a receipt that has to be shared with someone. */
export const RECEIPT_SHARE_STATUS_OPTIONS = [
  { label: "Pendiente", value: "pending" },
  { label: "Enviado", value: "sent" },
] as const satisfies readonly SelectOption[];
