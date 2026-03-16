import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import styles from "./expense-receipt-coverage-edit-dialog.module.scss";

interface ExpenseReceiptCoverageEditDialogProps {
  currentCoveredPayments: number;
  errorMessage: string | null;
  expenseDescription: string;
  isOpen: boolean;
  isSubmitting: boolean;
  maxCoveredPayments: number;
  onClose: () => void;
  onSave: (coveredPayments: number) => Promise<void>;
  receiptFileName: string;
}

export function ExpenseReceiptCoverageEditDialog({
  currentCoveredPayments,
  errorMessage,
  expenseDescription,
  isOpen,
  isSubmitting,
  maxCoveredPayments,
  onClose,
  onSave,
  receiptFileName,
}: ExpenseReceiptCoverageEditDialogProps) {
  const normalizedMaxCoveredPayments = Math.max(maxCoveredPayments, 1);
  const [coveredPaymentsValue, setCoveredPaymentsValue] = useState(
    String(Math.max(currentCoveredPayments, 1)),
  );

  const parsedCoveredPayments = Number(coveredPaymentsValue);
  const hasValidCoveredPayments =
    Number.isInteger(parsedCoveredPayments) &&
    parsedCoveredPayments > 0 &&
    parsedCoveredPayments <= normalizedMaxCoveredPayments;

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !isSubmitting) {
      onClose();
    }
  };

  const handleSave = async () => {
    if (!hasValidCoveredPayments || isSubmitting) {
      return;
    }

    await onSave(parsedCoveredPayments);
  };

  return (
    <Dialog onOpenChange={handleDialogOpenChange} open={isOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar cobertura del comprobante</DialogTitle>
          <DialogDescription>
            Ajusta cuantos pagos cubre este comprobante para {expenseDescription || "el gasto seleccionado"}.
          </DialogDescription>
        </DialogHeader>

        <div className={styles.content}>
          <p className={styles.fileName}>Archivo: {receiptFileName || "Comprobante"}</p>

          <div className={styles.fieldGroup}>
            <label htmlFor="receipt-covered-payments">Cantidad de pagos</label>
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
              variant="outline"
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
  );
}
