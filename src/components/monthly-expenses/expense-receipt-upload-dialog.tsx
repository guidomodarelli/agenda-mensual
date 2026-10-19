import {
  Button,
  Dialog,
  DialogContent,
  Input,
  Label,
  RadioGroup,
} from "@astra-kit/ui";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { ReceiptFileUploader } from "@/components/monthly-expenses/receipt-file-uploader";

import styles from "./expense-receipt-upload-dialog.module.scss";

interface ExpenseReceiptUploadDialogProps {
  coveredPaymentsMax: number;
  coveredPaymentsRemaining: number;
  errorMessage: string | null;
  expenseDescription: string;
  isOpen: boolean;
  isSubmitting: boolean;
  uploadProgressPercent: number;
  onClose: () => void;
  onUpload: (args: { coveredPayments: number; file: File }) => Promise<void>;
}

function formatPaymentCount(count: number): string {
  return `${count} pago${count === 1 ? "" : "s"}`;
}

export function ExpenseReceiptUploadDialog({
  coveredPaymentsMax,
  coveredPaymentsRemaining,
  errorMessage,
  expenseDescription,
  isOpen,
  isSubmitting,
  uploadProgressPercent,
  onClose,
  onUpload,
}: ExpenseReceiptUploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [coverageMode, setCoverageMode] = useState<"full" | "partial">("full");
  const [partialCoveredPayments, setPartialCoveredPayments] = useState("1");
  const wasOpenRef = useRef(isOpen);
  const inputIdBase = useId();
  const partialCoveredPaymentsInputId = `${inputIdBase}-partial-covered-payments`;

  const normalizedCoveredPaymentsMax = Math.max(coveredPaymentsMax, 1);
  const normalizedCoveredPaymentsRemaining = Math.max(coveredPaymentsRemaining, 1);
  const shouldShowCoverageOptions = normalizedCoveredPaymentsRemaining > 1;
  const parsedPartialCoveredPayments = Number(partialCoveredPayments);
  const partialCoveredPaymentsIsValid =
    Number.isInteger(parsedPartialCoveredPayments) &&
    parsedPartialCoveredPayments > 0 &&
    parsedPartialCoveredPayments <= normalizedCoveredPaymentsRemaining;

  const dropzoneLabel = useMemo(
    () =>
      expenseDescription.trim().length > 0
        ? `Comprobante para ${expenseDescription.trim()}`
        : "Comprobante del gasto",
    [expenseDescription],
  );

  /**
   * Resets the local form state so each upload flow starts from a clean slate.
   */
  function resetDialogState() {
    setSelectedFile(null);
    setCoverageMode("full");
    setPartialCoveredPayments("1");
  }

  useEffect(() => {
    if (isOpen === wasOpenRef.current) {
      return;
    }

    // Keep local state clean when the controlled dialog transitions open/closed.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    resetDialogState();
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetDialogState();
      onClose();
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      return;
    }

    const coveredPayments = shouldShowCoverageOptions && coverageMode === "partial"
      ? parsedPartialCoveredPayments
      : normalizedCoveredPaymentsRemaining;

    if (!Number.isInteger(coveredPayments) || coveredPayments <= 0) {
      return;
    }

    await onUpload({
      coveredPayments,
      file: selectedFile,
    });
  };

  return (
    <Dialog onOpenChange={handleDialogOpenChange} open={isOpen}>
      <DialogContent
        title="Subir comprobante"
        description="Subí un archivo del comprobante y lo vamos a guardar en Google Drive."
        className={styles.dialogContent}
      >

        <div className={styles.content}>
          <ReceiptFileUploader
            errorMessage={errorMessage}
            inputAriaLabel={dropzoneLabel}
            isDisabled={isSubmitting}
            isUploading={isSubmitting}
            onFileChange={setSelectedFile}
            selectedFile={selectedFile}
            uploadProgressPercent={uploadProgressPercent}
          />

          {shouldShowCoverageOptions ? (
            <div className={styles.coverageSection}>
              <RadioGroup
                label="Elegí cómo aplicar este comprobante:"
                onValueChange={(value) => {
                  if (value === "partial") {
                    setCoverageMode("partial");
                    return;
                  }

                  setCoverageMode("full");
                }}
                options={[
                  {
                    description: `El comprobante cubre ${formatPaymentCount(normalizedCoveredPaymentsRemaining)} pendientes de un total de ${formatPaymentCount(normalizedCoveredPaymentsMax)} en este mes.`,
                    label: "Todo el periodo",
                    value: "full",
                  },
                  {
                    description:
                      "El comprobante cubre solo la cantidad de pagos que indiques manualmente.",
                    label: "Cobertura parcial",
                    value: "partial",
                  },
                ]}
                value={coverageMode}
              />

              {coverageMode === "partial" ? (
                <div className={styles.partialCoverageField}>
                  <Label htmlFor={partialCoveredPaymentsInputId}>Cantidad de pagos a cubrir</Label>
                  <Input
                    id={partialCoveredPaymentsInputId}
                    inputMode="numeric"
                    max={normalizedCoveredPaymentsRemaining}
                    min={1}
                    onChange={(event) =>
                      setPartialCoveredPayments(event.target.value.replace(/[^\d]/g, ""))}
                    type="number"
                    value={partialCoveredPayments}
                  />
                  <p className={styles.coverageHint}>
                    Podés indicar entre 1 y {normalizedCoveredPaymentsRemaining} pagos.
                  </p>
                </div>
              ) : null}

              {coverageMode === "partial" && !partialCoveredPaymentsIsValid ? (
                <p className={styles.errorText} role="alert">
                  Ingresá una cantidad de pagos válida entre 1 y {normalizedCoveredPaymentsRemaining}.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className={styles.actions}>
            <Button
              disabled={isSubmitting}
              onClick={onClose}
              type="button"
              variant="secondary"
            >
              Cancelar
            </Button>
            <Button
              disabled={
                !selectedFile ||
                isSubmitting ||
                (shouldShowCoverageOptions &&
                  coverageMode === "partial" &&
                  !partialCoveredPaymentsIsValid)
              }
              onClick={() => {
                void handleUpload();
              }}
              type="button"
            >
              {isSubmitting ? "Subiendo..." : "Subir comprobante"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
