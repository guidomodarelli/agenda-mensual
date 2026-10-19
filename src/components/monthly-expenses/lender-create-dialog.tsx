import {
  Button,
  Dialog,
  DialogContent,
  Input,
  Label,
  Select,
  cn,
} from "beez-ui";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";

import type { LenderOption } from "@/components/monthly-expenses/lender-picker";

import { LENDER_TYPE_OPTIONS } from "./select-options.constants";
import styles from "./lenders-panel.module.scss";

type TechnicalErrorCode = `E${number}${number}${number}${number}`;

interface LenderCreateDialogProps {
  /**
   * Valores contra los que se detectan cambios sin guardar. En modo creación
   * es el formulario vacío (default); en edición, los datos originales del
   * prestamista.
   */
  baselineFormValues?: {
    name: string;
    notes: string;
    type: LenderOption["type"];
  };
  feedbackMessage: string | null;
  feedbackErrorCode?: TechnicalErrorCode | null;
  feedbackTone: "default" | "error" | "success";
  formValues: {
    name: string;
    notes: string;
    type: LenderOption["type"];
  };
  isOpen: boolean;
  isSubmitting: boolean;
  /** Creación (default) o edición de un prestamista existente. */
  mode?: "create" | "edit";
  onDiscardUnsavedChanges: () => void;
  onFieldChange: (fieldName: "name" | "notes" | "type", value: string) => void;
  onOpenChange: (nextOpen: boolean) => void;
  onSubmit: () => Promise<boolean>;
}

const EMPTY_LENDER_FORM_VALUES = {
  name: "",
  notes: "",
  type: "family",
} as const;

export function LenderCreateDialog({
  baselineFormValues = EMPTY_LENDER_FORM_VALUES,
  feedbackMessage,
  feedbackErrorCode = null,
  feedbackTone,
  formValues,
  isOpen,
  isSubmitting,
  mode = "create",
  onDiscardUnsavedChanges,
  onFieldChange,
  onOpenChange,
  onSubmit,
}: LenderCreateDialogProps) {
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const hasUnsavedChanges = useMemo(
    () =>
      formValues.name.trim() !== baselineFormValues.name.trim() ||
      formValues.notes.trim() !== baselineFormValues.notes.trim() ||
      formValues.type !== baselineFormValues.type,
    [baselineFormValues, formValues.name, formValues.notes, formValues.type],
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
        <DialogContent
          className={styles.dialogContent}
          description={
            mode === "edit"
              ? "Actualizá los datos de este prestamista."
              : "Completá y guardá este prestamista para reutilizarlo en tus deudas."
          }
          title={mode === "edit" ? "Editar prestamista" : "Nuevo prestamista"}
        >

          <form className={styles.form} onSubmit={handleSubmit}>
            {feedbackTone === "error" ? (
              <p className={cn(styles.feedback, styles.errorText)} role="alert">
                <span>{feedbackMessage}</span>
                {feedbackErrorCode ? (
                  <span className={styles.feedbackErrorCode}>{`Code: ${feedbackErrorCode}`}</span>
                ) : null}
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
                  Completá el nombre del prestamista antes de guardarlo.
                </p>
              ) : null}
            </div>

            <div className={styles.formField}>
              <Select
                id="lender-type"
                label="Tipo"
                onValueChange={(value) => onFieldChange("type", value)}
                options={LENDER_TYPE_OPTIONS}
                placeholder="Tipo de prestamista"
                value={formValues.type}
              />
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

            {/* The submit button must stay inside the form, so the actions are not the panel footer. */}
            <div className={styles.dialogFooter}>
              <Button
                disabled={isSubmitting}
                onClick={() => handleCreateModalOpenChange(false)}
                type="button"
                variant="secondary"
              >
                Cancelar
              </Button>
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting
                  ? "Guardando prestamista..."
                  : mode === "edit"
                    ? "Guardar cambios"
                    : "Guardar prestamista"}
              </Button>
            </div>
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
        <DialogContent
          className={styles.unsavedChangesContent}
          closeLabel="Cerrar aviso de cambios sin guardar"
          description="Tenés cambios sin guardar en este prestamista."
          footer={
            <>
              <Button
                className={styles.unsavedChangesButton}
                onClick={handleDiscardChanges}
                type="button"
                variant="secondary"
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
            </>
          }
          footerClassName={styles.unsavedChangesFooter}
          headerClassName={styles.unsavedChangesHeader}
          title="Cambios sin guardar"
        />
      </Dialog>
    </>
  );
}
