import type {
  GetServerSideProps,
  GetServerSidePropsContext,
  InferGetServerSidePropsType,
} from "next";
import type { FormEvent } from "react";
import { useState } from "react";
import { useSession } from "next-auth/react";

import {
  MonthlyExpensesTable,
  type MonthlyExpensesEditableRow,
} from "@/components/monthly-expenses/monthly-expenses-table";
import { isGoogleOAuthConfigured } from "@/modules/auth/infrastructure/oauth/google-oauth-config";
import { GOOGLE_OAUTH_SCOPES } from "@/modules/auth/infrastructure/oauth/google-oauth-scopes";
import type { SaveMonthlyExpensesCommand } from "@/modules/monthly-expenses/application/commands/save-monthly-expenses-command";
import {
  getMonthlyExpensesDocument,
} from "@/modules/monthly-expenses/application/use-cases/get-monthly-expenses-document";
import {
  createEmptyMonthlyExpensesDocumentResult,
  type MonthlyExpensesDocumentResult,
} from "@/modules/monthly-expenses/application/results/monthly-expenses-document-result";
import {
  saveMonthlyExpensesDocumentViaApi,
} from "@/modules/monthly-expenses/infrastructure/api/monthly-expenses-api";
import { getStorageBootstrap } from "@/modules/storage/application/queries/get-storage-bootstrap";
import type { StorageBootstrapResult } from "@/modules/storage/application/results/storage-bootstrap";

import styles from "./monthly-expenses.module.scss";

type MonthlyExpensesPageProps = {
  bootstrap: StorageBootstrapResult;
  initialDocument: MonthlyExpensesDocumentResult;
  loadError: string | null;
};

interface MonthlyExpensesFormState {
  error: string | null;
  isSubmitting: boolean;
  month: string;
  result: {
    id: string;
    month: string;
    name: string;
    viewUrl: string | null;
  } | null;
  rows: MonthlyExpensesEditableRow[];
  successMessage: string | null;
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
type MonthlyExpenseCurrency = "ARS" | "USD";

function getCurrentMonthIdentifier(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function createExpenseRowId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `expense-${Math.random().toString(36).slice(2, 10)}`;
}

function formatEditableNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toString();
}

function calculateRowTotal(subtotal: string, occurrencesPerMonth: string): string {
  const subtotalValue = Number(subtotal);
  const occurrencesValue = Number(occurrencesPerMonth);

  if (
    !Number.isFinite(subtotalValue) ||
    subtotalValue <= 0 ||
    !Number.isInteger(occurrencesValue) ||
    occurrencesValue <= 0
  ) {
    return "0.00";
  }

  return Number((subtotalValue * occurrencesValue).toFixed(2)).toFixed(2);
}

function createEmptyRow(): MonthlyExpensesEditableRow {
  return {
    currency: "ARS",
    description: "",
    id: createExpenseRowId(),
    occurrencesPerMonth: "",
    subtotal: "",
    total: "0.00",
  };
}

function ensureRows(rows: MonthlyExpensesEditableRow[]): MonthlyExpensesEditableRow[] {
  return rows.length > 0 ? rows : [createEmptyRow()];
}

function toEditableRows(
  document: MonthlyExpensesDocumentResult,
): MonthlyExpensesEditableRow[] {
  return ensureRows(
    document.items.map((item) => ({
      currency: item.currency,
      description: item.description,
      id: item.id,
      occurrencesPerMonth: formatEditableNumber(item.occurrencesPerMonth),
      subtotal: formatEditableNumber(item.subtotal),
      total: item.total.toFixed(2),
    })),
  );
}

function createMonthlyExpensesFormState(
  document: MonthlyExpensesDocumentResult,
): MonthlyExpensesFormState {
  return {
    error: null,
    isSubmitting: false,
    month: document.month,
    result: null,
    rows: toEditableRows(document),
    successMessage: null,
  };
}

