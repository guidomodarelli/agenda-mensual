import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { X } from "lucide-react";

import type { LenderOption } from "@/components/monthly-expenses/lender-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import styles from "./lenders-panel.module.scss";

interface LenderCreateDialogProps {
  feedbackMessage: string | null;
  feedbackTone: "default" | "error" | "success";
  formValues: {
    name: string;
    notes: string;
    type: LenderOption["type"];
  };
  isOpen: boolean;
  isSubmitting: boolean;
  onDiscardUnsavedChanges: () => void;
  onFieldChange: (fieldName: "name" | "notes" | "type", value: string) => void;
  onOpenChange: (nextOpen: boolean) => void;
  onSubmit: () => Promise<boolean>;
}

export function LenderCreateDialog({
  feedbackMessage,
  feedbackTone,
  formValues,
  isOpen,
  isSubmitting,
  onDiscardUnsavedChanges,
  onFieldChange,
  onOpenChange,
  onSubmit,
}: LenderCreateDialogProps) {
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const hasUnsavedChanges = useMemo(
    () =>
      formValues.name.trim().length > 0 ||
      formValues.notes.trim().length > 0 ||
      formValues.type !== "family",
    [formValues.name, formValues.notes, formValues.type],
  );
  const hasRequiredNameError =
    hasAttemptedSubmit && formValues.name.trim().length === 0;

  const closeCreateModal = () => {
    setHasAttemptedSubmit(false);
    onOpenChange(false);
  };

  const handleCreateModalOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }

    if (hasUnsavedChanges) {
      setShowDiscardDialog(true);
      return;
    }

    closeCreateModal();
  };

  const handleDiscardChanges = () => {
    onDiscardUnsavedChanges();
    setHasAttemptedSubmit(false);
    setShowDiscardDialog(false);
    closeCreateModal();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await handleSave();
  };

  const handleSave = async () => {
    if (!formValues.name.trim()) {
      setHasAttemptedSubmit(true);
      return;
    }

    setHasAttemptedSubmit(false);

    const wasSaved = await onSubmit();

    if (wasSaved) {
      closeCreateModal();
    }
  };

  const handleSaveFromUnsavedChangesDialog = async () => {
    setShowDiscardDialog(false);
    await handleSave();
  };

  return (
    <>
      <Dialog onOpenChange={handleCreateModalOpenChange} open={isOpen}>
        <DialogContent className={styles.dialogContent}>
          <DialogHeader>
            <DialogTitle>Nuevo prestador</DialogTitle>
            <DialogDescription>
              Completá y guardá este prestador para reutilizarlo en tus deudas.
            </DialogDescription>
          </DialogHeader>

          <form className={styles.form} onSubmit={handleSubmit}>
            {feedbackTone === "error" ? (
              <p className={cn(styles.feedback, styles.errorText)} role="alert">
                {feedbackMessage}
              </p>
            ) : null}

            <div className={styles.formField}>
              <Label htmlFor="lender-name">Nombre</Label>
              <Input
                aria-invalid={hasRequiredNameError}
                id="lender-name"
                onChange={(event) => onFieldChange("name", event.target.value)}
                placeholder="Ej. Banco Nación, Papá, Juan"
                type="text"
                value={formValues.name}
              />
              {hasRequiredNameError ? (
                <p className={cn(styles.feedback, styles.errorText)} role="alert">
                  Completá el nombre del prestador antes de guardarlo.
                </p>
              ) : null}
            </div>

            <div className={styles.formField}>
              <Label htmlFor="lender-type">Tipo</Label>
              <Select
                onValueChange={(value) => onFieldChange("type", value)}
                value={formValues.type}
              >
                <SelectTrigger aria-label="Tipo de prestador" id="lender-type">
                  <SelectValue placeholder="Tipo de prestador" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">Banco</SelectItem>
                  <SelectItem value="family">Familiar</SelectItem>
                  <SelectItem value="friend">Amigo</SelectItem>
                  <SelectItem value="other">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className={styles.formField}>
              <Label htmlFor="lender-notes">Notas</Label>
              <Input
                id="lender-notes"
                onChange={(event) => onFieldChange("notes", event.target.value)}
                placeholder="Dato opcional para identificarlo mejor"
                type="text"
                value={formValues.notes}
              />
            </div>

            <DialogFooter className={styles.dialogFooter}>
              <Button
                disabled={isSubmitting}
                onClick={() => handleCreateModalOpenChange(false)}
                type="button"
                variant="outline"
              >
                Cancelar
              </Button>
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? "Guardando prestador..." : "Guardar prestador"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setShowDiscardDialog(false);
          }
        }}
        open={showDiscardDialog}
      >
        <DialogContent className={styles.unsavedChangesContent} showCloseButton={false}>
          <DialogHeader className={styles.unsavedChangesHeader}>
            <div className={styles.unsavedChangesHeaderTopRow}>
              <DialogTitle>Cambios sin guardar</DialogTitle>
              <Button
                aria-label="Cerrar aviso de cambios sin guardar"
                className={styles.unsavedChangesCloseButton}
                onClick={() => setShowDiscardDialog(false)}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <X aria-hidden="true" />
              </Button>
            </div>
            <DialogDescription>
              Tenés cambios sin guardar en este prestador.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className={styles.unsavedChangesFooter}>
            <Button
              className={styles.unsavedChangesButton}
              onClick={handleDiscardChanges}
              type="button"
              variant="outline"
            >
              Descartar los cambios
            </Button>
            <Button
              className={styles.unsavedChangesButton}
              onClick={handleSaveFromUnsavedChangesDialog}
              type="button"
            >
              Guardar los cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
