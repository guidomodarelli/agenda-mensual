import { useState } from "react";

import { ConfirmDeleteButton } from "@/components/monthly-expenses/confirm-delete-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import type { ExpenseFolderOption } from "./expense-folder-picker";
import {
  EXPENSE_FOLDER_COLOR_LABEL,
  EXPENSE_FOLDER_COLOR_OPTIONS,
  EXPENSE_FOLDER_ICON_LABEL,
  EXPENSE_FOLDER_ICON_OPTIONS,
  ExpenseFolderIconGlyph,
  resolveExpenseFolderColorHex,
  DEFAULT_EXPENSE_FOLDER_COLOR,
  DEFAULT_EXPENSE_FOLDER_ICON,
  type ExpenseFolderColor,
  type ExpenseFolderIcon,
} from "./expense-folder-visuals";
import styles from "./expense-folders-panel.module.scss";

type TechnicalErrorCode = `E${number}${number}${number}${number}`;

export interface ExpenseFolderAppearanceDraft {
  color: ExpenseFolderColor;
  icon: ExpenseFolderIcon;
  name: string;
}

interface ExpenseFoldersPanelProps {
  feedbackErrorCode?: TechnicalErrorCode | null;
  feedbackMessage: string | null;
  feedbackTone: "default" | "error" | "success";
  folders: ExpenseFolderOption[];
  isSubmitting: boolean;
  onCreate: (draft: ExpenseFolderAppearanceDraft) => void;
  onDelete: (folderId: string) => void;
  onUpdate: (folderId: string, draft: ExpenseFolderAppearanceDraft) => void;
}

function ColorOptionGrid({
  onSelect,
  selectedColor,
}: {
  onSelect: (color: ExpenseFolderColor) => void;
  selectedColor: ExpenseFolderColor;
}) {
  return (
    <div className={styles.colorGrid} role="group" aria-label="Color de la carpeta">
      {EXPENSE_FOLDER_COLOR_OPTIONS.map((color) => (
        <button
          aria-label={EXPENSE_FOLDER_COLOR_LABEL[color]}
          aria-pressed={color === selectedColor}
          className={cn(
            styles.colorOption,
            color === selectedColor && styles.colorOptionSelected,
          )}
          key={color}
          onClick={() => onSelect(color)}
          style={{ backgroundColor: resolveExpenseFolderColorHex(color) }}
          type="button"
        />
      ))}
    </div>
  );
}

function IconOptionGrid({
  onSelect,
  selectedIcon,
}: {
  onSelect: (icon: ExpenseFolderIcon) => void;
  selectedIcon: ExpenseFolderIcon;
}) {
  return (
    <div className={styles.iconGrid} role="group" aria-label="Ícono de la carpeta">
      {EXPENSE_FOLDER_ICON_OPTIONS.map((icon) => (
        <button
          aria-label={EXPENSE_FOLDER_ICON_LABEL[icon]}
          aria-pressed={icon === selectedIcon}
          className={cn(
            styles.iconOption,
            icon === selectedIcon && styles.iconOptionSelected,
          )}
          key={icon}
          onClick={() => onSelect(icon)}
          type="button"
        >
          <ExpenseFolderIconGlyph icon={icon} size={18} stroke={2} />
        </button>
      ))}
    </div>
  );
}

function ExpenseFolderEditor({
  draft,
  idPrefix,
  onChange,
}: {
  draft: ExpenseFolderAppearanceDraft;
  idPrefix: string;
  onChange: (draft: ExpenseFolderAppearanceDraft) => void;
}) {
  return (
    <>
      <div className={styles.formField}>
        <Label htmlFor={`${idPrefix}-name`}>Nombre</Label>
        <Input
          id={`${idPrefix}-name`}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
          placeholder="Ej. Hogar, Servicios, Tarjetas"
          type="text"
          value={draft.name}
        />
      </div>

      <div className={styles.formField}>
        <span className={styles.fieldLabel}>Color</span>
        <ColorOptionGrid
          onSelect={(color) => onChange({ ...draft, color })}
          selectedColor={draft.color}
        />
      </div>

      <div className={styles.formField}>
        <span className={styles.fieldLabel}>Ícono</span>
        <IconOptionGrid
          onSelect={(icon) => onChange({ ...draft, icon })}
          selectedIcon={draft.icon}
        />
      </div>
    </>
  );
}

function createEmptyDraft(): ExpenseFolderAppearanceDraft {
  return {
    color: DEFAULT_EXPENSE_FOLDER_COLOR,
    icon: DEFAULT_EXPENSE_FOLDER_ICON,
    name: "",
  };
}

