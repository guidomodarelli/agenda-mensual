import type { FormEvent } from "react";

import { ConfirmDeleteButton } from "@/components/monthly-expenses/confirm-delete-button";
import type { LenderOption } from "@/components/monthly-expenses/lender-picker";
import { Button } from "@/components/ui/button";
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

interface LendersPanelProps {
  feedbackMessage: string;
  feedbackTone: "default" | "error" | "success";
  formValues: {
    name: string;
    notes: string;
    type: LenderOption["type"];
  };
  isSubmitting: boolean;
  lenders: LenderOption[];
  onDelete: (lenderId: string) => void;
  onFieldChange: (
    fieldName: "name" | "notes" | "type",
    value: string,
  ) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

function getLenderTypeLabel(type: LenderOption["type"]): string {
  switch (type) {
    case "bank":
      return "Banco";
    case "family":
      return "Familiar";
    case "friend":
      return "Amigo";
    case "other":
      return "Otro";
  }
}

export function LendersPanel({
  feedbackMessage,
  feedbackTone,
  formValues,
  isSubmitting,
  lenders,
  onDelete,
  onFieldChange,
  onSubmit,
}: LendersPanelProps) {
  return (
    <section className={styles.content}>
      <p className={styles.description}>
        Guardá prestadores para reutilizarlos en tus deudas.
      </p>

      <form className={styles.form} onSubmit={onSubmit}>
        <div className={styles.formField}>
          <Label htmlFor="lender-name">Nombre</Label>
          <Input
            id="lender-name"
            onChange={(event) => onFieldChange("name", event.target.value)}
            placeholder="Ej. Banco Nación, Papá, Juan"
            type="text"
            value={formValues.name}
          />
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

        <div className={styles.formActions}>
          <Button disabled={isSubmitting} type="submit">
            {isSubmitting ? "Guardando prestadores..." : "Agregar prestador"}
          </Button>
        </div>
      </form>

      <p
        className={cn(
          styles.feedback,
          feedbackTone === "error" && styles.errorText,
          feedbackTone === "success" && styles.successText,
        )}
        role={feedbackTone === "error" ? "alert" : "status"}
      >
        {feedbackMessage}
      </p>

      <div className={styles.list}>
        {lenders.length > 0 ? (
          lenders.map((lender) => (
            <div className={styles.listItem} key={lender.id}>
              <div className={styles.listCopy}>
                <p className={styles.listTitle}>{lender.name}</p>
                <p className={styles.listMeta}>
                  {getLenderTypeLabel(lender.type)}
                </p>
              </div>
              <ConfirmDeleteButton
                message={`¿Querés eliminar a ${lender.name} del catálogo?`}
                menuAriaLabel={`Abrir acciones para ${lender.name}`}
                onConfirm={() => onDelete(lender.id)}
              />
            </div>
          ))
        ) : (
          <p className={styles.emptyState}>
            Todavía no hay prestadores guardados.
          </p>
        )}
      </div>
    </section>
  );
}
