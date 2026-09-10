import { vi, describe, it, expect } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";

import { ExpenseReceiptUploadDialog } from "./expense-receipt-upload-dialog";

type DialogProps = ComponentProps<typeof ExpenseReceiptUploadDialog>;

function renderExpenseReceiptUploadDialog(overrides: Partial<DialogProps> = {}) {
  const onUpload = vi.fn<(...args: [
    {
      coveredPayments: number;
      file: File;
    },
  ]) => Promise<void>>().mockResolvedValue(undefined);

  const props: DialogProps = {
    coveredPaymentsMax: 4,
    coveredPaymentsRemaining: 3,
    errorMessage: null,
    expenseDescription: "Internet",
    isOpen: true,
    isSubmitting: false,
    uploadProgressPercent: 0,
    onClose: vi.fn(),
    onUpload,
    ...overrides,
  };

  render(<ExpenseReceiptUploadDialog {...props} />);

  return {
    onUpload,
  };
}

describe("ExpenseReceiptUploadDialog", () => {
  /**
   * Returns the accessible file input rendered by the receipt uploader.
   *
   * @returns The receipt file input element.
   */
  function getReceiptFileInput(): HTMLInputElement {
    const fileInput = screen.getByLabelText("Comprobante para Internet");

    if (!(fileInput instanceof HTMLInputElement)) {
      throw new Error("File input not found");
    }

    return fileInput;
  }

  it("uses a scrollable dialog container for small viewport heights", () => {
    renderExpenseReceiptUploadDialog();

    expect(screen.getByRole("dialog")).toHaveClass("dialogContent");
  });

  it("hides coverage choices when only one payment remains to be covered", () => {
    renderExpenseReceiptUploadDialog({
      coveredPaymentsMax: 1,
      coveredPaymentsRemaining: 1,
    });

    expect(
      screen.queryByText("Elegí cómo aplicar este comprobante:"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("radio", { name: "Todo el periodo" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("radio", { name: "Cobertura parcial" }),
    ).not.toBeInTheDocument();
  });

  it("renders coverage choices as descriptive cards when more than one payment remains", () => {
    renderExpenseReceiptUploadDialog({
      coveredPaymentsMax: 4,
      coveredPaymentsRemaining: 3,
    });

    expect(
      screen.getByText("Elegí cómo aplicar este comprobante:"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "Todo el periodo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "El comprobante cubre 3 pagos pendientes de un total de 4 pagos en este mes.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "Cobertura parcial" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "El comprobante cubre solo la cantidad de pagos que indiques manualmente.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the partial covered payments label and sends custom quantity", async () => {
    const user = userEvent.setup();
    const { onUpload } = renderExpenseReceiptUploadDialog({
      coveredPaymentsMax: 4,
      coveredPaymentsRemaining: 3,
    });

    await user.click(screen.getByRole("radio", { name: "Cobertura parcial" }));

    const partialInput = screen.getByRole("spinbutton", {
      name: "Cantidad de pagos a cubrir",
    });

    await user.clear(partialInput);
    await user.type(partialInput, "2");

    const file = new File(["invoice"], "factura.pdf", {
      type: "application/pdf",
    });

    await user.upload(getReceiptFileInput(), file);
    await user.click(screen.getByRole("button", { name: "Subir comprobante" }));

    await waitFor(() => {
      expect(onUpload).toHaveBeenCalledTimes(1);
    });

    expect(onUpload).toHaveBeenCalledWith({
      coveredPayments: 2,
      file,
    });
  });

  it("validates partial coverage against remaining payments", async () => {
    const user = userEvent.setup();

    renderExpenseReceiptUploadDialog({
      coveredPaymentsMax: 8,
      coveredPaymentsRemaining: 3,
    });

    await user.click(screen.getByRole("radio", { name: "Cobertura parcial" }));

    const partialInput = screen.getByRole("spinbutton", {
      name: "Cantidad de pagos a cubrir",
    });

    await user.clear(partialInput);
    await user.type(partialInput, "4");

    expect(
      screen.getByText("Ingresá una cantidad de pagos válida entre 1 y 3."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Subir comprobante" }),
    ).toBeDisabled();
  });

  it("uploads one payment by default when coverage choices are hidden", async () => {
    const user = userEvent.setup();
    const { onUpload } = renderExpenseReceiptUploadDialog({
      coveredPaymentsMax: 1,
      coveredPaymentsRemaining: 1,
    });

    const file = new File(["invoice"], "factura.pdf", {
      type: "application/pdf",
    });

    await user.upload(getReceiptFileInput(), file);
    await user.click(screen.getByRole("button", { name: "Subir comprobante" }));

    await waitFor(() => {
      expect(onUpload).toHaveBeenCalledTimes(1);
    });

    expect(onUpload).toHaveBeenCalledWith({
      coveredPayments: 1,
      file,
    });
  });

  it("accepts a receipt file through drag and drop", async () => {
    const user = userEvent.setup();
    const { onUpload } = renderExpenseReceiptUploadDialog();
    const file = new File(["invoice"], "factura.pdf", {
      type: "application/pdf",
    });
    const dropZone = document.querySelector("[data-dropzone]");

    if (!(dropZone instanceof HTMLDivElement)) {
      throw new Error("Drop zone not found");
    }

    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [file],
      },
    });

    await user.click(screen.getByRole("button", { name: "Subir comprobante" }));

    await waitFor(() => {
      expect(onUpload).toHaveBeenCalledTimes(1);
    });
    expect(onUpload).toHaveBeenCalledWith({
      coveredPayments: 3,
      file,
    });
  });

  it("shows live upload progress percentage while submitting", async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn<(...args: [
      {
        coveredPayments: number;
        file: File;
      },
    ]) => Promise<void>>().mockResolvedValue(undefined);
    const baseProps: DialogProps = {
      coveredPaymentsMax: 4,
      coveredPaymentsRemaining: 3,
      errorMessage: null,
      expenseDescription: "Internet",
      isOpen: true,
      isSubmitting: false,
      onClose: vi.fn(),
      onUpload,
      uploadProgressPercent: 0,
    };
    const { rerender } = render(<ExpenseReceiptUploadDialog {...baseProps} />);

    const file = new File(["invoice"], "factura.pdf", {
      type: "application/pdf",
    });

    await user.upload(getReceiptFileInput(), file);
    rerender(
      <ExpenseReceiptUploadDialog
        {...baseProps}
        isSubmitting
        uploadProgressPercent={73}
      />,
    );

    expect(screen.getByText("73%")).toBeInTheDocument();
  });

  it("shows uploader failed state when upload error message is present", async () => {
    const user = userEvent.setup();
    const baseProps: DialogProps = {
      coveredPaymentsMax: 4,
      coveredPaymentsRemaining: 3,
      errorMessage: null,
      expenseDescription: "Internet",
      isOpen: true,
      isSubmitting: false,
      onClose: vi.fn(),
      onUpload: vi.fn().mockResolvedValue(undefined),
      uploadProgressPercent: 0,
    };
    const { rerender } = render(<ExpenseReceiptUploadDialog {...baseProps} />);
    const file = new File(["invoice"], "factura.pdf", {
      type: "application/pdf",
    });

    await user.upload(getReceiptFileInput(), file);

    rerender(
      <ExpenseReceiptUploadDialog
        {...baseProps}
        errorMessage="No se pudo subir el comprobante"
      />,
    );

    expect(
      screen.getByText("Upload failed, please try again"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo subir el comprobante");
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    expect(screen.queryByText("100%")).not.toBeInTheDocument();
  });

  it("clears selected file when remove is clicked", async () => {
    const user = userEvent.setup();

    renderExpenseReceiptUploadDialog();

    const file = new File(["invoice"], "factura.pdf", {
      type: "application/pdf",
    });
    await user.upload(getReceiptFileInput(), file);

    expect(screen.getByText("factura.pdf")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.queryByText("factura.pdf")).not.toBeInTheDocument();
  });

  it("resets selected file when the dialog is reopened", async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn<(...args: [
      {
        coveredPayments: number;
        file: File;
      },
    ]) => Promise<void>>().mockResolvedValue(undefined);
    const baseProps: DialogProps = {
      coveredPaymentsMax: 4,
      coveredPaymentsRemaining: 3,
      errorMessage: null,
      expenseDescription: "Internet",
      isOpen: true,
      isSubmitting: false,
      onClose: vi.fn(),
      onUpload,
      uploadProgressPercent: 0,
    };
    const { rerender } = render(<ExpenseReceiptUploadDialog {...baseProps} />);
    const file = new File(["invoice"], "factura.pdf", {
      type: "application/pdf",
    });

    await user.upload(getReceiptFileInput(), file);
    expect(screen.getByText("factura.pdf")).toBeInTheDocument();

    rerender(<ExpenseReceiptUploadDialog {...baseProps} isOpen={false} />);
    rerender(<ExpenseReceiptUploadDialog {...baseProps} isOpen={true} />);

    expect(screen.queryByText("factura.pdf")).not.toBeInTheDocument();
  });
});
