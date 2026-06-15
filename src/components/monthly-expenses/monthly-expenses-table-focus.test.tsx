import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";

import {
  MonthlyExpensesTable,
  type MonthlyExpensesEditableRow,
} from "./monthly-expenses-table";

function createRow(overrides: Partial<MonthlyExpensesEditableRow> = {}): MonthlyExpensesEditableRow {
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
    paymentLink: "",
    receiptShareMessage: "",
    receiptSharePhoneDigits: "",
    receiptShareStatus: "",
    requiresReceiptShare: false,
    receipts: [],
    startMonth: "",
    subtotal: "1000",
    subtotalUnit: "occurrence",
    total: "1000",
    ...overrides,
  };
}

function renderMonthlyExpensesTable(
  rows: MonthlyExpensesEditableRow[],
  overrides: Partial<
    Pick<
      ComponentProps<typeof MonthlyExpensesTable>,
      "onUpdateExpenseDetails"
    >
  > = {},
) {
  return render(
    <TooltipProvider>
      <MonthlyExpensesTable
        actionDisabled={false}
        changedFields={new Set()}
        draft={null}
        exchangeRateLoadError={null}
        exchangeRateSnapshot={null}
        expenseFolders={[]}
        folderFilterId=""
        feedbackMessage=""
        feedbackTone="default"
        isCopyFromDisabled={false}
        isExpenseSheetOpen={false}
        isMonthTransitionPending={false}
        isSubmitting={false}
        lenders={[]}
        loadError={null}
        month="2026-04"
        onAddExpense={jest.fn()}
        onAddLender={jest.fn()}
        onCopyFromMonth={jest.fn()}
        onCopyFromMonthDialogOpenChange={jest.fn()}
        onConfirmCopyFromMonth={jest.fn()}
        onToggleAllReplicableOptions={jest.fn()}
        onToggleReplicableOption={jest.fn()}
        onDeleteAllReceiptsFolderReference={jest.fn()}
        onDeleteExpense={jest.fn()}
        onDeleteExpenses={jest.fn().mockResolvedValue(true)}
        onDeleteExpenseReceiptShare={jest.fn()}
        onDeleteMonthlyFolderReference={jest.fn()}
        onDeletePaymentLink={jest.fn()}
        onDeleteReceipt={jest.fn()}
        onDeleteManualPaymentRecord={jest.fn()}
        onEditExpense={jest.fn()}
        onEditManualPaymentRecord={jest.fn()}
        onEditReceiptCoverage={jest.fn()}
        onExpenseFieldChange={jest.fn()}
        onExpenseFolderSelect={jest.fn()}
        onFolderFilterChange={jest.fn()}
        onManageFolders={jest.fn()}
        onMoveExpenseToFolder={jest.fn()}
        onReorderFolders={jest.fn()}
        onExpenseLenderSelect={jest.fn()}
        onExpenseLoanToggle={jest.fn()}
        onExpenseReceiptShareToggle={jest.fn()}
        onMonthChange={jest.fn()}
        onRegisterPaymentRecord={jest.fn().mockResolvedValue(true)}
        onRequestCloseExpenseSheet={jest.fn()}
        onSaveExpense={jest.fn()}
        onSaveUnsavedChanges={jest.fn()}
        onUnsavedChangesClose={jest.fn()}
        onUnsavedChangesDiscard={jest.fn()}
        onUpdateExpenseDetails={jest.fn()}
        {...overrides}
        onUpdateExpenseReceiptShare={jest.fn()}
        onUpdatePaymentLink={jest.fn()}
        onUpdateReceiptShareStatus={jest.fn()}
        pendingMonth={null}
        replicateFromPreviousMonthDialogOpen={false}
        replicateFromPreviousMonthOptions={[]}
        rows={rows}
        selectedReplicableOptionIds={[]}
        sheetMode="create"
        showCopyFromControls={false}
        showUnsavedChangesDialog={false}
        validationMessage={null}
      />
    </TooltipProvider>,
  );
}

async function openQuickEditDialog({
  triggerLabel,
  menuItemLabel,
}: {
  triggerLabel: string;
  menuItemLabel: string;
}) {
  const user = userEvent.setup();

  await user.click(screen.getByRole("button", { name: triggerLabel }));
  await user.click(screen.getByRole("menuitem", { name: menuItemLabel }));
}

