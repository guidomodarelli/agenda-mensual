import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  type DropdownItem,
  type DropdownMenuSelection,
} from "@astra-kit/ui";
import { useState } from "react";
import {
  CalendarX2,
  Copy,
  DollarSign,
  Folder,
  FolderX,
  Link2,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";

import type {
  MonthlyExpenseUsdRateBase,
  MonthlyExpenseUsdRateSettings,
} from "./monthly-expenses-table.types";
import {
  USD_RATE_BASE_LABELS,
  USD_RATE_BASE_MENU_ORDER,
  USD_RATE_IIBB_SURCHARGE_LABEL,
  USD_RATE_IVA_SURCHARGE_LABEL,
} from "./usd-rate-type-labels";
import { GuardedDropdownMenu } from "./guarded-dropdown-menu";
import styles from "./expense-row-actions.module.scss";

interface ExpenseRowActionsProps {
  actionDisabled: boolean;
  allReceiptsFolderViewUrl: string | null;
  canDeleteAllReceiptsFolderReference: boolean;
  canDeleteMonthlyFolderReference: boolean;
  description: string;
  hasPaymentLink: boolean;
  /** Whether the expense is an open-ended recurring expense. */
  isRecurring: boolean;
  /** Whether the recurrence has already been cancelled (has an end month). */
  isRecurrenceCancelled: boolean;
  monthlyFolderViewUrl: string | null;
  onCancelRecurrence: () => void;
  onDeleteAllReceiptsFolderReference: () => void;
  onDelete: () => void;
  onDeleteMonthlyFolderReference: () => void;
  onDeletePaymentLink: () => void;
  /** Opens the expense sheet in create mode prefilled with this expense. */
  onDuplicate: () => void;
  /** Duplicates the expense straight into the following month. */
  onDuplicateToNextMonth: () => void;
  /** Opens the month picker to duplicate the expense into any month. */
  onDuplicateToPickedMonth: () => void;
  onEdit: () => void;
  onManagePaymentLink: () => void;
  onReactivateRecurrence: () => void;
  /**
   * Selects the USD base quote for a USD expense. `custom` is expected to
   * open the manual-rate dialog on the caller side.
   */
  onSelectUsdRateBase?: (usdRateBase: MonthlyExpenseUsdRateBase) => void;
  /** Toggles the IIBB / IVA surcharges over the current base. */
  onToggleUsdRateSurcharge?: (surcharge: "iibb" | "iva") => void;
  /** Current settings; the submenu renders only for USD expenses. */
  usdRate?: MonthlyExpenseUsdRateSettings;
}

export function ExpenseRowActions({
  actionDisabled,
  allReceiptsFolderViewUrl,
  canDeleteAllReceiptsFolderReference,
  canDeleteMonthlyFolderReference,
  description,
  hasPaymentLink,
  isRecurring,
  isRecurrenceCancelled,
  monthlyFolderViewUrl,
  onCancelRecurrence,
  onDeleteAllReceiptsFolderReference,
  onDelete,
  onDeleteMonthlyFolderReference,
  onDeletePaymentLink,
  onDuplicate,
  onDuplicateToNextMonth,
  onDuplicateToPickedMonth,
  onEdit,
  onManagePaymentLink,
  onReactivateRecurrence,
  onSelectUsdRateBase,
  onToggleUsdRateSurcharge,
  usdRate,
}: ExpenseRowActionsProps) {
  const normalizedDescription = description.trim() || "este gasto";
  const [confirmActionType, setConfirmActionType] = useState<
    | "deleteExpense"
    | "deleteMonthlyFolderReference"
    | "deleteAllReceiptsFolderReference"
    | "deletePaymentLink"
    | "cancelRecurrence"
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
          actionVariant: "danger" as const,
          description:
            "Esta acción guarda el cambio inmediatamente en tu archivo mensual.",
          onConfirm: onDelete,
          title: "¿Querés eliminar este gasto?",
        }
      : confirmActionType === "deleteMonthlyFolderReference"
        ? {
            actionLabel: "Quitar",
            ariaLabel: "Confirmar quitar referencia de carpeta del mes actual",
            actionVariant: "danger" as const,
            description:
              "Esta acción guarda el cambio inmediatamente en tu archivo mensual.",
            onConfirm: onDeleteMonthlyFolderReference,
            title: "¿Querés quitar la referencia de carpeta del mes actual?",
          }
        : confirmActionType === "deleteAllReceiptsFolderReference"
          ? {
              actionLabel: "Quitar",
              ariaLabel: "Confirmar quitar referencia de carpeta de comprobantes",
              actionVariant: "danger" as const,
              description:
                "Esta acción guarda el cambio inmediatamente en tu archivo mensual.",
              onConfirm: onDeleteAllReceiptsFolderReference,
              title: "¿Querés quitar la referencia de carpeta de comprobantes?",
            }
          : confirmActionType === "deletePaymentLink"
            ? {
                actionLabel: "Eliminar",
                ariaLabel: `Confirmar eliminación de link de pago para ${normalizedDescription}`,
                actionVariant: "danger" as const,
                description:
                  "Esta acción guarda el cambio inmediatamente en tu archivo mensual.",
                onConfirm: onDeletePaymentLink,
                title: "¿Querés eliminar este link de pago?",
              }
            : confirmActionType === "cancelRecurrence"
              ? {
                  actionLabel: "Cancelar recurrencia",
                  ariaLabel: `Confirmar cancelación de la recurrencia para ${normalizedDescription}`,
                  actionVariant: "primary" as const,
                  description:
                    "El gasto se sigue contando este mes y deja de repetirse en los meses siguientes. Para reactivarlo, abrí sus acciones desde el mes de la cancelación (o uno anterior) y elegí «Reactivar recurrencia».",
                  onConfirm: onCancelRecurrence,
                  title: "¿Querés cancelar la recurrencia?",
                }
              : null;

  const menuLabel = `Abrir acciones para ${normalizedDescription}`;
  const closeMenuThen = (action: () => void) => () => {
    setIsMenuOpen(false);
    window.setTimeout(action, 0);
  };
  const confirmFromMenu =
    (nextConfirmActionType: NonNullable<typeof confirmActionType>) => () => {
      setIsMenuOpen(false);
      setConfirmActionType(nextConfirmActionType);
    };
  const hasUsdRateActions = Boolean(
    onSelectUsdRateBase && onToggleUsdRateSurcharge && usdRate,
  );
  // Arc's menu has no submenus: each former submenu becomes a group of rows
  // that opens with a separator and keeps its context in the row labels.
  const menuItems: DropdownItem[] = [
    {
      icon: <Pencil aria-hidden="true" />,
      id: "edit",
      label: "Editar",
      onSelect: () => {
        setIsMenuOpen(false);
        onEdit();
      },
    },
    {
      icon: <Copy aria-hidden="true" />,
      id: "duplicate-current-month",
      label: "Duplicar en este mes",
      onSelect: () => {
        setIsMenuOpen(false);
        onDuplicate();
      },
      separatorBefore: true,
    },
    {
      id: "duplicate-next-month",
      label: "Duplicar en el mes siguiente",
      onSelect: closeMenuThen(onDuplicateToNextMonth),
    },
    {
      id: "duplicate-picked-month",
      label: "Duplicar en otro mes…",
      onSelect: closeMenuThen(onDuplicateToPickedMonth),
    },
    {
      destructive: true,
      icon: <Trash2 aria-hidden="true" />,
      id: "delete",
      label: "Eliminar",
      onSelect: confirmFromMenu("deleteExpense"),
      separatorBefore: true,
    },
  ];

  if (isRecurring) {
    menuItems.push(
      isRecurrenceCancelled
        ? {
            icon: <RotateCcw aria-hidden="true" />,
            id: "reactivate-recurrence",
            label: "Reactivar recurrencia",
            onSelect: closeMenuThen(onReactivateRecurrence),
            separatorBefore: true,
          }
        : {
            icon: <CalendarX2 aria-hidden="true" />,
            id: "cancel-recurrence",
            label: "Cancelar recurrencia",
            onSelect: confirmFromMenu("cancelRecurrence"),
            separatorBefore: true,
          },
    );
  }

  if (hasUsdRateActions && usdRate && onToggleUsdRateSurcharge) {
    menuItems.push(
      ...USD_RATE_BASE_MENU_ORDER.map((usdRateBase, usdRateBaseIndex) => ({
        icon: usdRateBaseIndex === 0 ? <DollarSign aria-hidden="true" /> : undefined,
        id: `usd-rate-base-${usdRateBase}`,
        label:
          usdRateBase === "custom"
            ? `${USD_RATE_BASE_LABELS.custom}…`
            : USD_RATE_BASE_LABELS[usdRateBase],
        separatorBefore: usdRateBaseIndex === 0,
        value: usdRateBase,
      })),
      {
        checked: usdRate.appliesIibb,
        id: "usd-rate-iibb",
        label: USD_RATE_IIBB_SURCHARGE_LABEL,
        // Keep the menu open so both surcharges can be toggled in one visit.
        onSelect: (event: Event) => {
          event.preventDefault();
          onToggleUsdRateSurcharge("iibb");
        },
      },
      {
        checked: usdRate.appliesIva,
        id: "usd-rate-iva",
        label: USD_RATE_IVA_SURCHARGE_LABEL,
        onSelect: (event: Event) => {
          event.preventDefault();
          onToggleUsdRateSurcharge("iva");
        },
      },
    );
  }

  menuItems.push(
    ...(hasPaymentLink
      ? [
          {
            icon: <Link2 aria-hidden="true" />,
            id: "edit-payment-link",
            label: "Editar link de pago",
            onSelect: closeMenuThen(onManagePaymentLink),
            separatorBefore: true,
          },
          {
            destructive: true,
            icon: <Trash2 aria-hidden="true" />,
            id: "delete-payment-link",
            label: "Eliminar link de pago",
            onSelect: confirmFromMenu("deletePaymentLink"),
          },
        ]
      : [
          {
            icon: <Plus aria-hidden="true" />,
            id: "add-payment-link",
            label: "Agregar link de pago",
            onSelect: closeMenuThen(onManagePaymentLink),
            separatorBefore: true,
          },
        ]),
  );

  if (shouldRenderFoldersSection) {
    const folderItems: DropdownItem[] = [];

    if (monthlyFolderViewUrl) {
      folderItems.push({
        href: monthlyFolderViewUrl,
        icon: <Folder aria-hidden="true" />,
        id: "monthly-folder",
        label: "Comprobantes del mes",
        rel: "noopener noreferrer",
        target: "_blank",
      });
    }

    if (allReceiptsFolderViewUrl) {
      folderItems.push({
        href: allReceiptsFolderViewUrl,
        icon: <Folder aria-hidden="true" />,
        id: "all-receipts-folder",
        label: "Archivo histórico de comprobantes",
        rel: "noopener noreferrer",
        target: "_blank",
      });
    }

    if (canDeleteMonthlyFolderReference) {
      folderItems.push({
        destructive: true,
        icon: <FolderX aria-hidden="true" />,
        id: "delete-monthly-folder-reference",
        label: "Quitar referencia de carpeta del mes actual",
        onSelect: confirmFromMenu("deleteMonthlyFolderReference"),
      });
    }

    if (canDeleteAllReceiptsFolderReference) {
      folderItems.push({
        destructive: true,
        icon: <FolderX aria-hidden="true" />,
        id: "delete-all-receipts-folder-reference",
        label: "Quitar referencia de carpeta de comprobantes",
        onSelect: confirmFromMenu("deleteAllReceiptsFolderReference"),
      });
    }

    const [firstFolderItem, ...remainingFolderItems] = folderItems;

    if (firstFolderItem) {
      menuItems.push(
        { ...firstFolderItem, separatorBefore: true },
        ...remainingFolderItems,
      );
    }
  }

  const usdRateSelection: DropdownMenuSelection | undefined =
    hasUsdRateActions && usdRate && onSelectUsdRateBase
      ? {
          onValueChange: (nextUsdRateBase) => {
            setIsMenuOpen(false);
            window.setTimeout(() => {
              onSelectUsdRateBase(nextUsdRateBase as MonthlyExpenseUsdRateBase);
            }, 0);
          },
          value: usdRate.base,
        }
      : undefined;

  return (
    <Dialog
      alert
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setConfirmActionType(null);
        }
      }}
      open={confirmActionType !== null}
    >
      <GuardedDropdownMenu
        disabled={actionDisabled}
        align="end"
        items={menuItems}
        label={menuLabel}
        onOpenChange={setIsMenuOpen}
        open={isMenuOpen}
        selection={usdRateSelection}
        trigger={
          <Button
            aria-label={menuLabel}
            className={styles.trigger}
            disabled={actionDisabled}
            size="sm"
            type="button"
            variant="ghost"
          >
            <MoreVertical aria-hidden="true" />
          </Button>
        }
      />

      {confirmDialogConfig ? (
        <DialogContent
          title={confirmDialogConfig.title}
          description={confirmDialogConfig.description}
          footer={
            <>
              <DialogClose asChild>
                <Button variant="secondary">Cancelar</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button
                  aria-label={confirmDialogConfig.ariaLabel}
                  onClick={() => {
                    setConfirmActionType(null);
                    confirmDialogConfig.onConfirm();
                  }}
                  variant={confirmDialogConfig.actionVariant}
                >
                  {confirmDialogConfig.actionLabel}
                </Button>
              </DialogClose>
            </>
          }
        />
      ) : null}
    </Dialog>
  );
}
