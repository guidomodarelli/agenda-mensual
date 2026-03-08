import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import styles from "./confirm-delete-button.module.scss";

interface ConfirmDeleteButtonProps {
  confirmLabel?: string;
  message: string;
  menuAriaLabel?: string;
  onConfirm: () => void;
}

export function ConfirmDeleteButton({
  confirmLabel = "Confirmar",
  message,
  menuAriaLabel = "Abrir acciones",
  onConfirm,
}: ConfirmDeleteButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const updatePopoverPosition = () => {
    if (!triggerRef.current || typeof window === "undefined") {
      return;
    }

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 288;
    const popoverHeight = 140;
    const viewportPadding = 16;
    const fitsBelow =
      triggerRect.bottom + 8 + popoverHeight <= window.innerHeight - viewportPadding;
    const left = Math.min(
      Math.max(triggerRect.right - popoverWidth, viewportPadding),
      window.innerWidth - popoverWidth - viewportPadding,
    );
    const top = fitsBelow
      ? triggerRect.bottom + 8
      : Math.max(triggerRect.top - popoverHeight - 8, viewportPadding);

    setPopoverStyle({
      left,
      top,
    });
  };

  useEffect(() => {
    if (!isOpen || !triggerRef.current || typeof window === "undefined") {
      return;
    }

    updatePopoverPosition();
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);

    return () => {
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || typeof document === "undefined") {
      return;
    }

    const handleDocumentMouseDown = (event: MouseEvent) => {
      const eventTarget = event.target;

      if (!(eventTarget instanceof Node)) {
        return;
      }

      if (triggerRef.current?.contains(eventTarget)) {
        return;
      }

      if (popoverRef.current?.contains(eventTarget)) {
        return;
      }

      setIsOpen(false);
    };

    document.addEventListener("mousedown", handleDocumentMouseDown);

    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
    };
  }, [isOpen]);

  return (
    <div className={styles.root}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={menuAriaLabel}
            ref={triggerRef}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              updatePopoverPosition();
              setIsOpen(true);
            }}
            variant="destructive"
          >
            <Trash2 />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {isOpen && popoverStyle && typeof document !== "undefined"
        ? createPortal(
            <div className={styles.portalLayer}>
              <div
                aria-label={message}
                className={styles.popover}
                ref={popoverRef}
                role="dialog"
                style={popoverStyle}
              >
                <p className={styles.message}>{message}</p>
                <div className={styles.actions}>
                  <Button
                    onClick={() => setIsOpen(false)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => {
                      setIsOpen(false);
                      onConfirm();
                    }}
                    size="sm"
                    type="button"
                    variant="destructive"
                  >
                    {confirmLabel}
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
