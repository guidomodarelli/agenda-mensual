import { useState } from "react";

import { MoreVertical, Pencil, Trash2 } from "lucide-react";

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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import styles from "./monthly-expenses-table.module.scss";

interface PaymentRecordActionsMenuProps {
  actionDisabled: boolean;
  confirmDeleteActionAriaLabel: string;
  confirmDeleteActionDescription: string;
  confirmDeleteActionTitle: string;
  deleteActionLabel: string;
  editActionLabel: string;
  onDelete: () => void | Promise<void>;
  onEdit: () => void;
  triggerAriaLabel: string;
}

interface QuickEditActionsMenuProps {
  actionDisabled: boolean;
  confirmDeleteActionAriaLabel?: string;
  confirmDeleteActionDescription?: string;
  confirmDeleteActionTitle?: string;
  deleteActionLabel?: string;
  editActionLabel: string;
  expenseDescription: string;
  onDelete?: () => void | Promise<void>;
  onEdit: () => void;
  triggerAriaLabel: string;
}

/**
 * Trigger + dropdown for editing/deleting an expense-level quick action, with an
 * optional confirmation dialog when delete needs a title/description.
 */
export function QuickEditActionsMenu({
  actionDisabled,
  confirmDeleteActionAriaLabel,
  confirmDeleteActionDescription,
  confirmDeleteActionTitle,
  deleteActionLabel,
  editActionLabel,
  expenseDescription,
  onDelete,
  onEdit,
  triggerAriaLabel,
}: QuickEditActionsMenuProps) {
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const normalizedExpenseDescription =
    expenseDescription.trim() || "gasto";
  const shouldConfirmDelete =
    Boolean(confirmDeleteActionTitle) && Boolean(confirmDeleteActionDescription);

  return (
    <AlertDialog onOpenChange={setIsConfirmDialogOpen} open={isConfirmDialogOpen}>
      <DropdownMenu onOpenChange={setIsMenuOpen} open={isMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={`${triggerAriaLabel} para ${normalizedExpenseDescription}`}
            className={styles.paymentLinkActionButton}
            disabled={actionDisabled}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <MoreVertical aria-hidden="true" className={styles.paymentLinkIcon} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setIsMenuOpen(false);
              window.setTimeout(() => {
                onEdit();
              }, 0);
            }}
          >
            <Pencil aria-hidden="true" />
            {editActionLabel}
          </DropdownMenuItem>
          {onDelete ? (
            <DropdownMenuItem
              onSelect={() => {
                setIsMenuOpen(false);
                window.setTimeout(() => {
                  if (shouldConfirmDelete) {
                    setIsConfirmDialogOpen(true);
                    return;
                  }

                  void onDelete();
                }, 0);
              }}
              variant="destructive"
            >
              <Trash2 aria-hidden="true" />
              {deleteActionLabel ?? "Eliminar"}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {onDelete && shouldConfirmDelete ? (
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDeleteActionTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDeleteActionDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              aria-label={
                confirmDeleteActionAriaLabel ??
                `Confirmar eliminación para ${normalizedExpenseDescription}`
              }
              onClick={() => {
                setIsConfirmDialogOpen(false);
                void onDelete();
              }}
              variant="destructive"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      ) : null}
    </AlertDialog>
  );
}

/**
 * Trigger + dropdown for editing/deleting a single payment record, always paired
 * with a confirmation dialog for the destructive delete action.
 */
export function PaymentRecordActionsMenu({
  actionDisabled,
  confirmDeleteActionAriaLabel,
  confirmDeleteActionDescription,
  confirmDeleteActionTitle,
  deleteActionLabel,
  editActionLabel,
  onDelete,
  onEdit,
  triggerAriaLabel,
}: PaymentRecordActionsMenuProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);

  return (
    <AlertDialog onOpenChange={setIsConfirmDialogOpen} open={isConfirmDialogOpen}>
      <DropdownMenu onOpenChange={setIsMenuOpen} open={isMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={triggerAriaLabel}
            className={styles.paymentLinkActionButton}
            disabled={actionDisabled}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <MoreVertical aria-hidden="true" className={styles.paymentLinkIcon} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setIsMenuOpen(false);
              window.setTimeout(() => {
                onEdit();
              }, 0);
            }}
          >
            <Pencil aria-hidden="true" />
            {editActionLabel}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setIsMenuOpen(false);
              window.setTimeout(() => {
                setIsConfirmDialogOpen(true);
              }, 0);
            }}
            variant="destructive"
          >
            <Trash2 aria-hidden="true" />
            {deleteActionLabel}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{confirmDeleteActionTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {confirmDeleteActionDescription}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            aria-label={confirmDeleteActionAriaLabel}
            onClick={() => {
              setIsConfirmDialogOpen(false);
              void onDelete();
            }}
            variant="destructive"
          >
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
