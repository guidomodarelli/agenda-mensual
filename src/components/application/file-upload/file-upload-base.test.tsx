import { vi, describe, it, expect } from "vitest";
import { createEvent, fireEvent, render, screen } from "@testing-library/react";

import { FileUploadDropZone } from "./file-upload-base";

describe("FileUploadDropZone", () => {
  it("marks the hint as invalid when an unaccepted file is selected without invalid callbacks", async () => {
    render(
      <FileUploadDropZone
        accept="application/pdf"
        hint="Adjuntá un comprobante"
        inputAriaLabel="Selector de comprobante"
      />,
    );

    const hint = screen.getByText("Adjuntá un comprobante");
    const unacceptedFile = new File(["text"], "nota.txt", {
      type: "text/plain",
    });
    const dropZone = document.querySelector("[data-dropzone]");

    if (!(dropZone instanceof HTMLDivElement)) {
      throw new Error("Drop zone not found");
    }

    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [unacceptedFile],
      },
    });

    expect(hint).toHaveClass("text-error-primary");
  });

  it("marks the hint as invalid when an oversized file is selected without invalid callbacks", async () => {
    render(
      <FileUploadDropZone
        accept="application/pdf"
        hint="Adjuntá un comprobante"
        inputAriaLabel="Selector de comprobante"
        maxSize={5}
      />,
    );

    const hint = screen.getByText("Adjuntá un comprobante");
    const oversizedFile = new File(["123456"], "factura.pdf", {
      type: "application/pdf",
    });
    const dropZone = document.querySelector("[data-dropzone]");

    if (!(dropZone instanceof HTMLDivElement)) {
      throw new Error("Drop zone not found");
    }

    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [oversizedFile],
      },
    });

    expect(hint).toHaveClass("text-error-primary");
  });

  it("accepts files by extension when browser omits mime type", () => {
    const onDropFiles = vi.fn();
    const onDropUnacceptedFiles = vi.fn();

    render(
      <FileUploadDropZone
        accept="application/pdf"
        inputAriaLabel="Selector de comprobante"
        onDropFiles={onDropFiles}
        onDropUnacceptedFiles={onDropUnacceptedFiles}
      />,
    );

    const fileWithoutMimeType = new File(["pdf-content"], "comprobante.pdf", {
      type: "",
    });
    const dropZone = document.querySelector("[data-dropzone]");

    if (!(dropZone instanceof HTMLDivElement)) {
      throw new Error("Drop zone not found");
    }

    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [fileWithoutMimeType],
      },
    });

    expect(onDropFiles).toHaveBeenCalledWith([fileWithoutMimeType]);
    expect(onDropUnacceptedFiles).not.toHaveBeenCalled();
  });

  it("accepts files by extension when mime type is non-canonical", () => {
    const onDropFiles = vi.fn();
    const onDropUnacceptedFiles = vi.fn();

    render(
      <FileUploadDropZone
        accept="image/jpeg,application/pdf"
        inputAriaLabel="Selector de comprobante"
        onDropFiles={onDropFiles}
        onDropUnacceptedFiles={onDropUnacceptedFiles}
      />,
    );

    const fileWithNonCanonicalMime = new File(["img-content"], "comprobante.jpg", {
      type: "image/jpg",
    });
    const dropZone = document.querySelector("[data-dropzone]");

    if (!(dropZone instanceof HTMLDivElement)) {
      throw new Error("Drop zone not found");
    }

    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [fileWithNonCanonicalMime],
      },
    });

    expect(onDropFiles).toHaveBeenCalledWith([fileWithNonCanonicalMime]);
    expect(onDropUnacceptedFiles).not.toHaveBeenCalled();
  });

  it("prevents the native drop behavior when uploader is disabled", () => {
    const onDropFiles = vi.fn();

    render(
      <FileUploadDropZone
        isDisabled
        onDropFiles={onDropFiles}
        inputAriaLabel="Disabled receipt selector"
      />,
    );

    const file = new File(["content"], "receipt.pdf", {
      type: "application/pdf",
    });
    const dropZone = document.querySelector("[data-dropzone]");

    if (!(dropZone instanceof HTMLDivElement)) {
      throw new Error("Drop zone not found");
    }

    const dropEvent = createEvent.drop(dropZone, {
      dataTransfer: {
        files: [file],
      },
    });
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();

    Object.defineProperty(dropEvent, "preventDefault", {
      value: preventDefault,
    });
    Object.defineProperty(dropEvent, "stopPropagation", {
      value: stopPropagation,
    });

    fireEvent(dropZone, dropEvent);

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(onDropFiles).not.toHaveBeenCalled();
  });

  it("prevents native dragover behavior when uploader is disabled", () => {
    render(
      <FileUploadDropZone
        isDisabled
        inputAriaLabel="Disabled receipt selector"
      />,
    );

    const dropZone = document.querySelector("[data-dropzone]");

    if (!(dropZone instanceof HTMLDivElement)) {
      throw new Error("Drop zone not found");
    }

    const dragOverEvent = createEvent.dragOver(dropZone);
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();

    Object.defineProperty(dragOverEvent, "preventDefault", {
      value: preventDefault,
    });
    Object.defineProperty(dragOverEvent, "stopPropagation", {
      value: stopPropagation,
    });

    fireEvent(dropZone, dragOverEvent);

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(stopPropagation).toHaveBeenCalledTimes(1);
  });

  it("prevents native dragleave behavior when uploader is disabled", () => {
    render(
      <FileUploadDropZone
        isDisabled
        inputAriaLabel="Disabled receipt selector"
      />,
    );

    const dropZone = document.querySelector("[data-dropzone]");

    if (!(dropZone instanceof HTMLDivElement)) {
      throw new Error("Drop zone not found");
    }

    const dragLeaveEvent = createEvent.dragLeave(dropZone);
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();

    Object.defineProperty(dragLeaveEvent, "preventDefault", {
      value: preventDefault,
    });
    Object.defineProperty(dragLeaveEvent, "stopPropagation", {
      value: stopPropagation,
    });

    fireEvent(dropZone, dragLeaveEvent);

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(stopPropagation).toHaveBeenCalledTimes(1);
  });
});
