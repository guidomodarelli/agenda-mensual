import { useState } from "react";
import { Folder, FolderX, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import styles from "./expense-row-actions.module.scss";

interface ExpenseRowActionsProps {
  actionDisabled: boolean;
  allReceiptsFolderViewUrl: string | null;
  canDeleteAllReceiptsFolderReference: boolean;
  canDeleteMonthlyFolderReference: boolean;
  description: string;
  hasPaymentLink: boolean;
  monthlyFolderViewUrl: string | null;
  onDeleteAllReceiptsFolderReference: () => void;
  onDelete: () => void;
  onDeleteMonthlyFolderReference: () => void;
  onDeletePaymentLink: () => void;
  onEdit: () => void;
  onManagePaymentLink: () => void;
}

export function ExpenseRowActions({
  actionDisabled,
  allReceiptsFolderViewUrl,
  canDeleteAllReceiptsFolderReference,
  canDeleteMonthlyFolderReference,
  description,
  hasPaymentLink,
  monthlyFolderViewUrl,
  onDeleteAllReceiptsFolderReference,
  onDelete,
  onDeleteMonthlyFolderReference,
  onDeletePaymentLink,
  onEdit,
  onManagePaymentLink,
}: ExpenseRowActionsProps) {
  const normalizedDescription = description.trim() || "este compromiso";
  const [confirmActionType, setConfirmActionType] = useState<
    | "deleteExpense"
    | "deleteMonthlyFolderReference"
    | "deleteAllReceiptsFolderReference"
    | "deletePaymentLink"
    | null
  >(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const shouldRenderFoldersSection =
    Boolean(monthlyFolderViewUrl) ||
    Boolean(allReceiptsFolderViewUrl) ||
    canDeleteMonthlyFolderReference ||
    canDeleteAllReceiptsFolderReference;

  const confirmDialogConfig =
    confirmActionType === "deleteExpense"
      ? {
          actionLabel: "Confirmar",
          ariaLabel: undefined,
          description:
            "Esta acción guarda el cambio inmediatamente en tu archivo mensual.",
          onConfirm: onDelete,
          title: "¿Querés eliminar este compromiso?",
        }
      : confirmActionType === "deleteMonthlyFolderReference"
        ? {
            actionLabel: "Quitar",
            ariaLabel: "Confirmar quitar referencia de carpeta del mes actual",
            description:
              "Esta acción guarda el cambio inmediatamente en tu archivo mensual.",
            onConfirm: onDeleteMonthlyFolderReference,
            title: "¿Querés quitar la referencia de carpeta del mes actual?",
          }
        : confirmActionType === "deleteAllReceiptsFolderReference"
          ? {
              actionLabel: "Quitar",
              ariaLabel: "Confirmar quitar referencia de carpeta de comprobantes",
              description:
                "Esta acción guarda el cambio inmediatamente en tu archivo mensual.",
              onConfirm: onDeleteAllReceiptsFolderReference,
              title: "¿Querés quitar la referencia de carpeta de comprobantes?",
            }
          : confirmActionType === "deletePaymentLink"
            ? {
                actionLabel: "Eliminar",
                ariaLabel: `Confirmar eliminación de link de pago para ${normalizedDescription}`,
                description:
                  "Esta acción guarda el cambio inmediatamente en tu archivo mensual.",
                onConfirm: onDeletePaymentLink,
                title: "¿Querés eliminar este link de pago?",
              }
            : null;

  return (
    <AlertDialog
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setConfirmActionType(null);
        }
      }}
      open={confirmActionType !== null}
    >
      <DropdownMenu onOpenChange={setIsMenuOpen} open={isMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={`Abrir acciones para ${normalizedDescription}`}
            className={styles.trigger}
            disabled={actionDisabled}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <MoreVertical aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setIsMenuOpen(false);
              onEdit();
            }}
          >
            <span className={styles.menuItem}>
              <Pencil aria-hidden="true" />
              Editar
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setIsMenuOpen(false);
              setConfirmActionType("deleteExpense");
            }}
            variant="destructive"
          >
            <span className={styles.menuItem}>
              <Trash2 aria-hidden="true" className={styles.destructiveIcon} />
              Eliminar
            </span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Link de pago</DropdownMenuLabel>
          {hasPaymentLink ? (
            <>
              <DropdownMenuItem
                onSelect={() => {
                  setIsMenuOpen(false);
                  window.setTimeout(() => {
                    onManagePaymentLink();
                  }, 0);
                }}
              >
                <span className={styles.menuItem}>
                  <Pencil aria-hidden="true" />
                  Editar link de pago
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setIsMenuOpen(false);
                  setConfirmActionType("deletePaymentLink");
                }}
                variant="destructive"
              >
                <span className={styles.menuItem}>
                  <Trash2 aria-hidden="true" className={styles.destructiveIcon} />
                  Eliminar link de pago
                </span>
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem
              onSelect={() => {
                setIsMenuOpen(false);
                window.setTimeout(() => {
                  onManagePaymentLink();
                }, 0);
              }}
            >
              <span className={styles.menuItem}>
                <Plus aria-hidden="true" />
                Agregar link de pago
              </span>
            </DropdownMenuItem>
          )}
          {shouldRenderFoldersSection ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Carpetas</DropdownMenuLabel>
            </>
          ) : null}
          {monthlyFolderViewUrl ? (
            <DropdownMenuItem asChild>
              <a
                href={monthlyFolderViewUrl}
                onClick={() => setIsMenuOpen(false)}
                rel="noopener noreferrer"
                target="_blank"
              >
                <span className={styles.menuItem}>
                  <Folder aria-hidden="true" />
                  Comprobantes del mes
                </span>
              </a>
            </DropdownMenuItem>
          ) : null}
          {allReceiptsFolderViewUrl ? (
            <DropdownMenuItem asChild>
              <a
                href={allReceiptsFolderViewUrl}
                onClick={() => setIsMenuOpen(false)}
                rel="noopener noreferrer"
                target="_blank"
              >
                <span className={styles.menuItem}>
                  <Folder aria-hidden="true" />
                  Archivo histórico de comprobantes
                </span>
              </a>
            </DropdownMenuItem>
          ) : null}
          {canDeleteMonthlyFolderReference ? (
            <DropdownMenuItem
              onSelect={() => {
                setIsMenuOpen(false);
                setConfirmActionType("deleteMonthlyFolderReference");
              }}
              variant="destructive"
            >
              <span className={styles.menuItem}>
                <FolderX aria-hidden="true" className={styles.destructiveIcon} />
                Quitar referencia de carpeta del mes actual
              </span>
            </DropdownMenuItem>
          ) : null}
          {canDeleteAllReceiptsFolderReference ? (
            <DropdownMenuItem
              onSelect={() => {
                setIsMenuOpen(false);
                setConfirmActionType("deleteAllReceiptsFolderReference");
              }}
              variant="destructive"
            >
              <span className={styles.menuItem}>
                <FolderX aria-hidden="true" className={styles.destructiveIcon} />
                Quitar referencia de carpeta de comprobantes
              </span>
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {confirmDialogConfig ? (
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialogConfig.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialogConfig.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              aria-label={confirmDialogConfig.ariaLabel}
              onClick={() => {
                setConfirmActionType(null);
                confirmDialogConfig.onConfirm();
              }}
              variant="destructive"
            >
              {confirmDialogConfig.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      ) : null}
    </AlertDialog>
  );
}
