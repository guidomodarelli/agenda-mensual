import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  type DropdownItem,
} from "@astra-kit/ui";
import { useState } from "react";

import { MoreVertical, Pencil, Trash2 } from "lucide-react";

import { GuardedDropdownMenu } from "./guarded-dropdown-menu";
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
  const triggerLabel = `${triggerAriaLabel} para ${normalizedExpenseDescription}`;
  const menuItems: DropdownItem[] = [
    {
      icon: <Pencil aria-hidden="true" />,
      id: "edit",
      label: editActionLabel,
      onSelect: () => {
        setIsMenuOpen(false);
        window.setTimeout(() => {
          onEdit();
        }, 0);
      },
    },
  ];

  if (onDelete) {
    menuItems.push({
      destructive: true,
      icon: <Trash2 aria-hidden="true" />,
      id: "delete",
      label: deleteActionLabel ?? "Eliminar",
      onSelect: () => {
        setIsMenuOpen(false);
        window.setTimeout(() => {
          if (shouldConfirmDelete) {
            setIsConfirmDialogOpen(true);
            return;
          }

          void onDelete();
        }, 0);
      },
    });
  }

  return (
    <Dialog
      alert
      onOpenChange={setIsConfirmDialogOpen}
      open={isConfirmDialogOpen}
    >
      <GuardedDropdownMenu
        disabled={actionDisabled}
        align="end"
        items={menuItems}
        label={triggerLabel}
        onOpenChange={setIsMenuOpen}
        open={isMenuOpen}
        trigger={
          <Button
            aria-label={triggerLabel}
            className={styles.paymentLinkActionButton}
            disabled={actionDisabled}
            size="sm"
            type="button"
            variant="ghost"
          >
            <MoreVertical aria-hidden="true" className={styles.paymentLinkIcon} />
          </Button>
        }
      />
      {onDelete && shouldConfirmDelete ? (
        <DialogContent
          description={confirmDeleteActionDescription}
          footer={
            <>
              <DialogClose asChild>
                <Button variant="secondary">Cancelar</Button>
              </DialogClose>
              <Button
                aria-label={
                  confirmDeleteActionAriaLabel ??
                  `Confirmar eliminación para ${normalizedExpenseDescription}`
                }
                onClick={() => {
                  setIsConfirmDialogOpen(false);
                  void onDelete();
                }}
                variant="danger"
              >
                Eliminar
              </Button>
            </>
          }
          title={confirmDeleteActionTitle}
        />
      ) : null}
    </Dialog>
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
    <Dialog
      alert
      onOpenChange={setIsConfirmDialogOpen}
      open={isConfirmDialogOpen}
    >
      <GuardedDropdownMenu
        disabled={actionDisabled}
        align="end"
        items={[
          {
            icon: <Pencil aria-hidden="true" />,
            id: "edit",
            label: editActionLabel,
            onSelect: () => {
              setIsMenuOpen(false);
              window.setTimeout(() => {
                onEdit();
              }, 0);
            },
          },
          {
            destructive: true,
            icon: <Trash2 aria-hidden="true" />,
            id: "delete",
            label: deleteActionLabel,
            onSelect: () => {
              setIsMenuOpen(false);
              window.setTimeout(() => {
                setIsConfirmDialogOpen(true);
              }, 0);
            },
          },
        ]}
        label={triggerAriaLabel}
        onOpenChange={setIsMenuOpen}
        open={isMenuOpen}
        trigger={
          <Button
            aria-label={triggerAriaLabel}
            className={styles.paymentLinkActionButton}
            disabled={actionDisabled}
            size="sm"
            type="button"
            variant="ghost"
          >
            <MoreVertical aria-hidden="true" className={styles.paymentLinkIcon} />
          </Button>
        }
      />
      <DialogContent
        description={confirmDeleteActionDescription}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button
              aria-label={confirmDeleteActionAriaLabel}
              onClick={() => {
                setIsConfirmDialogOpen(false);
                void onDelete();
              }}
              variant="danger"
            >
              Eliminar
            </Button>
          </>
        }
        title={confirmDeleteActionTitle}
      />
    </Dialog>
  );
}
