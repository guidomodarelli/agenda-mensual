import {
  IconBolt,
  IconCar,
  IconDeviceTv,
  IconFolder,
  IconGift,
  IconHeart,
  IconHeartbeat,
  IconHome,
  IconPlane,
  IconSchool,
  IconShoppingCart,
  IconWallet,
  type IconProps,
} from "@tabler/icons-react";
import type { ComponentType } from "react";

/**
 * UI-facing color tokens for expense folders. Mirrors the domain palette but is
 * declared locally so the components layer does not depend on the domain layer
 * (enforced by the boundaries lint rule).
 */
export const EXPENSE_FOLDER_COLOR_OPTIONS = [
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
 * UI-facing icon keys for expense folders. Mirrors the domain icon set.
 */
export const EXPENSE_FOLDER_ICON_OPTIONS = [
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

export type ExpenseFolderColor = (typeof EXPENSE_FOLDER_COLOR_OPTIONS)[number];
export type ExpenseFolderIcon = (typeof EXPENSE_FOLDER_ICON_OPTIONS)[number];

/**
 * Solid hex value used to render each folder color token. Kept in the UI layer
 * so the domain stays decoupled from concrete styling decisions.
 */
export const EXPENSE_FOLDER_COLOR_HEX: Record<ExpenseFolderColor, string> = {
  slate: "#64748b",
  red: "#ef4444",
  orange: "#f97316",
  amber: "#f59e0b",
  green: "#22c55e",
  teal: "#14b8a6",
  blue: "#3b82f6",
  indigo: "#6366f1",
  violet: "#8b5cf6",
  pink: "#ec4899",
};

/**
 * Human-readable Spanish labels for each folder color token.
 */
export const EXPENSE_FOLDER_COLOR_LABEL: Record<ExpenseFolderColor, string> = {
  slate: "Gris",
  red: "Rojo",
  orange: "Naranja",
  amber: "Ámbar",
  green: "Verde",
  teal: "Verde azulado",
  blue: "Azul",
  indigo: "Índigo",
  violet: "Violeta",
  pink: "Rosa",
};

const EXPENSE_FOLDER_ICON_COMPONENT: Record<
  ExpenseFolderIcon,
  ComponentType<IconProps>
> = {
  folder: IconFolder,
  home: IconHome,
  car: IconCar,
  cart: IconShoppingCart,
  heart: IconHeart,
  bolt: IconBolt,
  wallet: IconWallet,
  gift: IconGift,
  plane: IconPlane,
  health: IconHeartbeat,
  education: IconSchool,
  entertainment: IconDeviceTv,
};

/**
 * Human-readable Spanish labels for each folder icon key.
 */
export const EXPENSE_FOLDER_ICON_LABEL: Record<ExpenseFolderIcon, string> = {
  folder: "Carpeta",
  home: "Hogar",
  car: "Auto",
  cart: "Compras",
  heart: "Favorito",
  bolt: "Servicios",
  wallet: "Billetera",
  gift: "Regalos",
  plane: "Viajes",
  health: "Salud",
  education: "Educación",
  entertainment: "Entretenimiento",
};

export const DEFAULT_EXPENSE_FOLDER_COLOR: ExpenseFolderColor = "slate";
export const DEFAULT_EXPENSE_FOLDER_ICON: ExpenseFolderIcon = "folder";

/**
 * Sentinel folder filter value that matches expenses without an assigned folder.
 * An empty string means "all folders"; this constant means "no folder".
 */
export const UNASSIGNED_EXPENSE_FOLDER_FILTER_ID = "__unassigned__";

/**
 * Resolves the hex color for a folder, falling back to the default token when
 * the folder has no explicit color.
 */
export function resolveExpenseFolderColorHex(
  color: ExpenseFolderColor | null | undefined,
): string {
  return EXPENSE_FOLDER_COLOR_HEX[color ?? DEFAULT_EXPENSE_FOLDER_COLOR];
}

interface ExpenseFolderIconGlyphProps extends IconProps {
  icon: ExpenseFolderIcon | null | undefined;
}

/**
 * Renders the icon component associated with a folder icon key, falling back to
 * the default folder glyph when no icon is set.
 */
export function ExpenseFolderIconGlyph({
  icon,
  ...iconProps
}: ExpenseFolderIconGlyphProps) {
  const IconComponent =
    EXPENSE_FOLDER_ICON_COMPONENT[icon ?? DEFAULT_EXPENSE_FOLDER_ICON];

  return <IconComponent {...iconProps} />;
}
