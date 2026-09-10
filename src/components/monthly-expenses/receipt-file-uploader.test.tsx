import { vi, describe, it, expect, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ReceiptFileUploader } from "./receipt-file-uploader";

describe("ReceiptFileUploader", () => {
  const receiptFile = new File(["receipt-content"], "comprobante.pdf", {
    type: "application/pdf",
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts simulated progress at 25 percent when upload starts without real progress", () => {
    render(
      <ReceiptFileUploader
        inputAriaLabel="Seleccionar comprobante"
        isUploading
        onFileChange={vi.fn()}
        selectedFile={receiptFile}
      />,
    );

    expect(screen.getByText("25%")).toBeInTheDocument();
  });

  it("keeps progress at 0 percent when a file is selected but upload did not start", () => {
    render(
      <ReceiptFileUploader
        inputAriaLabel="Seleccionar comprobante"
        onFileChange={vi.fn()}
        selectedFile={receiptFile}
      />,
    );

    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.queryByText("100%")).not.toBeInTheDocument();
  });

  it("advances simulated progress up to 90 percent while uploading", () => {
    vi.useFakeTimers();

    render(
      <ReceiptFileUploader
        inputAriaLabel="Seleccionar comprobante"
        isUploading
        onFileChange={vi.fn()}
        selectedFile={receiptFile}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.getByText("90%")).toBeInTheDocument();
  });

  it("prioritizes recent real upload progress over simulated progress", () => {
    const { rerender } = render(
      <ReceiptFileUploader
        inputAriaLabel="Seleccionar comprobante"
        isUploading
        onFileChange={vi.fn()}
        selectedFile={receiptFile}
        uploadProgressPercent={42}
      />,
    );

    expect(screen.getByText("42%")).toBeInTheDocument();

    rerender(
      <ReceiptFileUploader
        inputAriaLabel="Seleccionar comprobante"
        isUploading
        onFileChange={vi.fn()}
        selectedFile={receiptFile}
        uploadProgressPercent={73}
      />,
    );

    expect(screen.getByText("73%")).toBeInTheDocument();
  });

  it("falls back to simulated progress when real upload progress gets stuck", () => {
    vi.useFakeTimers();

    render(
      <ReceiptFileUploader
        inputAriaLabel="Seleccionar comprobante"
        isUploading
        onFileChange={vi.fn()}
        selectedFile={receiptFile}
        uploadProgressPercent={30}
      />,
    );

    expect(screen.getByText("30%")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.queryByText("30%")).not.toBeInTheDocument();
    expect(screen.getByText("49%")).toBeInTheDocument();
  });

  it("renders failed state when an upload error exists", () => {
    render(
      <ReceiptFileUploader
        errorMessage="Upload failed"
        inputAriaLabel="Seleccionar comprobante"
        onFileChange={vi.fn()}
        selectedFile={receiptFile}
      />,
    );

    expect(screen.getByText("Upload failed, please try again")).toBeInTheDocument();
    expect(screen.queryByText("Try again")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Upload failed");
    expect(screen.queryByText("100%")).not.toBeInTheDocument();
  });

  it("disables delete while uploading", async () => {
    const user = userEvent.setup();
    const onFileChange = vi.fn();

    render(
      <ReceiptFileUploader
        inputAriaLabel="Seleccionar comprobante"
        isUploading
        onFileChange={onFileChange}
        selectedFile={receiptFile}
      />,
    );

    const deleteButton = screen.getByRole("button", { name: "Delete" });

    expect(deleteButton).toBeDisabled();

    await user.click(deleteButton);

    expect(onFileChange).not.toHaveBeenCalled();
  });
});