function normalizeEditableRows(
  rows: MonthlyExpensesEditableRow[],
): MonthlyExpensesEditableRow[] {
  return rows.map((row) => ({
    ...row,
    total: calculateRowTotal(row.subtotal, row.occurrencesPerMonth),
  }));
}

function getValidationMessage(
  month: string,
  rows: MonthlyExpensesEditableRow[],
): string | null {
  if (!MONTH_PATTERN.test(month.trim())) {
    return "Seleccioná un mes válido antes de guardar.";
  }

  const hasInvalidRow = rows.some((row) => {
    const subtotal = Number(row.subtotal);
    const occurrencesPerMonth = Number(row.occurrencesPerMonth);

    return (
      !row.description.trim() ||
      !Number.isFinite(subtotal) ||
      subtotal <= 0 ||
      !Number.isInteger(occurrencesPerMonth) ||
      occurrencesPerMonth <= 0
    );
  });

  if (hasInvalidRow) {
    return "Completá descripción, subtotal y cantidad de veces por mes en cada gasto antes de guardar.";
  }

  return null;
}

function toSaveMonthlyExpensesCommand(
  state: MonthlyExpensesFormState,
): SaveMonthlyExpensesCommand {
  return {
    items: state.rows.map((row) => ({
      currency: row.currency,
      description: row.description.trim(),
      id: row.id,
      occurrencesPerMonth: Number(row.occurrencesPerMonth),
      subtotal: Number(row.subtotal),
    })),
    month: state.month.trim(),
  };
}

function getRequestedMonth(queryValue: GetServerSidePropsContext["query"]["month"]) {
  const monthValue = Array.isArray(queryValue) ? queryValue[0] : queryValue;
  const normalizedMonth = monthValue?.trim();

  return normalizedMonth && MONTH_PATTERN.test(normalizedMonth)
    ? normalizedMonth
    : getCurrentMonthIdentifier();
}

