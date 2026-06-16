import { useCallback, useState } from "react";

import { Clock3, ExternalLink, Mail, Paperclip, Plus } from "lucide-react";

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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { DriveStatusBadge } from "./drive-status-badge";
import {
  PaymentRecordActionsMenu,
  QuickEditActionsMenu,
} from "./expense-action-menus";
import { formatReceiptSharePhoneDisplay } from "./expense-edit-validation";
import { getReceiptShareProgress } from "./monthly-expenses-receipt-share";
import type {
  MonthlyExpenseReceiptShareStatus,
  MonthlyExpensesEditablePaymentRecord,
  MonthlyExpensesEditableReceipt,
  MonthlyExpensesEditableRow,
} from "./monthly-expenses-table.types";
import { getValidPaymentLink } from "./payment-link";
import { ReceiptFileUploader } from "./receipt-file-uploader";

import styles from "./monthly-expenses-table.module.scss";

function getReceiptShareStatusLabel(
  status: MonthlyExpenseReceiptShareStatus,
): string {
  return status === "sent" ? "Enviado" : "Pendiente";
}

function getReceiptShareStatusIcon(
  status: MonthlyExpenseReceiptShareStatus,
): typeof Clock3 {
  return status === "sent" ? Mail : Clock3;
}

function getReceiptShareStatusToneClassName(
  args: {
    isPaymentFullyCompleted: boolean;
    status: MonthlyExpenseReceiptShareStatus;
  },
): string {
  if (args.status === "sent") {
    return styles.receiptShareStatusSent;
  }

  return args.isPaymentFullyCompleted
    ? styles.receiptShareStatusPending
    : "";
}

function getReceiptShareMessage(value: string): string | null {
  const normalizedMessage = value.trim();

  return normalizedMessage.length > 0 ? normalizedMessage : null;
}

/**
 * Builds the WhatsApp deep link to share a single payment's receipt with the
 * expense recipient. The recipient (phone + optional message) is shared expense
 * configuration, while the shared file is the receipt of that specific payment.
 *
 * @param destination - Expense-level recipient configuration.
 * @param receipt - Receipt attached to the payment being shared.
 * @returns The WhatsApp link, or `null` when sharing is not configured or the
 *   payment has no receipt URL.
 */
