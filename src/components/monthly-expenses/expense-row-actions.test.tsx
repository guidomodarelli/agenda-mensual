import { vi, describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ExpenseRowActions } from "./expense-row-actions";

type ExpenseRowActionsProps = Parameters<typeof ExpenseRowActions>[0];

function renderExpenseRowActions(
  overrides: Partial<ExpenseRowActionsProps> = {},
) {
  const props: ExpenseRowActionsProps = {
    actionDisabled: false,
    allReceiptsFolderViewUrl: null,
    canDeleteAllReceiptsFolderReference: false,
    canDeleteMonthlyFolderReference: false,
    description: "Alquiler",
    hasPaymentLink: false,
    isRecurring: false,
    isRecurrenceCancelled: false,
    monthlyFolderViewUrl: null,
    onCancelRecurrence: vi.fn(),
    onDeleteAllReceiptsFolderReference: vi.fn(),
    onDelete: vi.fn(),
    onDeleteMonthlyFolderReference: vi.fn(),
    onDeletePaymentLink: vi.fn(),
    onDuplicate: vi.fn(),
    onDuplicateToNextMonth: vi.fn(),
    onDuplicateToPickedMonth: vi.fn(),
    onEdit: vi.fn(),
    onManagePaymentLink: vi.fn(),
    onReactivateRecurrence: vi.fn(),
    ...overrides,
  };

  render(<ExpenseRowActions {...props} />);

  return props;
}

async function openActionsMenu() {
  const user = userEvent.setup();

  await user.click(
    screen.getByRole("button", { name: "Abrir acciones para Alquiler" }),
  );

  return user;
}

describe("ExpenseRowActions", () => {
  it("keeps edit and delete at the menu root", async () => {
    renderExpenseRowActions();
    await openActionsMenu();

    expect(screen.getByRole("menuitem", { name: "Editar" })).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Eliminar" }),
    ).toBeInTheDocument();
  });

  it("duplicates the expense in the current month from the menu", async () => {
    const onDuplicate = vi.fn();
    renderExpenseRowActions({ onDuplicate });

    const user = await openActionsMenu();
    await user.click(
      screen.getByRole("menuitem", { name: "Duplicar en este mes" }),
    );

    expect(onDuplicate).toHaveBeenCalledTimes(1);
  });

  it("offers duplicating into the next month and picking a month", async () => {
    renderExpenseRowActions();

    await openActionsMenu();

    expect(
      screen.getByRole("menuitem", { name: "Duplicar en el mes siguiente" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Duplicar en otro mes…" }),
    ).toBeInTheDocument();
  });

  it("does not offer recurrence actions for a non-recurring expense", async () => {
    renderExpenseRowActions({ isRecurring: false });
    await openActionsMenu();

    expect(
      screen.queryByRole("menuitem", { name: "Cancelar recurrencia" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Reactivar recurrencia" }),
    ).not.toBeInTheDocument();
  });

  it("edits an existing payment link from the menu", async () => {
    const onManagePaymentLink = vi.fn();
    renderExpenseRowActions({ hasPaymentLink: true, onManagePaymentLink });

    const user = await openActionsMenu();

    expect(
      screen.queryByRole("menuitem", { name: "Agregar link de pago" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Eliminar link de pago" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("menuitem", { name: "Editar link de pago" }),
    );

    await waitFor(() => {
      expect(onManagePaymentLink).toHaveBeenCalledTimes(1);
    });
  });

  it("offers adding a payment link from the menu when there is none", async () => {
    const onManagePaymentLink = vi.fn();
    renderExpenseRowActions({ hasPaymentLink: false, onManagePaymentLink });

    const user = await openActionsMenu();
    await user.click(
      screen.getByRole("menuitem", { name: "Agregar link de pago" }),
    );

    await waitFor(() => {
      expect(onManagePaymentLink).toHaveBeenCalledTimes(1);
    });
  });

  it("does not offer folder actions without folder references", async () => {
    renderExpenseRowActions();
    await openActionsMenu();

    expect(
      screen.queryByRole("menuitem", { name: "Comprobantes del mes" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", {
        name: "Archivo histórico de comprobantes",
      }),
    ).not.toBeInTheDocument();
  });

  it("links to the monthly receipts folder from the menu", async () => {
    renderExpenseRowActions({
      monthlyFolderViewUrl: "https://drive.google.com/folder/abc",
    });

    await openActionsMenu();

    expect(
      screen.getByRole("menuitem", { name: "Comprobantes del mes" }),
    ).toHaveAttribute("href", "https://drive.google.com/folder/abc");
  });

  it("cancels an active recurrence after confirming", async () => {
    const onCancelRecurrence = vi.fn();
    renderExpenseRowActions({
      isRecurring: true,
      isRecurrenceCancelled: false,
      onCancelRecurrence,
    });

    const user = await openActionsMenu();
    await user.click(
      screen.getByRole("menuitem", { name: "Cancelar recurrencia" }),
    );
    await user.click(
      await screen.findByRole("button", {
        name: "Confirmar cancelación de la recurrencia para Alquiler",
      }),
    );

    expect(onCancelRecurrence).toHaveBeenCalledTimes(1);
  });

  it("reactivates a cancelled recurrence immediately", async () => {
    const onReactivateRecurrence = vi.fn();
    renderExpenseRowActions({
      isRecurring: true,
      isRecurrenceCancelled: true,
      onReactivateRecurrence,
    });

    const user = await openActionsMenu();
    await user.click(
      screen.getByRole("menuitem", { name: "Reactivar recurrencia" }),
    );

    await waitFor(() => {
      expect(onReactivateRecurrence).toHaveBeenCalledTimes(1);
    });
  });
});
