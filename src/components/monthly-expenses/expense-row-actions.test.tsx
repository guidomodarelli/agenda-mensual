import { render, screen } from "@testing-library/react";
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
    onCancelRecurrence: jest.fn(),
    onDeleteAllReceiptsFolderReference: jest.fn(),
    onDelete: jest.fn(),
    onDeleteMonthlyFolderReference: jest.fn(),
    onDeletePaymentLink: jest.fn(),
    onEdit: jest.fn(),
    onManagePaymentLink: jest.fn(),
    onReactivateRecurrence: jest.fn(),
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

  it("cancels an active recurrence after confirming", async () => {
    const onCancelRecurrence = jest.fn();
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
      screen.getByRole("button", {
        name: "Confirmar cancelación de la recurrencia para Alquiler",
      }),
    );

    expect(onCancelRecurrence).toHaveBeenCalledTimes(1);
  });

  it("reactivates a cancelled recurrence immediately", async () => {
    const onReactivateRecurrence = jest.fn();
    renderExpenseRowActions({
      isRecurring: true,
      isRecurrenceCancelled: true,
      onReactivateRecurrence,
    });

    const user = await openActionsMenu();
    await user.click(
      screen.getByRole("menuitem", { name: "Reactivar recurrencia" }),
    );

    expect(onReactivateRecurrence).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("menuitem", { name: "Cancelar recurrencia" }),
    ).not.toBeInTheDocument();
  });
});
