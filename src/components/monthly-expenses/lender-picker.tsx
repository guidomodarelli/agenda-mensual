import {
  Button,
  Input,
  cn,
  compareFuzzyMatchRank,
  getFuzzyMatchIndices,
  getFuzzyMatchRank,
  renderHighlightedText,
  type FuzzyMatchRank,
} from "beez-ui";
import { useEffect, useMemo, useRef, useState } from "react";

import styles from "./lender-picker.module.scss";

export interface LenderOption {
  id: string;
  name: string;
  notes?: string;
  type: "bank" | "family" | "friend" | "fintech" | "partner" | "other";
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
    case "fintech":
      return "Fintech / Billetera";
    case "partner":
      return "Pareja";
    case "other":
      return "Otro";
  }
}

function getBestFuzzyRank(
  nameRank: FuzzyMatchRank | null,
  notesRank: FuzzyMatchRank | null,
  typeRank: FuzzyMatchRank | null,
): { priority: number; rank: FuzzyMatchRank } | null {
  const candidates: Array<{ priority: number; rank: FuzzyMatchRank }> = [];

  if (nameRank) {
    candidates.push({ priority: 0, rank: nameRank });
  }

  if (notesRank) {
    candidates.push({ priority: 1, rank: notesRank });
  }

  if (typeRank) {
    candidates.push({ priority: 2, rank: typeRank });
  }

  if (candidates.length === 0) {
    return null;
  }

  return candidates.reduce((bestCandidate, candidate) => {
    const rankComparison = compareFuzzyMatchRank(candidate.rank, bestCandidate.rank);

    if (rankComparison < 0) {
      return candidate;
    }

    if (rankComparison === 0 && candidate.priority < bestCandidate.priority) {
      return candidate;
    }

    return bestCandidate;
  });
}

export function LenderPicker({
  className,
  emptyMessage = "No hay prestamistas registrados todavía.",
  hasError = false,
  onAddLender,
  onSelect,
  options,
  placeholder = "Seleccioná un prestamista",
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
        notesMatchIndices: [] as number[],
        nameMatchIndices: [] as number[],
        typeLabel: getLenderTypeLabel(option.type),
        typeMatchIndices: [] as number[],
        option,
      }));
    }

    return options
      .flatMap((option, optionIndex) => {
        const typeLabel = getLenderTypeLabel(option.type);
        const notes = option.notes ?? "";
        const nameMatchIndices = getFuzzyMatchIndices(option.name, trimmedSearchValue);
        const notesMatchIndices = getFuzzyMatchIndices(notes, trimmedSearchValue);
        const typeMatchIndices = getFuzzyMatchIndices(typeLabel, trimmedSearchValue);
        const nameRank = getFuzzyMatchRank(option.name, trimmedSearchValue);
        const notesRank = getFuzzyMatchRank(notes, trimmedSearchValue);
        const typeRank = getFuzzyMatchRank(typeLabel, trimmedSearchValue);
        const bestRank = getBestFuzzyRank(nameRank, notesRank, typeRank);

        if (
          nameMatchIndices === null &&
          notesMatchIndices === null &&
          typeMatchIndices === null
        ) {
          return [];
        }

        if (!bestRank) {
          return [];
        }

        return [
          {
            bestRank,
            notesMatchIndices: notesMatchIndices ?? [],
            nameMatchIndices: nameMatchIndices ?? [],
            optionIndex,
            typeLabel,
            typeMatchIndices: typeMatchIndices ?? [],
            option,
          },
        ];
      })
      .sort((leftMatch, rightMatch) => {
        const rankComparison = compareFuzzyMatchRank(
          leftMatch.bestRank.rank,
          rightMatch.bestRank.rank,
        );

        if (rankComparison !== 0) {
          return rankComparison;
        }

        if (leftMatch.bestRank.priority !== rightMatch.bestRank.priority) {
          return leftMatch.bestRank.priority - rightMatch.bestRank.priority;
        }

        return leftMatch.optionIndex - rightMatch.optionIndex;
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
            aria-label="Buscar prestamista"
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Buscar por nombre, tipo o notas"
            type="text"
            value={searchValue}
          />

          <div className={styles.options}>
            {filteredOptions.length > 0 ? (
              filteredOptions.map(
                ({
                  nameMatchIndices,
                  notesMatchIndices,
                  option,
                  typeLabel,
                  typeMatchIndices,
                }) => (
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
                  <span className={styles.optionPrimary}>
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

                    {option.notes ? (
                      <span className={styles.optionNotes}>
                        {hasSearchQuery && notesMatchIndices.length > 0
                          ? renderHighlightedText(
                              option.notes,
                              notesMatchIndices,
                              styles.optionNotesHighlight,
                              `lender-notes-${option.id}`,
                            )
                          : option.notes}
                      </span>
                    ) : null}
                  </span>
                  <span className={styles.optionMeta}>
                    {hasSearchQuery && typeMatchIndices.length > 0
                      ? renderHighlightedText(
                          typeLabel,
                          typeMatchIndices,
                          styles.optionMetaHighlight,
                          `lender-type-${option.id}`,
                        )
                      : typeLabel}
                  </span>
                </button>
                ),
              )
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
            Agregar prestamista
          </Button>
        </div>
      ) : null}
    </div>
  );
}