function getPaymentRecordWhatsAppLink(
  destination: Pick<
    MonthlyExpensesEditableRow,
    "receiptShareMessage" | "receiptSharePhoneDigits" | "requiresReceiptShare"
  >,
  receipt: MonthlyExpensesEditableReceipt | undefined,
): string | null {
  if (!destination.requiresReceiptShare) {
    return null;
  }

  const phoneDigits = destination.receiptSharePhoneDigits.trim();

  if (!phoneDigits) {
    return null;
  }

  const receiptUrl = receipt ? receipt.fileViewUrl.trim() : "";

  if (!receiptUrl) {
    return null;
  }

  const receiptShareMessage = `Comprobante: ${receiptUrl}`;
  const normalizedMessage = getReceiptShareMessage(destination.receiptShareMessage);
  const fullMessage = normalizedMessage
    ? `${receiptShareMessage}\n\n${normalizedMessage}`
    : receiptShareMessage;

  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(fullMessage)}`;
}


/**
 * Formats an ISO datetime for the payment history popover.
 *
 * @param isoDatetime - Datetime string to render.
 * @returns A DD/MM/YYYY label in Spanish locale.
 */
function formatPaymentRecordDate(isoDatetime: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(isoDatetime));
}

/**
 * Sorts payment records using the newest registration date first.
 *
 * @param leftRecord - Left record to compare.
 * @param rightRecord - Right record to compare.
 * @returns Positive when right should come first.
 */
function sortPaymentRecordsByDateDescending(
  leftRecord: MonthlyExpensesEditablePaymentRecord,
  rightRecord: MonthlyExpensesEditablePaymentRecord,
): number {
  const leftTimestamp = leftRecord.registeredAt
    ? new Date(leftRecord.registeredAt).getTime()
    : Number.NEGATIVE_INFINITY;
  const rightTimestamp = rightRecord.registeredAt
    ? new Date(rightRecord.registeredAt).getTime()
    : Number.NEGATIVE_INFINITY;

  if (leftTimestamp !== rightTimestamp) {
    return rightTimestamp - leftTimestamp;
  }

  return leftRecord.id.localeCompare(rightRecord.id);
}

export function PaymentHistoryCell({
  actionDisabled,
  expenseDescription,
  expenseId,
  maxPaymentsPerRecord,
  onRegisterPaymentRecord,
  onDeleteManualPaymentRecord,
  onDeleteReceipt,
  onDeleteExpenseReceiptShare,
  onEditManualPaymentRecord,
  onEditReceiptCoverage,
  onOpenReceiptShareDialog,
  onUpdatePaymentRecordSendStatus,
  paymentRecords,
  receiptShareMessage,
  receiptSharePhoneDigits,
  requiresReceiptShare,
}: {
  actionDisabled: boolean;
  expenseDescription: string;
  expenseId: string;
  maxPaymentsPerRecord: number;
  onRegisterPaymentRecord: (args: {
    coveredPayments: number;
    expenseId: string;
    file: File | null;
  }) => Promise<boolean>;
  onDeleteManualPaymentRecord: (args: {
    expenseId: string;
    paymentRecordId: string;
  }) => void;
  onDeleteReceipt: (args: {
    expenseId: string;
    receiptFileId: string;
  }) => void;
  onDeleteExpenseReceiptShare: (expenseId: string) => void | Promise<void>;
  onEditManualPaymentRecord: (args: {
    expenseId: string;
    paymentRecordId: string;
  }) => void;
  onEditReceiptCoverage: (args: {
    expenseId: string;
    receiptFileId: string;
  }) => void;
  onOpenReceiptShareDialog: (args: {
    expenseDescription: string;
    expenseId: string;
    mode: "create" | "edit";
    receiptShareMessage: string;
    receiptSharePhoneDigits: string;
  }) => void;
  onUpdatePaymentRecordSendStatus: (args: {
    expenseId: string;
    paymentRecordId: string;
    sendStatus: MonthlyExpenseReceiptShareStatus;
  }) => void | Promise<void>;
  paymentRecords: MonthlyExpensesEditablePaymentRecord[];
  receiptShareMessage: string;
  receiptSharePhoneDigits: string;
  requiresReceiptShare: boolean;
}) {
  const [manualRecordDraft, setManualRecordDraft] = useState("1");
  const [selectedReceiptFile, setSelectedReceiptFile] = useState<File | null>(null);
  const [paymentRegistrationError, setPaymentRegistrationError] =
    useState<string | null>(null);
  const [isRegisterPaymentDialogOpen, setIsRegisterPaymentDialogOpen] =
    useState(false);
  const [isRegisterPaymentSubmitting, setIsRegisterPaymentSubmitting] =
    useState(false);
  const registerPaymentInputId = `${expenseId}-register-payments-input`;
  const registerPaymentReceiptInputId = `${expenseId}-register-payment-receipt-input`;
  const sortedPaymentRecords = [...paymentRecords].sort(
    sortPaymentRecordsByDateDescending,
  );
  const receiptPaymentRecordsCount = paymentRecords.filter(
    (paymentRecord) => Boolean(paymentRecord.receipt),
  ).length;
  const hasPaymentRecords = paymentRecords.length > 0;
  const recordsCountLabel = paymentRecords.length === 1
    ? "registro"
    : "registros";
  const receiptShareDestination = {
    receiptShareMessage,
    receiptSharePhoneDigits,
    requiresReceiptShare,
  };
  const receiptShareProgress = getReceiptShareProgress({
    paymentRecords,
    requiresReceiptShare,
  });
  const trimmedReceiptSharePhone = receiptSharePhoneDigits.trim();
  const hasReceiptShareTarget =
    requiresReceiptShare && trimmedReceiptSharePhone.length > 0;
  const formattedReceiptSharePhone =
    formatReceiptSharePhoneDisplay(trimmedReceiptSharePhone) ||
    trimmedReceiptSharePhone;
  const parsedManualCoveredPayments = Number(manualRecordDraft);
  const hasValidManualDraft =
    Number.isInteger(parsedManualCoveredPayments) &&
    parsedManualCoveredPayments >= 1 &&
    parsedManualCoveredPayments <= maxPaymentsPerRecord;

  const resetRegisterPaymentForm = useCallback(() => {
    setManualRecordDraft("1");
    setSelectedReceiptFile(null);
    setPaymentRegistrationError(null);
    setIsRegisterPaymentSubmitting(false);
  }, []);

  const handleRegisterPaymentDialogOpenChange = useCallback(
    (nextOpen: boolean) => {
      setIsRegisterPaymentDialogOpen(nextOpen);

      if (!nextOpen) {
        resetRegisterPaymentForm();
      }
    },
    [resetRegisterPaymentForm],
  );

  const handleRegisterPaymentRecord = useCallback(async () => {
    if (!hasValidManualDraft) {
      setPaymentRegistrationError(
        `Ingresá una cantidad de pagos válida entre 1 y ${maxPaymentsPerRecord}.`,
      );
      return;
    }

    setIsRegisterPaymentSubmitting(true);
    setPaymentRegistrationError(null);

    const wasRegistered = await onRegisterPaymentRecord({
      coveredPayments: parsedManualCoveredPayments,
      expenseId,
      file: selectedReceiptFile,
    });

    if (!wasRegistered) {
      setIsRegisterPaymentSubmitting(false);
      setPaymentRegistrationError("No pudimos registrar el pago. Volvé a intentar.");
      return;
    }

    setIsRegisterPaymentDialogOpen(false);
    resetRegisterPaymentForm();
  }, [
    expenseId,
    hasValidManualDraft,
    maxPaymentsPerRecord,
    onRegisterPaymentRecord,
    parsedManualCoveredPayments,
    resetRegisterPaymentForm,
    selectedReceiptFile,
  ]);

  return (
    <div className={styles.receiptActionsCell}>
      <Dialog
        onOpenChange={handleRegisterPaymentDialogOpenChange}
        open={isRegisterPaymentDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar nuevo pago</DialogTitle>
            <DialogDescription>
              Elegí la cantidad de pagos y, si querés, adjuntá un comprobante.
            </DialogDescription>
          </DialogHeader>
          <div className={styles.manualPaymentsCell}>
            <Label htmlFor={registerPaymentInputId}>¿Cuántos pagos desea cubrir?</Label>
            <Input
              aria-label="¿Cuántos pagos desea cubrir?"
              className={styles.manualPaymentsInput}
              disabled={actionDisabled || maxPaymentsPerRecord <= 0}
              id={registerPaymentInputId}
              inputMode="numeric"
              max={maxPaymentsPerRecord}
              min={1}
              onChange={(event) => setManualRecordDraft(event.target.value)}
              type="number"
              value={manualRecordDraft}
            />
            <Label htmlFor={registerPaymentReceiptInputId}>Adjuntar comprobante (opcional):</Label>
            <ReceiptFileUploader
              errorMessage={null}
              inputId={registerPaymentReceiptInputId}
              inputAriaLabel="Seleccionar comprobante"
              isDisabled={actionDisabled || maxPaymentsPerRecord <= 0}
              isUploading={isRegisterPaymentSubmitting}
              onFileChange={setSelectedReceiptFile}
              selectedFile={selectedReceiptFile}
            />
            {paymentRegistrationError ? (
              <span className={styles.manualPaymentsHint}>{paymentRegistrationError}</span>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              onClick={() => handleRegisterPaymentDialogOpenChange(false)}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
            <Button
              disabled={
                actionDisabled ||
                isRegisterPaymentSubmitting ||
                maxPaymentsPerRecord <= 0 ||
                !hasValidManualDraft
              }
              onClick={() => {
                void handleRegisterPaymentRecord();
              }}
              type="button"
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {!hasPaymentRecords ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label={`Agregar nuevo registro de pago para ${expenseDescription}`}
              className={styles.paymentLinkActionButton}
              disabled={actionDisabled || maxPaymentsPerRecord <= 0}
              onClick={() => setIsRegisterPaymentDialogOpen(true)}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <Plus aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Agregar nuevo registro de pago</TooltipContent>
        </Tooltip>
      ) : (
        <Popover>
          <PopoverTrigger asChild>
            <Button className={styles.extraReceiptsTrigger} type="button" variant="link">
              {`${paymentRecords.length} ${recordsCountLabel}`}
              {receiptPaymentRecordsCount > 0 ? (
                <span className={styles.receiptCountIndicator}>
                  {" ("}
                  <Paperclip aria-hidden="true" className={styles.receiptCountIcon} />
                  {"\u00A0"}
                  {receiptPaymentRecordsCount}
                  {")"}
                </span>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className={styles.extraReceiptsPopover}>
            <div className={styles.extraReceiptsList}>
              <div className={styles.receiptShareTargetRow}>
                {hasReceiptShareTarget ? (
                  <>
                    <span className={styles.receiptShareTargetLabel}>
                      <Mail aria-hidden="true" className={styles.receiptLinkIcon} />
                      {`Enviar a ${formattedReceiptSharePhone}`}
                    </span>
                    <QuickEditActionsMenu
                      actionDisabled={actionDisabled}
                      confirmDeleteActionAriaLabel={`Confirmar eliminación de datos de envío para ${expenseDescription}`}
                      confirmDeleteActionDescription="Esta acción borra el número de WhatsApp y el mensaje guardado para compartir comprobantes."
                      confirmDeleteActionTitle="¿Querés eliminar estos datos de envío?"
                      deleteActionLabel="Eliminar datos de envío"
                      editActionLabel="Editar datos de envío"
                      expenseDescription={expenseDescription}
                      onDelete={() => onDeleteExpenseReceiptShare(expenseId)}
                      onEdit={() =>
                        onOpenReceiptShareDialog({
                          expenseId,
                          expenseDescription,
                          mode: "edit",
                          receiptShareMessage,
                          receiptSharePhoneDigits,
                        })}
                      triggerAriaLabel="Abrir acciones de envío"
                    />
                  </>
                ) : (
                  <Button
                    aria-label={`Agregar datos de envío para ${expenseDescription}`}
                    className={styles.manualPaymentsRegisterButton}
                    disabled={actionDisabled}
                    onClick={() =>
                      onOpenReceiptShareDialog({
                        expenseId,
                        expenseDescription,
                        mode: "create",
                        receiptShareMessage,
                        receiptSharePhoneDigits,
                      })}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Plus aria-hidden="true" />
                    Agregar datos de envío
                  </Button>
                )}
              </div>
              <div className={styles.manualPaymentsControls}>
                <Button
                  aria-label={`Agregar nuevo registro de pago para ${expenseDescription}`}
                  className={styles.manualPaymentsRegisterButton}
                  disabled={actionDisabled || maxPaymentsPerRecord <= 0}
                  onClick={() => setIsRegisterPaymentDialogOpen(true)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Plus aria-hidden="true" />
                  Agregar nuevo registro de pago
                </Button>
              </div>
              {sortedPaymentRecords.map((paymentRecord) => {
              const displayDate = paymentRecord.registeredAt
                ? formatPaymentRecordDate(paymentRecord.registeredAt)
                : "Sin fecha";
              const paymentsLabel = paymentRecord.coveredPayments === 1
                ? "pago"
                : "pagos";
              const recordLabel =
                `${displayDate} — ${paymentRecord.coveredPayments} ${paymentsLabel}`;
              const receiptFileUrl = paymentRecord.receipt
                ? getValidPaymentLink(paymentRecord.receipt.fileViewUrl)
                : null;
              const paymentSendStatus =
                paymentRecord.sendStatus === "sent" ? "sent" : "pending";
              const paymentWhatsAppLink = getPaymentRecordWhatsAppLink(
                receiptShareDestination,
                paymentRecord.receipt,
              );
              const paymentRecordActions = paymentRecord.receipt
                ? {
                    confirmDeleteActionAriaLabel:
                      `Confirmar eliminación de comprobante ${paymentRecord.receipt.fileName}`,
                    confirmDeleteActionTitle: "¿Querés eliminar este comprobante?",
                    deleteActionLabel: "Eliminar registro",
                    editActionLabel: "Editar registro",
                    onDelete: () =>
                      onDeleteReceipt({
                        expenseId,
                        receiptFileId: paymentRecord.receipt?.fileId ?? "",
                      }),
                    onEdit: () =>
                      onEditReceiptCoverage({
                        expenseId,
                        receiptFileId: paymentRecord.receipt?.fileId ?? "",
                      }),
                    triggerAriaLabel:
                      `Abrir acciones de registro de pago para comprobante ${paymentRecord.receipt.fileName} de ${expenseDescription}`,
                  }
                : {
                    confirmDeleteActionAriaLabel:
                      `Confirmar eliminación de registro manual de ${expenseDescription}`,
                    confirmDeleteActionTitle: "¿Querés eliminar este registro manual?",
                    deleteActionLabel: "Eliminar registro",
                    editActionLabel: "Editar registro",
                    onDelete: () =>
                      onDeleteManualPaymentRecord({
                        expenseId,
                        paymentRecordId: paymentRecord.id,
                      }),
                    onEdit: () =>
                      onEditManualPaymentRecord({
                        expenseId,
                        paymentRecordId: paymentRecord.id,
                      }),
                    triggerAriaLabel:
                      `Abrir acciones de registro manual ${recordLabel} para ${expenseDescription}`,
                  };

              return (
                <div className={styles.extraReceiptRow} key={paymentRecord.id}>
                  {paymentRecord.receipt
                    ? <DriveStatusBadge status={paymentRecord.receipt.fileStatus} />
                    : null}
                  <div className={styles.extraReceiptInfo}>
                    <span>{recordLabel}</span>
                    {paymentRecord.receipt && receiptFileUrl
                      ? (
                          <a
                            className={styles.paymentLinkAction}
                            href={receiptFileUrl}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            <Paperclip
                              aria-hidden="true"
                              className={styles.receiptLinkIcon}
                            />
                            Ver comprobante
                            <ExternalLink
                              aria-hidden="true"
                              className={styles.paymentLinkIcon}
                            />
                          </a>
                        )
                      : null}
                  </div>
                  <div className={styles.paymentRecordActions}>
                    <PaymentRecordActionsMenu
                      actionDisabled={actionDisabled}
                      confirmDeleteActionAriaLabel={
                        paymentRecordActions.confirmDeleteActionAriaLabel
                      }
                      confirmDeleteActionDescription="Esta acción guarda el cambio inmediatamente en tu archivo mensual."
                      confirmDeleteActionTitle={paymentRecordActions.confirmDeleteActionTitle}
                      deleteActionLabel={paymentRecordActions.deleteActionLabel}
                      editActionLabel={paymentRecordActions.editActionLabel}
                      onDelete={paymentRecordActions.onDelete}
                      onEdit={paymentRecordActions.onEdit}
                      triggerAriaLabel={paymentRecordActions.triggerAriaLabel}
                    />
                  </div>
                  {paymentRecord.receipt && requiresReceiptShare ? (
                    <div className={styles.paymentRecordSendControls}>
                      <Select
                        onValueChange={(value) => {
                          void onUpdatePaymentRecordSendStatus({
                            expenseId,
                            paymentRecordId: paymentRecord.id,
                            sendStatus: value as MonthlyExpenseReceiptShareStatus,
                          });
                        }}
                        value={paymentSendStatus}
                      >
                        <SelectTrigger
                          aria-label={`Estado de envío de ${recordLabel} para ${expenseDescription}`}
                          className={cn(
                            styles.receiptShareStatusControl,
                            getReceiptShareStatusToneClassName({
                              isPaymentFullyCompleted: true,
                              status: paymentSendStatus,
                            }),
                          )}
                        >
                          <SelectValue>
                            <span className={styles.receiptShareStatusValue}>
                              {(() => {
                                const StatusIcon =
                                  getReceiptShareStatusIcon(paymentSendStatus);

                                return (
                                  <StatusIcon
                                    aria-hidden="true"
                                    className={styles.paymentLinkIcon}
                                  />
                                );
                              })()}
                              <span>
                                {getReceiptShareStatusLabel(paymentSendStatus)}
                              </span>
                            </span>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">
                            <span className={styles.receiptShareStatusValue}>
                              <Clock3
                                aria-hidden="true"
                                className={styles.paymentLinkIcon}
                              />
                              <span>Pendiente</span>
                            </span>
                          </SelectItem>
                          <SelectItem value="sent">
                            <span className={styles.receiptShareStatusValue}>
                              <Mail
                                aria-hidden="true"
                                className={styles.paymentLinkIcon}
                              />
                              <span>Enviado</span>
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {paymentWhatsAppLink ? (
                        <a
                          className={styles.paymentLinkAction}
                          href={paymentWhatsAppLink}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          Enviar
                          <ExternalLink
                            aria-hidden="true"
                            className={styles.paymentLinkIcon}
                          />
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
              })}
            </div>
          </PopoverContent>
        </Popover>
      )}
      {receiptShareProgress ? (
        <span
          className={cn(
            styles.receiptShareProgressChip,
            receiptShareProgress.sentCount >= receiptShareProgress.receiptCount
              ? styles.receiptShareProgressChipComplete
              : undefined,
          )}
        >
          <Mail aria-hidden="true" className={styles.receiptCountIcon} />
          {`${receiptShareProgress.sentCount}/${receiptShareProgress.receiptCount} enviados`}
        </span>
      ) : null}
    </div>
  );
}
