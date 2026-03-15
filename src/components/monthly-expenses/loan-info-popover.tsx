import { useRef, useState } from "react";
import { Info, X } from "lucide-react";
import { Tooltip as TooltipPrimitive } from "radix-ui";

import { Button } from "@/components/ui/button";

import styles from "./loan-info-popover.module.scss";

interface LoanInfoPopoverProps {
  closeLabel?: string;
  message: string;
  triggerLabel?: string;
  usePortal?: boolean;
}

export function LoanInfoPopover({
  closeLabel = "Cerrar ayuda sobre deuda o préstamo",
  message,
  triggerLabel = "Más información sobre deuda o préstamo",
  usePortal = true,
}: LoanInfoPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const tooltipContent = (
    <TooltipPrimitive.Content
      align="center"
      className={styles.popover}
      collisionPadding={16}
      onEscapeKeyDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsOpen(false);
      }}
      onPointerDownOutside={(event) => {
        const eventTarget = event.target;

        if (
          eventTarget instanceof Node &&
          triggerRef.current?.contains(eventTarget)
        ) {
          return;
        }

        setIsOpen(false);
      }}
      side="top"
      sideOffset={10}
    >
      <Button
        aria-label={closeLabel}
        className={styles.closeButton}
        onClick={() => setIsOpen(false)}
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        <X aria-hidden="true" className={styles.closeIcon} />
      </Button>
      <p className={styles.message}>{message}</p>
    </TooltipPrimitive.Content>
  );

  return (
    <TooltipPrimitive.Root open={isOpen}>
      <TooltipPrimitive.Trigger asChild>
        <Button
          aria-expanded={isOpen}
          aria-label={triggerLabel}
          className={styles.trigger}
          onClick={() => setIsOpen((currentOpen) => !currentOpen)}
          ref={triggerRef}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <Info aria-hidden="true" className={styles.triggerIcon} />
        </Button>
      </TooltipPrimitive.Trigger>

      {usePortal ? (
        <TooltipPrimitive.Portal>{tooltipContent}</TooltipPrimitive.Portal>
      ) : (
        tooltipContent
      )}
    </TooltipPrimitive.Root>
  );
}
