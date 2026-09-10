import { vi, describe, it, expect } from "vitest";
import { TooltipProvider } from "beez-ui";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { MonthlyExpensesEditableRow } from "./monthly-expenses-table";
import { ExpenseSheet } from "./expense-sheet";

function createDraftRow(): MonthlyExpensesEditableRow {
  return {
    allReceiptsFolderId: "",
    allReceiptsFolderViewUrl: "",
    currency: "ARS",
    description: "Internet",
    expenseFolderId: "",
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
    sortOrder: null,
    startMonth: "",
    subtotal: "100",
    subtotalUnit: "occurrence",
    total: "100.00",
    usdRate: {
      appliesIibb: true,
      appliesIva: false,
      base: "official" as const,
      customRate: null,
    },
  };
}

function renderExpenseSheet({
  changedFields = new Set<string>(),
  draft = createDraftRow(),
  mode = "create",
  onFieldChange = vi.fn(),
  onLoanToggle = vi.fn(),
  onOpenExpenseDetails,
}: {
  changedFields?: Set<string>;
  draft?: MonthlyExpensesEditableRow;
  mode?: "create" | "edit";
  onFieldChange?: (fieldName: string, value: string) => void;
  onLoanToggle?: (checked: boolean) => void;
  onOpenExpenseDetails?: () => void;
}) {
  return render(
    <TooltipProvider>
      <ExpenseSheet
        actionDisabled={false}
        changedFields={changedFields}
        draft={draft}
        expenseFolders={[]}
        isOpen={true}
        isSubmitting={false}
        lenders={[]}
        mode={mode}
        onAddLender={vi.fn()}
        onFieldChange={onFieldChange}
        onFolderSelect={vi.fn()}
        onManageFolders={vi.fn()}
        onLenderSelect={vi.fn()}
        onLoanToggle={onLoanToggle}
        onOpenExpenseDetails={onOpenExpenseDetails}
        onRecurringToggle={vi.fn()}
        onReceiptShareToggle={vi.fn()}
        onRequestClose={vi.fn()}
        onSave={vi.fn()}
        onUnsavedChangesClose={vi.fn()}
        onUnsavedChangesDiscard={vi.fn()}
        onUnsavedChangesSave={vi.fn()}
        showUnsavedChangesDialog={false}
        validationMessage={null}
      />
    </TooltipProvider>,
  );
}

