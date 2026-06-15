/**
 * Available color tokens for organizing expense folders. Each token maps to a
 * concrete visual style in the UI layer; the domain only guarantees the stored
 * value belongs to this curated palette.
 */
export const EXPENSE_FOLDER_COLORS = [
  "slate",
  "red",
  "orange",
  "amber",
  "green",
  "teal",
  "blue",
  "indigo",
  "violet",
  "pink",
] as const;

/**
 * Available icon keys for expense folders. Each key maps to a concrete icon
 * component in the UI layer; the domain only guarantees the stored value belongs
 * to this curated set.
 */
export const EXPENSE_FOLDER_ICONS = [
  "folder",
  "home",
  "car",
  "cart",
  "heart",
  "bolt",
  "wallet",
  "gift",
  "plane",
  "health",
  "education",
  "entertainment",
] as const;

export type ExpenseFolderColor = (typeof EXPENSE_FOLDER_COLORS)[number];
export type ExpenseFolderIcon = (typeof EXPENSE_FOLDER_ICONS)[number];

export interface ExpenseFolderInput {
  color?: ExpenseFolderColor | null;
  icon?: ExpenseFolderIcon | null;
  id: string;
  name: string;
  position?: number;
}

export interface ExpenseFolder {
  color: ExpenseFolderColor | null;
  icon: ExpenseFolderIcon | null;
  id: string;
  name: string;
  position: number;
}

export interface ExpenseFoldersCatalogDocumentInput {
  folders: ExpenseFolderInput[];
}

export interface ExpenseFoldersCatalogDocument {
  folders: ExpenseFolder[];
}

function isValidExpenseFolderColor(
  value: string,
): value is ExpenseFolderColor {
  return EXPENSE_FOLDER_COLORS.includes(value as ExpenseFolderColor);
}

function isValidExpenseFolderIcon(value: string): value is ExpenseFolderIcon {
  return EXPENSE_FOLDER_ICONS.includes(value as ExpenseFolderIcon);
}

function validateExpenseFolderColor(
  color: string | null | undefined,
  operationName: string,
): ExpenseFolderColor | null {
  if (color == null) {
    return null;
  }

  const normalizedColor = color.trim();

  if (!normalizedColor) {
    return null;
  }

  if (!isValidExpenseFolderColor(normalizedColor)) {
    throw new Error(
      `${operationName} requires every folder color to be one of the supported palette tokens.`,
    );
  }

  return normalizedColor;
}

function validateExpenseFolderIcon(
  icon: string | null | undefined,
  operationName: string,
): ExpenseFolderIcon | null {
  if (icon == null) {
    return null;
  }

  const normalizedIcon = icon.trim();

  if (!normalizedIcon) {
    return null;
  }

  if (!isValidExpenseFolderIcon(normalizedIcon)) {
    throw new Error(
      `${operationName} requires every folder icon to be one of the supported icon keys.`,
    );
  }

  return normalizedIcon;
}

function validateExpenseFolder(
  folder: ExpenseFolderInput,
  operationName: string,
  fallbackPosition: number,
): ExpenseFolder {
  const normalizedId = folder.id.trim();
  const normalizedName = folder.name.trim();

  if (!normalizedId) {
    throw new Error(
      `${operationName} requires every folder to include an id.`,
    );
  }

  if (!normalizedName) {
    throw new Error(
      `${operationName} requires every folder to include a name.`,
    );
  }

  const resolvedPosition = folder.position ?? fallbackPosition;

  if (!Number.isInteger(resolvedPosition) || resolvedPosition < 0) {
    throw new Error(
      `${operationName} requires every folder position to be an integer greater than or equal to 0.`,
    );
  }

  return {
    color: validateExpenseFolderColor(folder.color, operationName),
    icon: validateExpenseFolderIcon(folder.icon, operationName),
    id: normalizedId,
    name: normalizedName,
    position: resolvedPosition,
  };
}

export function createExpenseFoldersCatalogDocument(
  payload: ExpenseFoldersCatalogDocumentInput,
  operationName: string,
): ExpenseFoldersCatalogDocument {
  const folders = payload.folders.map((folder, index) =>
    validateExpenseFolder(folder, operationName, index),
  );
  const uniqueNames = new Set<string>();
  const uniqueIds = new Set<string>();

  for (const folder of folders) {
    const normalizedName = folder.name.toLocaleLowerCase();

    if (uniqueNames.has(normalizedName)) {
      throw new Error(
        `${operationName} requires folder names to be unique.`,
      );
    }

    if (uniqueIds.has(folder.id)) {
      throw new Error(
        `${operationName} requires folder ids to be unique.`,
      );
    }

    uniqueNames.add(normalizedName);
    uniqueIds.add(folder.id);
  }

  return {
    folders: [...folders].sort((left, right) => {
      if (left.position !== right.position) {
        return left.position - right.position;
      }

      return left.name.localeCompare(right.name, "en");
    }),
  };
}

export function createEmptyExpenseFoldersCatalogDocument(): ExpenseFoldersCatalogDocument {
  return createExpenseFoldersCatalogDocument(
    {
      folders: [],
    },
    "Creating an empty expense folders catalog",
  );
}
