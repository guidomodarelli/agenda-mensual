import { vi, describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { ExpenseReceiptCoverageEditDialog } from "./expense-receipt-coverage-edit-dialog";

describe("ExpenseReceiptCoverageEditDialog", () => {
  it("associates the replacement receipt label with the uploader input", () => {
    render(
      <ExpenseReceiptCoverageEditDialog
        canManageReceipt
        currentCoveredPayments={1}
        errorMessage={null}
        expenseDescription="Internet"
        isOpen
        isSubmitting={false}
        maxCoveredPayments={3}
        receiptFileName={null}
        receiptFileViewUrl={null}
        onClose={vi.fn()}
        onDeleteReceipt={vi.fn().mockResolvedValue(undefined)}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const replacementLabel = screen.getByText("Adjuntar nuevo comprobante:");
    const fileInput = screen.getByLabelText(
      "Seleccionar nuevo comprobante para Internet",
    );

    expect(fileInput).toHaveAttribute("id", "receipt-replacement-file-input");
    expect(replacementLabel).toHaveAttribute("for", "receipt-replacement-file-input");
  });
});
