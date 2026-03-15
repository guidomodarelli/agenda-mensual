import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { getFuzzyMatchIndices, renderHighlightedText } from "./fuzzy-search";
import styles from "./lender-picker.module.scss";

export interface LenderOption {
  id: string;
  name: string;
  notes?: string;
  type: "bank" | "family" | "friend" | "other";
}

interface LenderPickerProps {
  className?: string;
  emptyMessage?: string;
  hasError?: boolean;
  onAddLender: () => void;
  onSelect: (lenderId: string | null) => void;
  options: LenderOption[];
  placeholder?: string;
  selectedLenderId: string;
  selectedLenderName: string;
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

export function LenderPicker({
  className,
  emptyMessage = "No hay prestadores registrados todavía.",
  hasError = false,
  onAddLender,
  onSelect,
  options,
  placeholder = "Seleccioná un prestador",
  selectedLenderId,
  selectedLenderName,
}: LenderPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.id === selectedLenderId);
  const hasSearchQuery = searchValue.trim().length > 0;
  const filteredOptions = useMemo(() => {
    const trimmedSearchValue = searchValue.trim();

    if (!trimmedSearchValue) {
      return options.map((option) => ({
        nameMatchIndices: [] as number[],
        option,
      }));
    }

    return options.flatMap((option) => {
      const typeLabel = getLenderTypeLabel(option.type);
      const nameMatchIndices = getFuzzyMatchIndices(option.name, trimmedSearchValue);
      const typeMatchIndices = getFuzzyMatchIndices(typeLabel, trimmedSearchValue);

      if (nameMatchIndices === null && typeMatchIndices === null) {
        return [];
      }

      return [
        {
          nameMatchIndices: nameMatchIndices ?? [],
          option,
        },
      ];
    });
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
        aria-invalid={hasError ? "true" : undefined}
        aria-expanded={isOpen}
        className={styles.trigger}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        type="button"
        variant="outline"
      >
        {selectedOption?.name || selectedLenderName || placeholder}
      </Button>

      {isOpen ? (
        <div className={styles.panel}>
          <Input
            aria-label="Buscar prestador"
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Buscar por nombre o tipo"
            type="text"
            value={searchValue}
          />

          <div className={styles.options}>
            {filteredOptions.length > 0 ? (
              filteredOptions.map(({ nameMatchIndices, option }) => (
                <button
                  className={cn(
                    styles.option,
                    option.id === selectedLenderId && styles.optionSelected,
                  )}
                  key={option.id}
                  onClick={() => {
                    onSelect(option.id);
                    setIsOpen(false);
                    setSearchValue("");
                  }}
                  type="button"
                >
                  <span className={styles.optionName}>
                    {hasSearchQuery && nameMatchIndices.length > 0
                      ? renderHighlightedText(
                          option.name,
                          nameMatchIndices,
                          styles.optionNameHighlight,
                          `lender-name-${option.id}`,
                        )
                      : option.name}
                  </span>
                  <span className={styles.optionMeta}>
                    {getLenderTypeLabel(option.type)}
                  </span>
                </button>
              ))
            ) : (
              <p className={styles.emptyMessage}>{emptyMessage}</p>
            )}
          </div>

          <Button
            className={styles.addLenderButton}
            onClick={() => {
              onAddLender();
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            Agregar prestador
          </Button>
        </div>
      ) : null}
    </div>
  );
}