export function ExpenseFoldersPanel({
  feedbackErrorCode = null,
  feedbackMessage,
  feedbackTone,
  folders,
  isSubmitting,
  onCreate,
  onDelete,
  onUpdate,
}: ExpenseFoldersPanelProps) {
  const [createDraft, setCreateDraft] = useState<ExpenseFolderAppearanceDraft>(
    createEmptyDraft,
  );
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ExpenseFolderAppearanceDraft>(
    createEmptyDraft,
  );

  const handleCreate = () => {
    if (!createDraft.name.trim()) {
      return;
    }

    onCreate({ ...createDraft, name: createDraft.name.trim() });
    setCreateDraft(createEmptyDraft());
  };

  const startEditing = (folder: ExpenseFolderOption) => {
    setEditingFolderId(folder.id);
    setEditDraft({
      color: folder.color ?? DEFAULT_EXPENSE_FOLDER_COLOR,
      icon: folder.icon ?? DEFAULT_EXPENSE_FOLDER_ICON,
      name: folder.name,
    });
  };

  const handleUpdate = (folderId: string) => {
    if (!editDraft.name.trim()) {
      return;
    }

    onUpdate(folderId, { ...editDraft, name: editDraft.name.trim() });
    setEditingFolderId(null);
  };

  return (
    <section className={styles.content}>
      <p className={styles.description}>
        Creá carpetas para organizar tus gastos y reutilizalas en todos los meses.
      </p>

      {feedbackMessage ? (
        <p
          className={cn(
            styles.feedback,
            feedbackTone === "error" && styles.errorText,
            feedbackTone === "success" && styles.successText,
          )}
          role={feedbackTone === "error" ? "alert" : "status"}
        >
          <span>{feedbackMessage}</span>
          {feedbackTone === "error" && feedbackErrorCode ? (
            <span className={styles.feedbackErrorCode}>{`Code: ${feedbackErrorCode}`}</span>
          ) : null}
        </p>
      ) : null}

      <div className={styles.form}>
        <ExpenseFolderEditor
          draft={createDraft}
          idPrefix="expense-folder-create"
          onChange={setCreateDraft}
        />
        <div className={styles.formActions}>
          <Button
            disabled={isSubmitting || createDraft.name.trim().length === 0}
            onClick={handleCreate}
            type="button"
          >
            {isSubmitting ? "Guardando carpeta..." : "Agregar carpeta"}
          </Button>
        </div>
      </div>

      <div className={styles.list}>
        {folders.length > 0 ? (
          folders.map((folder) => {
            const isEditing = editingFolderId === folder.id;

            return (
              <div className={styles.listItem} key={folder.id}>
                <div className={styles.listHeader}>
                  <span className={styles.listIdentity}>
                    <span
                      aria-hidden="true"
                      className={styles.swatch}
                      style={{
                        backgroundColor: resolveExpenseFolderColorHex(
                          folder.color,
                        ),
                      }}
                    >
                      <ExpenseFolderIconGlyph
                        icon={folder.icon}
                        size={18}
                        stroke={2}
                      />
                    </span>
                    <p className={styles.listTitle}>{folder.name}</p>
                  </span>

                  <span className={styles.listActions}>
                    <Button
                      onClick={() =>
                        isEditing ? setEditingFolderId(null) : startEditing(folder)
                      }
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {isEditing ? "Cerrar" : "Editar"}
                    </Button>
                    <ConfirmDeleteButton
                      message={`¿Querés eliminar la carpeta ${folder.name}? Los gastos quedarán sin carpeta.`}
                      menuAriaLabel={`Abrir acciones para ${folder.name}`}
                      onConfirm={() => onDelete(folder.id)}
                    />
                  </span>
                </div>

                {isEditing ? (
                  <div className={styles.editor}>
                    <ExpenseFolderEditor
                      draft={editDraft}
                      idPrefix={`expense-folder-edit-${folder.id}`}
                      onChange={setEditDraft}
                    />
                    <div className={styles.formActions}>
                      <Button
                        disabled={
                          isSubmitting || editDraft.name.trim().length === 0
                        }
                        onClick={() => handleUpdate(folder.id)}
                        size="sm"
                        type="button"
                      >
                        Guardar cambios
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        ) : (
          <p className={styles.emptyState}>
            Todavía no hay carpetas creadas.
          </p>
        )}
      </div>
    </section>
  );
}
