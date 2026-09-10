import { vi, describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { selectDropdownSubmenuItem } from "@/tests/utils/radix-menu-test-helpers";

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

  it("duplicates the expense in the current month from the submenu", async () => {
    const onDuplicate = vi.fn();
    renderExpenseRowActions({ onDuplicate });

    const user = await openActionsMenu();
    await selectDropdownSubmenuItem(user, "Duplicar", "En este mes");

    expect(onDuplicate).toHaveBeenCalledTimes(1);
  });

  it("offers duplicating into the next month and picking a month", async () => {
    renderExpenseRowActions();

    const user = await openActionsMenu();
    await user.click(screen.getByRole("menuitem", { name: "Duplicar" }));

    expect(
      await screen.findByRole("menuitem", { name: "En el mes siguiente" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Elegir mes…" }),
    ).toBeInTheDocument();
  });

  it("does not offer a recurrence submenu for a non-recurring expense", async () => {
    renderExpenseRowActions({ isRecurring: false });
    await openActionsMenu();

    expect(
      screen.queryByRole("menuitem", { name: "Recurrencia" }),
    ).not.toBeInTheDocument();
  });

  it("groups payment link actions in a submenu", async () => {
    const onManagePaymentLink = vi.fn();
    renderExpenseRowActions({ hasPaymentLink: true, onManagePaymentLink });

    const user = await openActionsMenu();

    expect(
      screen.queryByRole("menuitem", { name: "Editar link de pago" }),
    ).not.toBeInTheDocument();

    await selectDropdownSubmenuItem(user, "Link de pago", "Editar link de pago");

    await waitFor(() => {
      expect(onManagePaymentLink).toHaveBeenCalledTimes(1);
    });
  });

  it("offers adding a payment link from the submenu when there is none", async () => {
    const onManagePaymentLink = vi.fn();
    renderExpenseRowActions({ hasPaymentLink: false, onManagePaymentLink });

    const user = await openActionsMenu();
    await selectDropdownSubmenuItem(
      user,
      "Link de pago",
      "Agregar link de pago",
    );

    await waitFor(() => {
      expect(onManagePaymentLink).toHaveBeenCalledTimes(1);
    });
  });

  it("does not offer a folders submenu without folder references", async () => {
    renderExpenseRowActions();
    await openActionsMenu();

    expect(
      screen.queryByRole("menuitem", { name: "Carpetas" }),
    ).not.toBeInTheDocument();
  });

  it("groups folder actions in a submenu", async () => {
    renderExpenseRowActions({
      monthlyFolderViewUrl: "https://drive.google.com/folder/abc",
    });

    const user = await openActionsMenu();
    await user.click(screen.getByRole("menuitem", { name: "Carpetas" }));

    expect(
      await screen.findByRole("menuitem", { name: "Comprobantes del mes" }),
    ).toBeInTheDocument();
  });

  it("cancels an active recurrence after confirming", async () => {
    const onCancelRecurrence = vi.fn();
    renderExpenseRowActions({
      isRecurring: true,
      isRecurrenceCancelled: false,
      onCancelRecurrence,
    });

    const user = await openActionsMenu();
    await selectDropdownSubmenuItem(user, "Recurrencia", "Cancelar recurrencia");
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
    await selectDropdownSubmenuItem(
      user,
      "Recurrencia",
      "Reactivar recurrencia",
    );

    await waitFor(() => {
      expect(onReactivateRecurrence).toHaveBeenCalledTimes(1);
    });
  });
});
