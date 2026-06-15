import { useEffect, useRef, useState } from "react";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";

import { cn } from "@/lib/utils";

import type { ExpenseFolderOption } from "./expense-folder-picker";
import {
  ExpenseFolderIconGlyph,
  resolveExpenseFolderColorHex,
  UNASSIGNED_EXPENSE_FOLDER_FILTER_ID,
} from "./expense-folder-visuals";
import styles from "./expense-folder-organizer.module.scss";

const EXPENSE_FOLDER_DRAG_TYPE = "expense-folder-row";

function getDraggedExpenseId(
  data: Record<string | symbol, unknown>,
): string | null {
  if (data.type === EXPENSE_FOLDER_DRAG_TYPE && typeof data.expenseId === "string") {
    return data.expenseId;
  }

  return null;
}

interface ExpenseFolderRowBadgeProps {
  expenseId: string;
  folder: ExpenseFolderOption | null;
  unassignedLabel?: string;
}

/**
 * Draggable folder badge rendered inside an expense row. Dragging it onto a
 * folder chip reassigns the expense to that folder.
 */
export function ExpenseFolderRowBadge({
  expenseId,
  folder,
  unassignedLabel = "Sin carpeta",
}: ExpenseFolderRowBadgeProps) {
  const badgeRef = useRef<HTMLSpanElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const element = badgeRef.current;

    if (!element) {
      return;
    }

    return draggable({
      element,
      getInitialData: () => ({
        expenseId,
        type: EXPENSE_FOLDER_DRAG_TYPE,
      }),
      onDragStart: () => setIsDragging(true),
      onDrop: () => setIsDragging(false),
    });
  }, [expenseId]);

  return (
    <span
      aria-label={`Mover ${folder?.name ?? unassignedLabel} a otra carpeta`}
      className={cn(
        styles.rowBadge,
        isDragging && styles.rowBadgeDragging,
        !folder && styles.rowBadgeUnassigned,
      )}
      ref={badgeRef}
      style={
        folder
          ? { backgroundColor: resolveExpenseFolderColorHex(folder.color) }
          : undefined
      }
    >
      {folder ? (
        <ExpenseFolderIconGlyph icon={folder.icon} size={12} stroke={2} />
      ) : null}
      {folder?.name ?? unassignedLabel}
    </span>
  );
}

interface ExpenseFolderChipProps {
  count: number;
  folder: ExpenseFolderOption | null;
  isSelected: boolean;
  onSelect: () => void;
  onDropExpense: (expenseId: string) => void;
  targetFolderId: string | null;
}

function ExpenseFolderChip({
  count,
  folder,
  isSelected,
  onSelect,
  onDropExpense,
  targetFolderId,
}: ExpenseFolderChipProps) {
  const chipRef = useRef<HTMLButtonElement | null>(null);
  const [isDraggedOver, setIsDraggedOver] = useState(false);

  useEffect(() => {
    const element = chipRef.current;

    if (!element) {
      return;
    }

    return dropTargetForElements({
      element,
      canDrop: ({ source }) => getDraggedExpenseId(source.data) !== null,
      getData: () => ({ targetFolderId }),
      onDragEnter: () => setIsDraggedOver(true),
      onDragLeave: () => setIsDraggedOver(false),
      onDrop: ({ source }) => {
        setIsDraggedOver(false);

        const draggedExpenseId = getDraggedExpenseId(source.data);

        if (draggedExpenseId !== null) {
          onDropExpense(draggedExpenseId);
        }
      },
    });
  }, [onDropExpense, targetFolderId]);

  return (
    <button
      className={cn(
        styles.chip,
        isSelected && styles.chipSelected,
        isDraggedOver && styles.chipDropTarget,
      )}
      onClick={onSelect}
      ref={chipRef}
      type="button"
    >
      {folder ? (
        <span
          aria-hidden="true"
          className={styles.chipSwatch}
          style={{ backgroundColor: resolveExpenseFolderColorHex(folder.color) }}
        >
          <ExpenseFolderIconGlyph icon={folder.icon} size={12} stroke={2} />
        </span>
      ) : null}
      <span>{folder?.name ?? "Sin carpeta"}</span>
      <span className={styles.chipCount}>{count}</span>
    </button>
  );
}

interface ExpenseFolderFilterBarProps {
  folders: ExpenseFolderOption[];
  onMoveExpenseToFolder: (args: {
    expenseId: string;
    folderId: string | null;
  }) => void;
  onSelectFilter: (folderId: string) => void;
  selectedFilterId: string;
  unassignedCount: number;
  countsByFolderId: Record<string, number>;
  totalCount: number;
}

/**
 * Folder filter chips that double as drag-and-drop targets to reassign expenses
 * between folders.
 */
export function ExpenseFolderFilterBar({
  folders,
  onMoveExpenseToFolder,
  onSelectFilter,
  selectedFilterId,
  unassignedCount,
  countsByFolderId,
  totalCount,
}: ExpenseFolderFilterBarProps) {
  if (folders.length === 0) {
    return null;
  }

  return (
    <div className={styles.filterBar}>
      <button
        className={cn(styles.chip, selectedFilterId === "" && styles.chipSelected)}
        onClick={() => onSelectFilter("")}
        type="button"
      >
        <span>Todas</span>
        <span className={styles.chipCount}>{totalCount}</span>
      </button>

      {folders.map((folder) => (
        <ExpenseFolderChip
          count={countsByFolderId[folder.id] ?? 0}
          folder={folder}
          isSelected={selectedFilterId === folder.id}
          key={folder.id}
          onDropExpense={(expenseId) =>
            onMoveExpenseToFolder({ expenseId, folderId: folder.id })
          }
          onSelect={() => onSelectFilter(folder.id)}
          targetFolderId={folder.id}
        />
      ))}

      <ExpenseFolderChip
        count={unassignedCount}
        folder={null}
        isSelected={selectedFilterId === UNASSIGNED_EXPENSE_FOLDER_FILTER_ID}
        onDropExpense={(expenseId) =>
          onMoveExpenseToFolder({ expenseId, folderId: null })
        }
        onSelect={() => onSelectFilter(UNASSIGNED_EXPENSE_FOLDER_FILTER_ID)}
        targetFolderId={null}
      />

      <p className={styles.filterHint}>
        Arrastrá la etiqueta de carpeta de un gasto hacia un chip para moverlo.
      </p>
    </div>
  );
}