describe("ExpenseSheet", () => {
  it("does not render manual covered payments or payment link inputs in the modal", () => {
    renderExpenseSheet({ mode: "create" });

    expect(screen.getByText("Frecuencia de pago")).toBeInTheDocument();
    expect(
      screen.queryByText("Pagos manuales (sin comprobante)"),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Pagos manuales")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Link de pago")).not.toBeInTheDocument();
    expect(screen.queryByText("Link de pago (Opcional)")).not.toBeInTheDocument();
  });

  it("shows the per-occurrence duration when the expense is paid multiple times per month", () => {
    renderExpenseSheet({
      draft: {
        ...createDraftRow(),
        occurrencesPerMonth: "4",
        occurrencesUnit: "veces de 4h 30",
      },
      mode: "create",
    });

    expect(
      screen.getByLabelText("Duración por ocurrencia en horas"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Unidad")).not.toBeInTheDocument();
  });

  it("hides the per-occurrence duration for a single monthly payment", () => {
    renderExpenseSheet({ mode: "create" });

    expect(
      screen.queryByLabelText("Duración por ocurrencia en horas"),
    ).not.toBeInTheDocument();
  });

  it("shows the subtotal unit select in create mode", () => {
    renderExpenseSheet({ mode: "create" });

    expect(
      screen.getByLabelText("Unidad del subtotal"),
    ).toBeInTheDocument();
  });

  it("changes the subtotal unit to hourly pricing", async () => {
    const user = userEvent.setup();
    const onFieldChange = vi.fn();

    renderExpenseSheet({ mode: "create", onFieldChange });

    await user.click(screen.getByLabelText("Unidad del subtotal"));
    await user.click(screen.getByRole("option", { name: "Por hora" }));

    expect(onFieldChange).toHaveBeenCalledWith("subtotalUnit", "hour");
  });

  it("selects a payment frequency option by clicking anywhere on its row", async () => {
    const user = userEvent.setup();
    const onFieldChange = vi.fn();

    renderExpenseSheet({ mode: "create", onFieldChange });

    // Click sobre la descripción (no sobre el radio ni el label).
    await user.click(
      screen.getByText(/clases de ingles, psicologa o empleada domestica/),
    );

    expect(onFieldChange).toHaveBeenCalledWith("occurrencesPerMonth", "2");
  });

  it("shows the monthly duration instead of the frequency field for an hourly subtotal", () => {
    renderExpenseSheet({
      draft: {
        ...createDraftRow(),
        occurrencesUnit: "veces de 2h",
        subtotalUnit: "hour",
      },
      mode: "create",
    });

    expect(screen.getByText("Duración mensual")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Duración mensual en horas"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Frecuencia de pago")).not.toBeInTheDocument();
  });

  it("requires a monthly duration before saving an hourly subtotal", async () => {
    const user = userEvent.setup();

    renderExpenseSheet({
      draft: {
        ...createDraftRow(),
        occurrencesUnit: "",
        subtotalUnit: "hour",
      },
      mode: "create",
    });

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(
      screen.getByText("Completá la duración mensual."),
    ).toBeInTheDocument();
  });

  it("shows a read-only summary with a details shortcut when editing", async () => {
    const user = userEvent.setup();
    const onOpenExpenseDetails = vi.fn();

    renderExpenseSheet({
      draft: {
        ...createDraftRow(),
        currency: "USD",
        subtotal: "144",
        total: "144.00",
        usdRate: {
          appliesIibb: false,
          appliesIva: true,
          base: "blue",
          customRate: null,
        },
      },
      mode: "edit",
      onOpenExpenseDetails,
    });

    const summary = screen.getByRole("region", { name: "Resumen del gasto" });
    const summaryText = summary.textContent?.replace(/\s/g, " ") ?? "";

    expect(summaryText).toContain("USD");
    expect(summaryText).toContain("US$ 144");
    expect(summaryText).toContain("1 por mes");
    expect(summaryText).toContain("blue + IVA");

    await user.click(
      screen.getByRole("button", { name: "Editar subtotal y cantidad" }),
    );

    expect(onOpenExpenseDetails).toHaveBeenCalled();
  });

  it("does not show the summary block in create mode", () => {
    renderExpenseSheet({ mode: "create" });

    expect(
      screen.queryByRole("region", { name: "Resumen del gasto" }),
    ).not.toBeInTheDocument();
  });

  it("hides duplicated inline-edit fields when editing an expense", () => {
    renderExpenseSheet({
      draft: {
        ...createDraftRow(),
        receiptShareMessage: "Mensaje de prueba",
        receiptSharePhoneDigits: "5491123456789",
        requiresReceiptShare: true,
      },
      mode: "edit",
    });

    expect(screen.queryByLabelText("Moneda")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Subtotal")).not.toBeInTheDocument();
    expect(screen.queryByText("Frecuencia de pago")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Total")).not.toBeInTheDocument();
  });

  // The refactor unified the per-payment send recipient, and the
  // "¿Necesitas enviar el comprobante a alguien?" section is now shown in edit
  // mode too (previously create only), so its presence is asserted here.
  it("shows the receipt share section with phone and message when editing an expense", () => {
    renderExpenseSheet({
      draft: {
        ...createDraftRow(),
        receiptShareMessage: "Mensaje de prueba",
        receiptSharePhoneDigits: "5491123456789",
        requiresReceiptShare: true,
      },
      mode: "edit",
    });

    expect(
      screen.getByLabelText("¿Necesitas enviar el comprobante a alguien?"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Número de teléfono (WhatsApp)"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Mensaje personalizado (opcional)"),
    ).toBeInTheDocument();
  });

  it("derives the loan direction from the self-lender toggle", async () => {
    const user = userEvent.setup();
    const onFieldChange = vi.fn();

    renderExpenseSheet({
      draft: {
        ...createDraftRow(),
        installmentCount: "3",
        isLoan: true,
        lenderId: "lender-1",
        lenderName: "Cliente",
        loanDirection: "receivable",
        startMonth: "2026-01",
      },
      onFieldChange,
    });

    const selfLenderToggle = screen.getByRole("checkbox", {
      name: "Yo soy el prestamista (me deben)",
    });

    expect(selfLenderToggle).toBeChecked();

    await user.click(selfLenderToggle);

    expect(onFieldChange).toHaveBeenCalledWith("loanDirection", "payable");
  });

  it("hides the loan checkbox while editing a non-loan expense", () => {
    renderExpenseSheet({
      mode: "edit",
    });

    expect(screen.queryByLabelText("Es deuda/préstamo")).not.toBeInTheDocument();
  });

  it("does not toggle loan state from the loan checkbox while editing a loan expense", async () => {
    const user = userEvent.setup();
    const onLoanToggle = vi.fn();

    renderExpenseSheet({
      draft: {
        ...createDraftRow(),
        installmentCount: "12",
        isLoan: true,
        lenderId: "lender-1",
        lenderName: "Banco Ciudad",
        startMonth: "2026-01",
      },
      mode: "edit",
      onLoanToggle,
    });

    const loanToggle = screen.getByLabelText("Es deuda/préstamo");
    expect(loanToggle).toBeDisabled();
    await user.click(loanToggle);

    expect(onLoanToggle).not.toHaveBeenCalled();
  });

  it("offers a recurring-expense toggle while creating", () => {
    renderExpenseSheet({ mode: "create" });

    expect(screen.getByLabelText("Gasto recurrente")).toBeInTheDocument();
  });

  it("shows the recurrence months when the expense is recurring", () => {
    renderExpenseSheet({
      draft: {
        ...createDraftRow(),
        isRecurring: true,
        recurrenceStartMonth: "2026-01",
      },
    });

    expect(
      screen.getByLabelText("Inicio de la recurrencia"),
    ).toHaveValue("2026-01");
    expect(
      screen.getByLabelText("Último mes de la recurrencia"),
    ).toBeInTheDocument();
  });

  it("hides the loan toggle when the expense is recurring", () => {
    renderExpenseSheet({
      draft: {
        ...createDraftRow(),
        isRecurring: true,
        recurrenceStartMonth: "2026-01",
      },
    });

    expect(screen.queryByLabelText("Es deuda/préstamo")).not.toBeInTheDocument();
  });

  it("hides the recurring toggle when the expense is a loan", () => {
    renderExpenseSheet({
      draft: {
        ...createDraftRow(),
        installmentCount: "6",
        isLoan: true,
        lenderId: "lender-1",
        lenderName: "Banco",
        startMonth: "2026-01",
      },
    });

    expect(screen.queryByLabelText("Gasto recurrente")).not.toBeInTheDocument();
  });

  it("toggles the recurring flag from the recurring checkbox while creating", async () => {
    const user = userEvent.setup();
    const onRecurringToggle = vi.fn();

    render(
      <TooltipProvider>
        <ExpenseSheet
          actionDisabled={false}
          changedFields={new Set()}
          draft={createDraftRow()}
          expenseFolders={[]}
          isOpen={true}
          isSubmitting={false}
          lenders={[]}
          mode="create"
          onAddLender={vi.fn()}
          onFieldChange={vi.fn()}
          onFolderSelect={vi.fn()}
          onManageFolders={vi.fn()}
          onLenderSelect={vi.fn()}
          onLoanToggle={vi.fn()}
          onRecurringToggle={onRecurringToggle}
          onReceiptShareToggle={vi.fn()}
          onRequestClose={vi.fn()}
          onSave={vi.fn()}
          onUnsavedChangesClose={vi.fn()}
          onUnsavedChangesDiscard={vi.fn()}
          onUnsavedChangesSave={vi.fn()}
          showUnsavedChangesDialog={false}
          validationMessage={null}
        />
      </TooltipProvider>,
    );

    await user.click(screen.getByLabelText("Gasto recurrente"));

    expect(onRecurringToggle).toHaveBeenCalledWith(true);
  });

  it("offers an enabled recurring toggle while editing a non-loan expense", () => {
    renderExpenseSheet({ mode: "edit" });

    const recurringToggle = screen.getByLabelText("Gasto recurrente");
    expect(recurringToggle).toBeInTheDocument();
    expect(recurringToggle).toBeEnabled();
  });

  it("converts an expense to recurring from the toggle while editing", async () => {
    const user = userEvent.setup();
    const onRecurringToggle = vi.fn();

    render(
      <TooltipProvider>
        <ExpenseSheet
          actionDisabled={false}
          changedFields={new Set()}
          draft={createDraftRow()}
          expenseFolders={[]}
          isOpen={true}
          isSubmitting={false}
          lenders={[]}
          mode="edit"
          onAddLender={vi.fn()}
          onFieldChange={vi.fn()}
          onFolderSelect={vi.fn()}
          onManageFolders={vi.fn()}
          onLenderSelect={vi.fn()}
          onLoanToggle={vi.fn()}
          onRecurringToggle={onRecurringToggle}
          onReceiptShareToggle={vi.fn()}
          onRequestClose={vi.fn()}
          onSave={vi.fn()}
          onUnsavedChangesClose={vi.fn()}
          onUnsavedChangesDiscard={vi.fn()}
          onUnsavedChangesSave={vi.fn()}
          showUnsavedChangesDialog={false}
          validationMessage={null}
        />
      </TooltipProvider>,
    );

    await user.click(screen.getByLabelText("Gasto recurrente"));

    expect(onRecurringToggle).toHaveBeenCalledWith(true);
  });

  it("keeps the recurring toggle disabled while editing an already-recurring expense", () => {
    renderExpenseSheet({
      draft: {
        ...createDraftRow(),
        isRecurring: true,
        recurrenceStartMonth: "2026-01",
      },
      mode: "edit",
    });

    expect(screen.getByLabelText("Gasto recurrente")).toBeDisabled();
  });

  it("keeps the recurring toggle enabled after converting an expense during this edit", () => {
    renderExpenseSheet({
      // The expense was just converted in this edit session, so isRecurring is in
      // changedFields — the toggle must stay enabled to allow undoing it.
      changedFields: new Set(["isRecurring"]),
      draft: {
        ...createDraftRow(),
        isRecurring: true,
        recurrenceStartMonth: "2026-03",
      },
      mode: "edit",
    });

    expect(screen.getByLabelText("Gasto recurrente")).toBeEnabled();
  });
});