describe("MonthlyExpensesTable dialog autofocus", () => {
  it("toggles visible row selection when clicking the header selection cell", async () => {
    const user = userEvent.setup();

    renderMonthlyExpensesTable([
      createRow({ description: "Internet", id: "expense-1" }),
      createRow({ description: "Luz", id: "expense-2" }),
    ]);

    await user.click(
      screen.getByRole("columnheader", {
        name: "Seleccionar todas las filas visibles",
      }),
    );

    expect(
      screen.getByRole("checkbox", { name: "Seleccionar compromiso Internet" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Seleccionar compromiso Luz" }),
    ).toBeChecked();
  });

  it("renders loan direction as its own column", () => {
    renderMonthlyExpensesTable([
      createRow({
        description: "Prestamo a proveedor",
        installmentCount: "3",
        isLoan: true,
        lenderId: "lender-1",
        lenderName: "Proveedor",
        loanDirection: "receivable",
        loanProgress: "1 de 3 cuotas abonadas",
        loanRemainingInstallments: 2,
        loanTotalInstallments: 3,
        startMonth: "2026-01",
      }),
    ]);

    expect(
      screen.getByRole("columnheader", { name: "Dirección" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Me deben")).toBeInTheDocument();
  });

  it("associates receipt label with the file input in register payment dialog", async () => {
    renderMonthlyExpensesTable([createRow()]);

    const user = userEvent.setup();
    const registerPaymentButtons = screen.getAllByRole("button", {
      name: "Agregar nuevo registro de pago para Internet",
    });

    await user.click(registerPaymentButtons[0]);

    expect(
      screen.getByLabelText("Adjuntar comprobante (opcional):"),
    ).toHaveAttribute("type", "file");
  });

  it("focuses subtotal input when opening the details edit dialog", async () => {
    renderMonthlyExpensesTable([createRow()]);

    await openQuickEditDialog({
      menuItemLabel: "Editar subtotal y cantidad",
      triggerLabel: "Abrir acciones de subtotal y cantidad para Internet",
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Subtotal de Internet")).toHaveFocus();
    });
  });

  it("renders subtotal, unit, quantity and duration fields in the details dialog", async () => {
    renderMonthlyExpensesTable([createRow()]);

    await openQuickEditDialog({
      menuItemLabel: "Editar subtotal y cantidad",
      triggerLabel: "Abrir acciones de subtotal y cantidad para Internet",
    });

    expect(screen.getByLabelText("Subtotal de Internet")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Unidad del subtotal de Internet"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Cantidad por mes de Internet"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Duración por ocurrencia en horas de Internet"),
    ).toBeInTheDocument();
  });

  it("focuses payment link input when opening payment link dialog", async () => {
    renderMonthlyExpensesTable([createRow()]);

    const user = userEvent.setup();

    await user.click(
      screen.getByRole("button", { name: "Agregar link de pago para Internet" }),
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Link de pago de Internet")).toHaveFocus();
    });
  });

  it("places the cursor at the end when focusing payment link textarea", async () => {
    renderMonthlyExpensesTable([
      createRow({
        paymentLink: "https://example.com/checkout",
      }),
    ]);

    await openQuickEditDialog({
      menuItemLabel: "Editar link de pago",
      triggerLabel: "Abrir acciones de link de pago para Internet",
    });

    await waitFor(() => {
      const paymentLinkTextarea = screen.getByLabelText(
        "Link de pago de Internet",
      ) as HTMLTextAreaElement;

      expect(paymentLinkTextarea).toHaveFocus();
      expect(paymentLinkTextarea.selectionStart).toBe(
        paymentLinkTextarea.value.length,
      );
      expect(paymentLinkTextarea.selectionEnd).toBe(
        paymentLinkTextarea.value.length,
      );
    });
  });

  it("focuses receipt share phone input when opening receipt share dialog", async () => {
    renderMonthlyExpensesTable([createRow()]);

    const user = userEvent.setup();

    await user.click(
      screen.getByRole("button", {
        name: "Agregar datos de envío para Internet",
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByLabelText("Número de WhatsApp de Internet"),
      ).toHaveFocus();
    });
  });

  it("shows the quantity multiplier with its unit when occurrences are greater than one", () => {
    renderMonthlyExpensesTable([
      createRow({ occurrencesPerMonth: "9", occurrencesUnit: "sesiones" }),
    ]);

    expect(screen.getByText("× 9 sesiones")).toBeInTheDocument();
  });

  it("falls back to the default unit when none is set", () => {
    renderMonthlyExpensesTable([
      createRow({ occurrencesPerMonth: "4", occurrencesUnit: "" }),
    ]);

    expect(screen.getByText("× 4 veces")).toBeInTheDocument();
  });

  it("shows the per-occurrence duration when the unit carries one", () => {
    renderMonthlyExpensesTable([
      createRow({ occurrencesPerMonth: "2", occurrencesUnit: "veces de 4h 30" }),
    ]);

    expect(screen.getByText("× 2 veces de 4h 30m")).toBeInTheDocument();
  });

  it("hides the quantity multiplier when occurrences equal one without a duration", () => {
    renderMonthlyExpensesTable([
      createRow({ occurrencesPerMonth: "1", occurrencesUnit: "" }),
    ]);

    expect(screen.queryByText(/^×\s/)).not.toBeInTheDocument();
  });

  it("shows the singular multiplier with duration when occurrences equal one", () => {
    renderMonthlyExpensesTable([
      createRow({ occurrencesPerMonth: "1", occurrencesUnit: "veces de 4h 30" }),
    ]);

    expect(screen.getByText("× 1 vez de 4h 30m")).toBeInTheDocument();
  });

  it("keeps the duration field without a unit select for a single occurrence", async () => {
    renderMonthlyExpensesTable([
      createRow({ occurrencesPerMonth: "1", occurrencesUnit: "" }),
    ]);

    await openQuickEditDialog({
      menuItemLabel: "Editar subtotal y cantidad",
      triggerLabel: "Abrir acciones de subtotal y cantidad para Internet",
    });

    expect(screen.queryByLabelText("Unidad de Internet")).not.toBeInTheDocument();
    expect(
      screen.getByLabelText("Duración por ocurrencia en horas de Internet"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Duración por ocurrencia en minutos de Internet"),
    ).toBeInTheDocument();
  });

  it("saves subtotal, unit, quantity and duration together from the details dialog", async () => {
    const user = userEvent.setup();
    const onUpdateExpenseDetails = jest.fn();

    renderMonthlyExpensesTable(
      [
        createRow({
          occurrencesPerMonth: "1",
          occurrencesUnit: "",
          subtotal: "5000",
        }),
      ],
      { onUpdateExpenseDetails },
    );

    await openQuickEditDialog({
      menuItemLabel: "Editar subtotal y cantidad",
      triggerLabel: "Abrir acciones de subtotal y cantidad para Internet",
    });

    await user.clear(screen.getByLabelText("Cantidad por mes de Internet"));
    await user.type(screen.getByLabelText("Cantidad por mes de Internet"), "2");
    await user.type(
      screen.getByLabelText("Duración por ocurrencia en horas de Internet"),
      "4",
    );
    await user.type(
      screen.getByLabelText("Duración por ocurrencia en minutos de Internet"),
      "30",
    );
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(onUpdateExpenseDetails).toHaveBeenCalledWith({
      expenseId: "expense-1",
      occurrencesPerMonth: 2,
      occurrencesUnit: "veces de 4h 30",
      subtotal: 5000,
      subtotalUnit: "occurrence",
    });
  });

  it("saves the hourly subtotal unit selected in the details dialog", async () => {
    const user = userEvent.setup();
    const onUpdateExpenseDetails = jest.fn();

    renderMonthlyExpensesTable(
      [
        createRow({
          occurrencesPerMonth: "2",
          occurrencesUnit: "veces de 4h 30",
          subtotal: "5000",
        }),
      ],
      { onUpdateExpenseDetails },
    );

    await openQuickEditDialog({
      menuItemLabel: "Editar subtotal y cantidad",
      triggerLabel: "Abrir acciones de subtotal y cantidad para Internet",
    });

    await user.click(screen.getByLabelText("Unidad del subtotal de Internet"));
    await user.click(screen.getByRole("option", { name: "Por hora" }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(onUpdateExpenseDetails).toHaveBeenCalledWith({
      expenseId: "expense-1",
      occurrencesPerMonth: 2,
      occurrencesUnit: "veces de 4h 30",
      subtotal: 5000,
      subtotalUnit: "hour",
    });
  });
});
