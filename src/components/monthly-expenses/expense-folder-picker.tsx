import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import {
  ExpenseFolderIconGlyph,
  resolveExpenseFolderColorHex,
  type ExpenseFolderColor,
  type ExpenseFolderIcon,
} from "./expense-folder-visuals";
import styles from "./expense-folder-picker.module.scss";

export interface ExpenseFolderOption {
  color: ExpenseFolderColor | null;
  icon: ExpenseFolderIcon | null;
  id: string;
  name: string;
}

interface ExpenseFolderPickerProps {
  className?: string;
  emptyMessage?: string;
  onManageFolders: () => void;
  onSelect: (folderId: string | null) => void;
  options: ExpenseFolderOption[];
  selectedFolderId: string;
  unassignedLabel?: string;
}

function ExpenseFolderSwatch({
  color,
  icon,
}: {
  color: ExpenseFolderColor | null;
  icon: ExpenseFolderIcon | null;
}) {
  return (
    <span
      aria-hidden="true"
      className={styles.swatch}
      style={{ backgroundColor: resolveExpenseFolderColorHex(color) }}
    >
      <ExpenseFolderIconGlyph icon={icon} size={16} stroke={2} />
    </span>
  );
}

export function ExpenseFolderPicker({
  className,
  emptyMessage = "No hay carpetas creadas todavía.",
  onManageFolders,
  onSelect,
  options,
  selectedFolderId,
  unassignedLabel = "Sin carpeta",
}: ExpenseFolderPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find(
    (option) => option.id === selectedFolderId,
  );
  const filteredOptions = useMemo(() => {
    const normalizedSearchValue = searchValue.trim().toLocaleLowerCase();

    if (!normalizedSearchValue) {
      return options;
    }

    return options.filter((option) =>
      option.name.toLocaleLowerCase().includes(normalizedSearchValue),
    );
  }, [options, searchValue]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target;

      if (!rootRef.current || !(target instanceof Node)) {
        return;
      }

      if (rootRef.current.contains(target)) {
        return;
      }

      setIsOpen(false);
      setSearchValue("");
    };

    document.addEventListener("mousedown", handleDocumentMouseDown);

    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
    };
  }, [isOpen]);

  return (
    <div className={cn(styles.root, className)} ref={rootRef}>
      <Button
        aria-expanded={isOpen}
        className={styles.trigger}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        type="button"
        variant="outline"
      >
        <span className={styles.triggerLabel}>
          {selectedOption ? (
            <ExpenseFolderSwatch
              color={selectedOption.color}
              icon={selectedOption.icon}
            />
          ) : null}
          <span className={styles.triggerName}>
            {selectedOption?.name ?? unassignedLabel}
          </span>
        </span>
      </Button>

      {isOpen ? (
        <div className={styles.panel}>
          <Input
            aria-label="Buscar carpeta"
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Buscar por nombre"
            type="text"
            value={searchValue}
          />

          <div className={styles.options}>
            <button
              className={cn(
                styles.option,
                selectedFolderId === "" && styles.optionSelected,
              )}
              onClick={() => {
                onSelect(null);
                setIsOpen(false);
                setSearchValue("");
              }}
              type="button"
            >
              <span className={styles.optionName}>{unassignedLabel}</span>
            </button>

            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <button
                  className={cn(
                    styles.option,
                    option.id === selectedFolderId && styles.optionSelected,
                  )}
                  key={option.id}
                  onClick={() => {
                    onSelect(option.id);
                    setIsOpen(false);
                    setSearchValue("");
                  }}
                  type="button"
                >
                  <ExpenseFolderSwatch color={option.color} icon={option.icon} />
                  <span className={styles.optionName}>{option.name}</span>
                </button>
              ))
            ) : (
              <p className={styles.emptyMessage}>{emptyMessage}</p>
            )}
          </div>

          <Button
            className={styles.manageButton}
            onClick={() => {
              onManageFolders();
              setIsOpen(false);
              setSearchValue("");
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            Administrar carpetas
          </Button>
        </div>
      ) : null}
    </div>
  );
}
