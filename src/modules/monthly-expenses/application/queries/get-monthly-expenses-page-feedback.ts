export function getSafeLoansReportErrorMessage(error: unknown): string {
  const fallbackMessage =
    "No pudimos actualizar el reporte de deudas en este momento. Igual podés seguir cargando gastos y volver a intentarlo más tarde.";

  if (!(error instanceof Error) && typeof error !== "string") {
    return fallbackMessage;
  }

  const message = typeof error === "string" ? error : error.message;

  if (
    message.includes("Google authentication is required") ||
    message.includes("Conectate con Google")
  ) {
    return "Conectate con Google para consultar el reporte de deudas.";
  }

  if (message.includes("missing the Drive permissions required")) {
    return "Tu sesión actual no tiene permisos suficientes para consultar el reporte de deudas en Drive.";
  }

  return fallbackMessage;
}

export function getSafeMonthlyExpensesErrorMessage(error: unknown): string {
  const fallbackMessage =
    "No pudimos guardar los gastos mensuales en este momento. Revisá los datos y volvé a intentarlo.";

  if (!(error instanceof Error) && typeof error !== "string") {
    return fallbackMessage;
  }

  const message = typeof error === "string" ? error : error.message;

  if (message.includes("Google authentication is required")) {
    return "Conectate con Google para guardar tus gastos mensuales en Drive.";
  }

  if (message.includes("missing the Drive permissions required")) {
    return "Tu sesión actual no tiene permisos suficientes para guardar gastos mensuales en Drive.";
  }

  if (message.includes("Google Drive rejected the monthly expenses payload")) {
    return "No pudimos guardar los gastos porque algunos datos no son válidos. Revisá la planilla y volvé a intentarlo.";
  }

  if (message.includes("A receipt folder with the requested description already exists")) {
    return "Ya existe una carpeta de comprobantes con esa descripción. Cambiá la descripción del gasto y volvé a intentar.";
  }

  if (message.includes("A receipt folder with the same description already exists")) {
    return "Ya existe una carpeta de comprobantes con esa descripción. Cambiá la descripción del gasto y volvé a intentar.";
  }

  if (
    message.includes(
      "manual covered payments to be between 0 and total required payments",
    )
  ) {
    return "La cantidad de pagos sin comprobante debe estar entre 0 y el total de pagos del gasto.";
  }

  if (
    message.includes(
      "receipt coverage to be less than or equal to the remaining payments",
    )
  ) {
    return "La cobertura de comprobantes no puede superar los pagos pendientes del gasto.";
  }

  if (message.includes("Monthly expense receipts support files up to 5MB")) {
    return "El comprobante supera los 5MB permitidos. Elegí un archivo más liviano.";
  }

  if (message.includes("Monthly expense receipts only support")) {
    return "Solo se permiten comprobantes PDF, JPG, PNG, WEBP, HEIC o HEIF.";
  }

  if (message.includes("upload monthly expense receipts")) {
    return "No pudimos subir el comprobante en este momento. Volvé a intentarlo.";
  }

  return fallbackMessage;
}

export function getSafeMonthlyExpensesLoadErrorMessage(error: unknown): string {
  const fallbackMessage =
    "No pudimos cargar los gastos mensuales en este momento. Volvé a intentarlo más tarde.";

  if (!(error instanceof Error) && typeof error !== "string") {
    return fallbackMessage;
  }

  const message = typeof error === "string" ? error : error.message;

  if (message.includes("Google authentication is required")) {
    return "Conectate con Google para cargar tus gastos mensuales.";
  }

  if (message.includes("missing the Drive permissions required")) {
    return "Tu sesión actual no tiene permisos suficientes para cargar gastos mensuales desde Drive.";
  }

  return fallbackMessage;
}

export function getSafeLendersErrorMessage(error: unknown): string {
  const fallbackMessage =
    "No pudimos actualizar el catálogo de prestamistas en este momento. Volvé a intentarlo más tarde.";

  if (!(error instanceof Error) && typeof error !== "string") {
    return fallbackMessage;
  }

  const message = typeof error === "string" ? error : error.message;

  if (message.includes("Google authentication is required")) {
    return "Conectate con Google para gestionar el catálogo de prestamistas.";
  }

  if (message.includes("missing the Drive permissions required")) {
    return "Tu sesión actual no tiene permisos suficientes para gestionar prestamistas en Drive.";
  }

  return fallbackMessage;
}
