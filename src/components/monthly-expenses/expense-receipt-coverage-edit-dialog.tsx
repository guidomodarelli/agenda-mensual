import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  Input,
} from "beez-ui";
import { useMemo, useState } from "react";
import { ExternalLink, MoreVertical, Paperclip, Trash2 } from "lucide-react";

import { ReceiptFileUploader } from "@/components/monthly-expenses/receipt-file-uploader";

import { GuardedDropdownMenu } from "./guarded-dropdown-menu";
import styles from "./expense-receipt-coverage-edit-dialog.module.scss";

interface ExpenseReceiptCoverageEditDialogProps {
  canManageReceipt: boolean;
  currentCoveredPayments: number;
  errorMessage: string | null;
  expenseDescription: string;
  isOpen: boolean;
  isSubmitting: boolean;
  maxCoveredPayments: number;
  onClose: () => void;
  onDeleteReceipt: () => Promise<void>;
  onSave: (args: {
    coveredPayments: number;
    replacementFile: File | null;
  }) => Promise<void>;
  receiptFileName: string | null;
  receiptFileViewUrl: string | null;
}

const RECEIPT_REPLACEMENT_INPUT_ID = "receipt-replacement-file-input";

export function ExpenseReceiptCoverageEditDialog({
  canManageReceipt,
  currentCoveredPayments,
  errorMessage,
  expenseDescription,
  isOpen,
  isSubmitting,
  maxCoveredPayments,
  onClose,
  onDeleteReceipt,
  onSave,
  receiptFileName,
  receiptFileViewUrl,
}: ExpenseReceiptCoverageEditDialogProps) {
  const normalizedMaxCoveredPayments = Math.max(maxCoveredPayments, 1);
  const [coveredPaymentsValue, setCoveredPaymentsValue] = useState(
    String(Math.max(currentCoveredPayments, 1)),
  );
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [isReceiptActionsMenuOpen, setIsReceiptActionsMenuOpen] = useState(false);
  const [isDeleteReceiptConfirmOpen, setIsDeleteReceiptConfirmOpen] = useState(false);

  const parsedCoveredPayments = Number(coveredPaymentsValue);
  const hasValidCoveredPayments =
    Number.isInteger(parsedCoveredPayments) &&
    parsedCoveredPayments > 0 &&
    parsedCoveredPayments <= normalizedMaxCoveredPayments;
  const hasReceipt = Boolean(receiptFileName && receiptFileViewUrl);
  const shouldShowReplacementInput = canManageReceipt && !hasReceipt;
  const normalizedExpenseDescription = expenseDescription.trim() || "gasto";
  const normalizedReceiptFileName = receiptFileName?.trim() || "comprobante";

  const receiptFileLink = useMemo(() => {
    if (!receiptFileViewUrl) {
      return null;
    }

    try {
      const parsedUrl = new URL(receiptFileViewUrl);

      if (!/^https?:$/i.test(parsedUrl.protocol)) {
        return null;
      }

      return parsedUrl.toString();
    } catch {
      return null;
    }
  }, [receiptFileViewUrl]);

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !isSubmitting) {
      onClose();
    }
  };

  const handleClearReplacementFile = () => {
    setReplacementFile(null);
  };

  const handleDeleteReceipt = async () => {
    if (isSubmitting || !hasReceipt) {
      return;
    }

    await onDeleteReceipt();
    setIsDeleteReceiptConfirmOpen(false);
    handleClearReplacementFile();
  };

  const handleSave = async () => {
    if (!hasValidCoveredPayments || isSubmitting) {
      return;
    }

    await onSave({
      coveredPayments: parsedCoveredPayments,
      replacementFile,
    });
  };

  const receiptActionsLabel = `Abrir acciones de comprobante ${normalizedReceiptFileName}`;

  return (
    <Dialog
      alert
      onOpenChange={setIsDeleteReceiptConfirmOpen}
      open={isDeleteReceiptConfirmOpen}
    >
      <Dialog onOpenChange={handleDialogOpenChange} open={isOpen}>
        <DialogContent
          title="Editar registro de pago"
          description={<>Ajusta cuántos pagos desea cubrir para {expenseDescription || "el gasto seleccionado"}.</>}
        >

          <div className={styles.content}>
            <div className={styles.fieldGroup}>
              <label htmlFor="receipt-covered-payments">¿Cuántos pagos desea cubrir?</label>
              <Input
                id="receipt-covered-payments"
                inputMode="numeric"
                max={normalizedMaxCoveredPayments}
                min={1}
                onChange={(event) =>
                  setCoveredPaymentsValue(event.target.value.replace(/[^\d]/g, ""))}
                type="number"
                value={coveredPaymentsValue}
              />
              <p className={styles.hint}>Maximo permitido: {normalizedMaxCoveredPayments} pagos.</p>
            </div>

            {canManageReceipt && hasReceipt ? (
              <div className={styles.fileRow}>
                <span className={styles.fileName}>Archivo:</span>
                {receiptFileLink ? (
                  <a
                    className={styles.fileLink}
                    href={receiptFileLink}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <Paperclip aria-hidden="true" className={styles.fileLinkIcon} />
                    {normalizedReceiptFileName}
                    <ExternalLink aria-hidden="true" className={styles.fileLinkIcon} />
                  </a>
                ) : (
                  <span className={styles.fileName}>{normalizedReceiptFileName}</span>
                )}
                <GuardedDropdownMenu
                  disabled={isSubmitting}
                  align="end"
                  items={[
                    {
                      destructive: true,
                      icon: <Trash2 aria-hidden="true" />,
                      id: "delete-receipt",
                      label: "Eliminar comprobante",
                      onSelect: () => {
                        setIsReceiptActionsMenuOpen(false);
                        window.setTimeout(() => {
                          setIsDeleteReceiptConfirmOpen(true);
                        }, 0);
                      },
                    },
                  ]}
                  label={receiptActionsLabel}
                  onOpenChange={setIsReceiptActionsMenuOpen}
                  open={isReceiptActionsMenuOpen}
                  trigger={
                    <Button
                      aria-label={receiptActionsLabel}
                      className={styles.fileActionsButton}
                      disabled={isSubmitting}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <MoreVertical aria-hidden="true" />
                    </Button>
                  }
                />
              </div>
            ) : null}

            {shouldShowReplacementInput ? (
              <div className={styles.fieldGroup}>
                <label htmlFor={RECEIPT_REPLACEMENT_INPUT_ID}>
                  Adjuntar nuevo comprobante:
                </label>
                <ReceiptFileUploader
                  errorMessage={null}
                  inputId={RECEIPT_REPLACEMENT_INPUT_ID}
                  inputAriaLabel={`Seleccionar nuevo comprobante para ${normalizedExpenseDescription}`}
                  isDisabled={isSubmitting}
                  isUploading={isSubmitting}
                  onFileChange={setReplacementFile}
                  selectedFile={replacementFile}
                />
              </div>
            ) : null}

            {!hasValidCoveredPayments ? (
              <p className={styles.errorText} role="alert">
                Ingresa un numero entero entre 1 y {normalizedMaxCoveredPayments}.
              </p>
            ) : null}

            {errorMessage ? (
              <p className={styles.errorText} role="alert">
                {errorMessage}
              </p>
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
                disabled={!hasValidCoveredPayments || isSubmitting}
                onClick={() => {
                  void handleSave();
                }}
                type="button"
              >
                {isSubmitting ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <DialogContent
        title="¿Querés eliminar este comprobante?"
        description={<>Esta acción quita el archivo adjunto para {normalizedExpenseDescription}.</>}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary">Cancelar</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button
                aria-label={`Confirmar eliminación de comprobante ${normalizedReceiptFileName}`}
                onClick={() => {
                  void handleDeleteReceipt();
                }}
                variant="danger"
              >
                Eliminar
              </Button>
            </DialogClose>
          </>
        }
      />
    </Dialog>
  );
}