export default function MonthlyExpensesPage({
  bootstrap,
  initialDocument,
  loadError,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const isOAuthConfigured = bootstrap.authStatus === "configured";
  const { status } = useSession();
  const [formState, setFormState] = useState<MonthlyExpensesFormState>(
    createMonthlyExpensesFormState(initialDocument),
  );

  const isAuthenticated = status === "authenticated";
  const isSessionLoading = status === "loading";
  const sessionMessage = !isOAuthConfigured
    ? "Completá la configuración OAuth del servidor para habilitar el guardado mensual."
    : isSessionLoading
      ? "Estamos verificando tu sesión de Google."
      : isAuthenticated
        ? "Sesión Google activa. Ya podés guardar tus gastos mensuales."
        : "Conectate con Google para cargar y guardar tus gastos mensuales.";
  const validationMessage = getValidationMessage(formState.month, formState.rows);

  const feedbackMessage =
    formState.error ??
    formState.successMessage ??
    validationMessage ??
    "Completá la tabla y guardá el mes actual en Drive.";
  const feedbackTone = formState.error || validationMessage
    ? "error"
    : formState.successMessage
      ? "success"
      : "default";

  const actionDisabled =
    !isOAuthConfigured ||
    !isAuthenticated ||
    isSessionLoading ||
    formState.isSubmitting ||
    Boolean(validationMessage);

  const updateFormState = (
    updater: (currentState: MonthlyExpensesFormState) => MonthlyExpensesFormState,
  ) => {
    setFormState((currentState) => updater(currentState));
  };

  const handleMonthChange = (value: string) => {
    updateFormState((currentState) => ({
      ...currentState,
      error: null,
      month: value,
      result: null,
      successMessage: null,
    }));
  };

  const handleExpenseFieldChange = (
    expenseId: string,
    fieldName:
      | "currency"
      | "description"
      | "occurrencesPerMonth"
      | "subtotal",
    value: string,
  ) => {
    updateFormState((currentState) => ({
      ...currentState,
      error: null,
      result: null,
      rows: normalizeEditableRows(
        currentState.rows.map((row) =>
          row.id === expenseId
            ? {
                ...row,
                [fieldName]:
                  fieldName === "currency"
                    ? (value as MonthlyExpenseCurrency)
                    : value,
              }
            : row,
        ),
      ),
      successMessage: null,
    }));
  };

  const handleAddExpense = () => {
    updateFormState((currentState) => ({
      ...currentState,
      error: null,
      result: null,
      rows: [...currentState.rows, createEmptyRow()],
      successMessage: null,
    }));
  };

  const handleRemoveExpense = (expenseId: string) => {
    updateFormState((currentState) => ({
      ...currentState,
      error: null,
      result: null,
      rows: ensureRows(
        normalizeEditableRows(
          currentState.rows.filter((row) => row.id !== expenseId),
        ),
      ),
      successMessage: null,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (validationMessage || !isOAuthConfigured || !isAuthenticated) {
      return;
    }

    updateFormState((currentState) => ({
      ...currentState,
      error: null,
      isSubmitting: true,
      result: null,
      successMessage: null,
    }));

    try {
      const result = await saveMonthlyExpensesDocumentViaApi(
        toSaveMonthlyExpensesCommand(formState),
      );

      updateFormState((currentState) => ({
        ...currentState,
        isSubmitting: false,
        result,
        successMessage: `Gastos mensuales guardados en Drive con id ${result.id}.`,
      }));
    } catch (error) {
      updateFormState((currentState) => ({
        ...currentState,
        error:
          error instanceof Error
            ? error.message
            : "No pudimos guardar los gastos mensuales en Google Drive.",
        isSubmitting: false,
      }));
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.layout}>
        <MonthlyExpensesTable
          actionDisabled={actionDisabled}
          feedbackMessage={feedbackMessage}
          feedbackTone={feedbackTone}
          isAuthenticated={isAuthenticated}
          isSubmitting={formState.isSubmitting}
          loadError={loadError}
          month={formState.month}
          onAddExpense={handleAddExpense}
          onExpenseFieldChange={handleExpenseFieldChange}
          onMonthChange={handleMonthChange}
          onRemoveExpense={handleRemoveExpense}
          onSubmit={handleSubmit}
          result={formState.result}
          rows={formState.rows}
          sessionMessage={sessionMessage}
        />
      </div>
    </main>
  );
}

export const getServerSideProps: GetServerSideProps<MonthlyExpensesPageProps> =
  async (context) => {
    const selectedMonth = getRequestedMonth(context.query.month);
    const bootstrap = getStorageBootstrap({
      isGoogleOAuthConfigured: isGoogleOAuthConfigured(),
      requiredScopes: GOOGLE_OAUTH_SCOPES,
    });

    if (bootstrap.authStatus !== "configured") {
      return {
        props: {
          bootstrap,
          initialDocument: createEmptyMonthlyExpensesDocumentResult(
            selectedMonth,
          ),
          loadError: null,
        },
      };
    }

    try {
      const { getGoogleDriveClientFromRequest } = await import(
        "@/modules/auth/infrastructure/google-drive/google-drive-client"
      );
      const { GoogleDriveMonthlyExpensesRepository } = await import(
        "@/modules/monthly-expenses/infrastructure/google-drive/repositories/google-drive-monthly-expenses-repository"
      );
      const driveClient = await getGoogleDriveClientFromRequest(context.req);
      const initialDocument = await getMonthlyExpensesDocument({
        query: {
          month: selectedMonth,
        },
        repository: new GoogleDriveMonthlyExpensesRepository(driveClient),
      });

      return {
        props: {
          bootstrap,
          initialDocument,
          loadError: null,
        },
      };
    } catch (error) {
      return {
        props: {
          bootstrap,
          initialDocument: createEmptyMonthlyExpensesDocumentResult(
            selectedMonth,
          ),
          loadError:
            error instanceof Error &&
            (error.name === "GoogleOAuthAuthenticationError" ||
              error.name === "GoogleOAuthConfigurationError")
              ? null
              : "No pudimos cargar el archivo mensual desde Drive. Igual podés editar la tabla y volver a guardarla.",
        },
      };
    }
  };
