import { vi } from "vitest";
import { TooltipProvider } from "beez-ui";
import { render, screen } from "@testing-library/react";
import { StrictMode, type ComponentProps } from "react";

import {
  MonthlyExpensesTable,
  type MonthlyExpensesEditableRow,
} from "./monthly-expenses-table";
import { DEFAULT_USD_RATE_SETTINGS } from "./monthly-expenses-table.types";

type MonthlyExpensesTableProps = ComponentProps<typeof MonthlyExpensesTable>;

/**
 * Builds a fully-populated editable expense row for table tests, allowing
 * per-test overrides of any field.
 */
export function createRow(
  overrides: Partial<MonthlyExpensesEditableRow> = {},
): MonthlyExpensesEditableRow {
  return {
    allReceiptsFolderId: "",
    allReceiptsFolderViewUrl: "",
    currency: "ARS",
    description: "Internet",
    expenseFolderId: "",
    sortOrder: null,
    id: "expense-1",
    installmentCount: "",
    isLoan: false,
    lenderId: "",
    lenderName: "",
    loanEndMonth: "",
    loanPaidInstallments: null,
    loanProgress: "",
    loanRemainingInstallments: null,
    loanTotalInstallments: null,
    manualCoveredPayments: "0",
    monthlyFolderId: "",
    monthlyFolderViewUrl: "",
    occurrencesPerMonth: "1",
    occurrencesUnit: "",
    isRecurring: false,
    recurrenceStartMonth: "",
    recurrenceEndMonth: "",
    recurrenceIsActive: false,
    paymentLink: "",
    receiptShareMessage: "",
    receiptSharePhoneDigits: "",
    requiresReceiptShare: false,
    receipts: [],
    startMonth: "",
    subtotal: "1000",
    subtotalUnit: "occurrence",
    total: "1000",
    usdRate: { ...DEFAULT_USD_RATE_SETTINGS },
    ...overrides,
  };
}

/**
 * Returns the given texts sorted by their position inside the table body, to
 * assert on-screen row/group order.
 */
export function getTableTextOrder(texts: string[]): string[] {
  const tableElement = screen.getAllByRole("table")[0];
  const content = tableElement.textContent ?? "";

  return [...texts].sort(
    (leftText, rightText) =>
      content.indexOf(leftText) - content.indexOf(rightText),
  );
}

/**
 * Renders the MonthlyExpensesTable with safe defaults for every prop so each
 * test only overrides what it exercises.
 */
export function renderMonthlyExpensesTable(
  rows: MonthlyExpensesEditableRow[],
  overrides: Partial<MonthlyExpensesTableProps> = {},
  options: {
    /**
     * Wraps the tree in React.StrictMode to reproduce the dev double-mount,
     * where mount effects run twice (needed for persistence race regressions).
     */
    strictMode?: boolean;
  } = {},
) {
  const defaultProps: MonthlyExpensesTableProps = {
    actionDisabled: false,
    changedFields: new Set(),
    draft: null,
    exchangeRateLoadError: null,
    exchangeRateSnapshot: null,
    expenseFolders: [],
    feedbackMessage: "",
    feedbackTone: "default",
    isCopyFromDisabled: false,
    isExpenseSheetOpen: false,
    isMonthTransitionPending: false,
    isSubmitting: false,
    lenders: [],
    loadError: null,
    month: "2026-04",
    onAddExpense: vi.fn(),
    onAddLender: vi.fn(),
    onCopyFromMonth: vi.fn(),
    onCopyFromMonthDialogOpenChange: vi.fn(),
    onConfirmCopyFromMonth: vi.fn(),
    onToggleAllReplicableOptions: vi.fn(),
    onToggleReplicableOption: vi.fn(),
    onDeleteAllReceiptsFolderReference: vi.fn(),
    onDeleteExpense: vi.fn(),
    onDeleteExpenses: vi.fn().mockResolvedValue(true),
    onDeleteExpenseReceiptShare: vi.fn(),
    onDeleteMonthlyFolderReference: vi.fn(),
    onDeletePaymentLink: vi.fn(),
    onDeleteReceipt: vi.fn(),
    onDeleteManualPaymentRecord: vi.fn(),
    onDuplicateExpense: vi.fn(),
    onEditExpense: vi.fn(),
    onEditManualPaymentRecord: vi.fn(),
    onEditReceiptCoverage: vi.fn(),
    onExpenseFieldChange: vi.fn(),
    onExpenseFolderSelect: vi.fn(),
    onManageFolders: vi.fn(),
    onMoveExpenseToFolder: vi.fn(),
    onMoveExpensesToFolder: vi.fn().mockResolvedValue(true),
    onReorderFolders: vi.fn(),
    onExpenseLenderSelect: vi.fn(),
    onExpenseLoanToggle: vi.fn(),
    onExpenseRecurringToggle: vi.fn(),
    onCancelRecurrence: vi.fn(),
    onReactivateRecurrence: vi.fn(),
    onExpenseReceiptShareToggle: vi.fn(),
    onMonthChange: vi.fn(),
    onRegisterPaymentRecord: vi.fn().mockResolvedValue(true),
    onRequestCloseExpenseSheet: vi.fn(),
    onSaveExpense: vi.fn(),
    onSaveUnsavedChanges: vi.fn(),
    onUnsavedChangesClose: vi.fn(),
    onUnsavedChangesDiscard: vi.fn(),
    onUpdateExpenseDetails: vi.fn(),
    onUpdateExpenseReceiptShare: vi.fn(),
    onUpdatePaymentLink: vi.fn(),
    onUpdateUsdRate: vi.fn(),
    onMarkExpensePaid: vi.fn(),
    onQuickAddExpense: vi.fn(),
    onDuplicateExpenseToMonth: vi.fn(),
    onUpdatePaymentRecordSendStatus: vi.fn(),
    pendingMonth: null,
    replicateFromPreviousMonthDialogOpen: false,
    replicateFromPreviousMonthOptions: [],
    rows,
    selectedReplicableOptionIds: [],
    sheetMode: "create",
    showCopyFromControls: false,
    showUnsavedChangesDialog: false,
    validationMessage: null,
  };
  const props: MonthlyExpensesTableProps = {
    ...defaultProps,
    ...overrides,
  };

  const tree = (
    <TooltipProvider>
      <MonthlyExpensesTable {...props} />
    </TooltipProvider>
  );

  return {
    props,
    ...render(options.strictMode ? <StrictMode>{tree}</StrictMode> : tree),
  };
}
