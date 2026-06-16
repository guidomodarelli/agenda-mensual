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
      "onUpdateExpenseDetails" | "onUpdatePaymentRecordSendStatus"
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
        onUpdateExpenseReceiptShare={jest.fn()}
        onUpdatePaymentLink={jest.fn()}
        onUpdatePaymentRecordSendStatus={jest.fn()}
        {...overrides}
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

  it("renders loan direction as a chip within the lender column", () => {
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
      screen.getByRole("columnheader", { name: "Prestamista" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "Dirección" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Me deben")).toBeInTheDocument();
  });

  it("merges installment start and end into a single vigencia column", () => {
    renderMonthlyExpensesTable([
      createRow({
        description: "Prestamo a proveedor",
        installmentCount: "3",
        isLoan: true,
        lenderId: "lender-1",
        lenderName: "Proveedor",
        loanDirection: "receivable",
        loanEndMonth: "2026-03",
        loanProgress: "1 de 3 cuotas abonadas",
        loanRemainingInstallments: 2,
        loanTotalInstallments: 3,
        startMonth: "2026-01",
      }),
    ]);

    expect(
      screen.getByRole("columnheader", { name: "Vigencia" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "Inicio cuota" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "Fin cuota" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("01/26")).toBeInTheDocument();
    expect(screen.getByText("03/26")).toBeInTheDocument();
  });

  it("filters loans by direction from the prestamista column", async () => {
    const user = userEvent.setup();

    renderMonthlyExpensesTable([
      createRow({
        description: "Deuda propia",
        id: "loan-payable",
        installmentCount: "3",
        isLoan: true,
        lenderId: "lender-1",
        lenderName: "Banco",
        loanDirection: "payable",
        loanEndMonth: "2026-08",
        loanPaidInstallments: 1,
        loanProgress: "1 de 3 cuotas abonadas",
        loanRemainingInstallments: 2,
        loanTotalInstallments: 3,
        startMonth: "2026-06",
      }),
      createRow({
        description: "Prestamo a tercero",
        id: "loan-receivable",
        installmentCount: "4",
        isLoan: true,
        lenderId: "lender-2",
        lenderName: "Cliente",
        loanDirection: "receivable",
        loanEndMonth: "2026-09",
        loanPaidInstallments: 2,
        loanProgress: "2 de 4 cuotas abonadas",
        loanRemainingInstallments: 2,
        loanTotalInstallments: 4,
        startMonth: "2026-05",
      }),
    ]);

    await user.click(screen.getByRole("button", { name: "Filtros avanzados" }));
    await user.click(screen.getByRole("combobox", { name: "Dirección" }));
    await user.click(screen.getByRole("option", { name: "Me deben" }));
    await user.click(screen.getByRole("button", { name: "Aplicar" }));

    expect(screen.queryByText("Deuda propia")).not.toBeInTheDocument();
    expect(screen.getByText("Prestamo a tercero")).toBeInTheDocument();
  });

  it("filters loans by their vigencia range", async () => {
    const user = userEvent.setup();

    renderMonthlyExpensesTable([
      createRow({
        description: "Cuota marzo",
        id: "loan-march",
        installmentCount: "3",
        isLoan: true,
        lenderId: "lender-1",
        lenderName: "Banco",
        loanDirection: "payable",
        loanEndMonth: "2026-05",
        loanPaidInstallments: 1,
        loanProgress: "1 de 3 cuotas abonadas",
        loanRemainingInstallments: 2,
        loanTotalInstallments: 3,
        startMonth: "2026-03",
      }),
      createRow({
        description: "Cuota agosto",
        id: "loan-august",
        installmentCount: "3",
        isLoan: true,
        lenderId: "lender-1",
        lenderName: "Banco",
        loanDirection: "payable",
        loanEndMonth: "2026-10",
        loanPaidInstallments: 1,
        loanProgress: "1 de 3 cuotas abonadas",
        loanRemainingInstallments: 2,
        loanTotalInstallments: 3,
        startMonth: "2026-08",
      }),
    ]);

    await user.click(screen.getByRole("button", { name: "Filtros avanzados" }));
    await user.click(screen.getByRole("combobox", { name: "Vigencia" }));
    await user.click(screen.getByRole("option", { name: "Rango" }));
    await user.type(
      screen.getByRole("textbox", { name: "Vigencia Desde (MM/AAAA)" }),
      "02/2026",
    );
    await user.type(
      screen.getByRole("textbox", { name: "Vigencia Hasta (MM/AAAA)" }),
      "06/2026",
    );
    await user.click(screen.getByRole("button", { name: "Aplicar" }));

    expect(screen.getByText("Cuota marzo")).toBeInTheDocument();
    expect(screen.queryByText("Cuota agosto")).not.toBeInTheDocument();
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

  it("renders subtotal, unit and quantity fields without duration for an occurrence subtotal", async () => {
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
      screen.queryByLabelText("Duración mensual en horas de Internet"),
    ).not.toBeInTheDocument();
  });

  it("swaps quantity for the monthly duration when the subtotal is hourly", async () => {
    const user = userEvent.setup();

    renderMonthlyExpensesTable([createRow()]);

    await openQuickEditDialog({
      menuItemLabel: "Editar subtotal y cantidad",
      triggerLabel: "Abrir acciones de subtotal y cantidad para Internet",
    });

    await user.click(screen.getByLabelText("Unidad del subtotal de Internet"));
    await user.click(screen.getByRole("option", { name: "Por hora" }));

    expect(
      screen.queryByLabelText("Cantidad por mes de Internet"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByLabelText("Duración mensual en horas de Internet"),
    ).toBeInTheDocument();
    expect(screen.getByText("Duración mensual")).toBeInTheDocument();
  });

  it("focuses payment link input when opening payment link dialog", async () => {
    renderMonthlyExpensesTable([createRow()]);

    await openQuickEditDialog({
      menuItemLabel: "Agregar link de pago",
      triggerLabel: "Abrir acciones para Internet",
    });

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
      triggerLabel: "Abrir acciones para Internet",
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
    // The control to add receipt share data lives inside the "Registro de pagos"
    // popover. We load a payment record so we can open that popover and then open
    // the receipt share dialog.
    renderMonthlyExpensesTable([
      createRow({
        paymentRecords: [
          {
            coveredPayments: 1,
            id: "payment-1",
            receipt: {
              allReceiptsFolderId: "receipt-folder-id",
              allReceiptsFolderViewUrl:
                "https://drive.google.com/drive/folders/receipt-folder-id",
              coveredPayments: 1,
              fileId: "receipt-file-id",
              fileName: "comprobante.pdf",
              fileViewUrl:
                "https://drive.google.com/file/d/receipt-file-id/view",
              monthlyFolderId: "receipt-month-folder-id",
              monthlyFolderViewUrl:
                "https://drive.google.com/drive/folders/receipt-month-folder-id",
            },
            registeredAt: null,
          },
        ],
        requiresReceiptShare: true,
      }),
    ]);

    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /\d+ registros?/ }));
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

  it("shows the quantity multiplier with its unit and a monthly cadence", () => {
    renderMonthlyExpensesTable([
      createRow({ occurrencesPerMonth: "9", occurrencesUnit: "sesiones" }),
    ]);

    expect(screen.getByText("× 9 sesiones/mes")).toBeInTheDocument();
  });

  it("falls back to the default unit when none is set", () => {
    renderMonthlyExpensesTable([
      createRow({ occurrencesPerMonth: "4", occurrencesUnit: "" }),
    ]);

    expect(screen.getByText("× 4 veces/mes")).toBeInTheDocument();
  });

  it("omits the per-occurrence duration from an occurrence multiplier", () => {
    renderMonthlyExpensesTable([
      createRow({ occurrencesPerMonth: "2", occurrencesUnit: "veces de 4h 30" }),
    ]);

    expect(screen.getByText("× 2 veces/mes")).toBeInTheDocument();
    expect(screen.queryByText(/4h 30m/)).not.toBeInTheDocument();
  });

  it("omits the multiplier breakdown for a single monthly occurrence", () => {
    renderMonthlyExpensesTable([
      createRow({ occurrencesPerMonth: "1", occurrencesUnit: "" }),
    ]);

    expect(screen.queryByText("× 1 vez/mes")).not.toBeInTheDocument();
  });

  it("shows the hourly rate suffix and the monthly duration for an hourly subtotal", () => {
    renderMonthlyExpensesTable([
      createRow({
        occurrencesPerMonth: "1",
        occurrencesUnit: "veces de 2h",
        subtotalUnit: "hour",
      }),
    ]);

    expect(screen.getByText("/h")).toBeInTheDocument();
    expect(screen.getByText("× 2h/mes")).toBeInTheDocument();
  });

  it("saves subtotal and quantity from the details dialog for an occurrence subtotal", async () => {
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
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(onUpdateExpenseDetails).toHaveBeenCalledWith({
      expenseId: "expense-1",
      occurrencesPerMonth: 2,
      occurrencesUnit: "",
      subtotal: 5000,
      subtotalUnit: "occurrence",
    });
  });

  it("fixes the quantity to one and keeps the duration when saving an hourly subtotal", async () => {
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
      occurrencesPerMonth: 1,
      occurrencesUnit: "veces de 4h 30",
      subtotal: 5000,
      subtotalUnit: "hour",
    });
  });

  it("blocks saving an hourly subtotal without a monthly duration", async () => {
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

    await user.click(screen.getByLabelText("Unidad del subtotal de Internet"));
    await user.click(screen.getByRole("option", { name: "Por hora" }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(onUpdateExpenseDetails).not.toHaveBeenCalled();
    expect(screen.getByText("Completá la duración mensual.")).toBeInTheDocument();
  });

  it("invokes onUpdatePaymentRecordSendStatus when changing a payment send status in the popover", async () => {
    const user = userEvent.setup();
    const onUpdatePaymentRecordSendStatus = jest.fn();

    renderMonthlyExpensesTable(
      [
        createRow({
          paymentRecords: [
            {
              coveredPayments: 1,
              id: "payment-1",
              receipt: {
                allReceiptsFolderId: "receipt-folder-id",
                allReceiptsFolderViewUrl:
                  "https://drive.google.com/drive/folders/receipt-folder-id",
                coveredPayments: 1,
                fileId: "receipt-file-id",
                fileName: "comprobante.pdf",
                fileViewUrl:
                  "https://drive.google.com/file/d/receipt-file-id/view",
                monthlyFolderId: "receipt-month-folder-id",
                monthlyFolderViewUrl:
                  "https://drive.google.com/drive/folders/receipt-month-folder-id",
              },
              registeredAt: null,
              sendStatus: "pending",
            },
          ],
          requiresReceiptShare: true,
        }),
      ],
      { onUpdatePaymentRecordSendStatus },
    );

    await user.click(screen.getByRole("button", { name: /\d+ registros?/ }));
    await user.click(
      screen.getByRole("combobox", {
        name: "Estado de envío de Sin fecha — 1 pago para Internet",
      }),
    );
    await user.click(screen.getByRole("option", { name: "Enviado" }));

    expect(onUpdatePaymentRecordSendStatus).toHaveBeenCalledWith({
      expenseId: "expense-1",
      paymentRecordId: "payment-1",
      sendStatus: "sent",
    });
  });
});
