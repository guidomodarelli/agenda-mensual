import {
  IconBarbell,
  IconBolt,
  IconBriefcase,
  IconBuilding,
  IconBuildingBank,
  IconCar,
  IconCoffee,
  IconCreditCard,
  IconDeviceMobile,
  IconDeviceTv,
  IconFolder,
  IconGasStation,
  IconGift,
  IconHeart,
  IconHeartbeat,
  IconHome,
  IconPaw,
  IconPigMoney,
  IconPlane,
  IconRepeat,
  IconSchool,
  IconShoppingCart,
  IconTag,
  IconToolsKitchen2,
  IconUser,
  IconUsers,
  IconWallet,
  IconWifi,
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
  "rose",
  "pink",
  "fuchsia",
  "purple",
  "violet",
  "indigo",
  "blue",
  "sky",
  "cyan",
  "teal",
  "emerald",
  "green",
  "lime",
  "yellow",
  "amber",
  "orange",
] as const;

/**
 * UI-facing icon keys for expense folders. Mirrors the domain icon set.
 */
export const EXPENSE_FOLDER_ICON_OPTIONS = [
  "folder",
  "home",
  "building",
  "car",
  "fuel",
  "cart",
  "food",
  "coffee",
  "card",
  "bank",
  "savings",
  "wallet",
  "tag",
  "bolt",
  "phone",
  "internet",
  "subscription",
  "heart",
  "health",
  "gym",
  "user",
  "family",
  "pet",
  "education",
  "work",
  "gift",
  "plane",
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
  rose: "#f43f5e",
  pink: "#ec4899",
  fuchsia: "#d946ef",
  purple: "#a855f7",
  violet: "#8b5cf6",
  indigo: "#6366f1",
  blue: "#3b82f6",
  sky: "#0ea5e9",
  cyan: "#06b6d4",
  teal: "#14b8a6",
  emerald: "#10b981",
  green: "#22c55e",
  lime: "#84cc16",
  yellow: "#eab308",
  amber: "#f59e0b",
  orange: "#f97316",
};

/**
 * Human-readable Spanish labels for each folder color token.
 */
export const EXPENSE_FOLDER_COLOR_LABEL: Record<ExpenseFolderColor, string> = {
  slate: "Gris",
  red: "Rojo",
  rose: "Carmín",
  pink: "Rosa",
  fuchsia: "Fucsia",
  purple: "Púrpura",
  violet: "Violeta",
  indigo: "Índigo",
  blue: "Azul",
  sky: "Celeste",
  cyan: "Cian",
  teal: "Verde azulado",
  emerald: "Esmeralda",
  green: "Verde",
  lime: "Lima",
  yellow: "Amarillo",
  amber: "Ámbar",
  orange: "Naranja",
};

const EXPENSE_FOLDER_ICON_COMPONENT: Record<
  ExpenseFolderIcon,
  ComponentType<IconProps>
> = {
  folder: IconFolder,
  home: IconHome,
  building: IconBuilding,
  car: IconCar,
  fuel: IconGasStation,
  cart: IconShoppingCart,
  food: IconToolsKitchen2,
  coffee: IconCoffee,
  card: IconCreditCard,
  bank: IconBuildingBank,
  savings: IconPigMoney,
  wallet: IconWallet,
  tag: IconTag,
  bolt: IconBolt,
  phone: IconDeviceMobile,
  internet: IconWifi,
  subscription: IconRepeat,
  heart: IconHeart,
  health: IconHeartbeat,
  gym: IconBarbell,
  user: IconUser,
  family: IconUsers,
  pet: IconPaw,
  education: IconSchool,
  work: IconBriefcase,
  gift: IconGift,
  plane: IconPlane,
  entertainment: IconDeviceTv,
};

/**
 * Human-readable Spanish labels for each folder icon key.
 */
export const EXPENSE_FOLDER_ICON_LABEL: Record<ExpenseFolderIcon, string> = {
  folder: "Carpeta",
  home: "Hogar",
  building: "Vivienda",
  car: "Auto",
  fuel: "Combustible",
  cart: "Compras",
  food: "Comida",
  coffee: "Café",
  card: "Tarjetas",
  bank: "Banco",
  savings: "Ahorro",
  wallet: "Billetera",
  tag: "Etiqueta",
  bolt: "Servicios",
  phone: "Teléfono",
  internet: "Internet",
  subscription: "Suscripciones",
  heart: "Favorito",
  health: "Salud",
  gym: "Gimnasio",
  user: "Personal",
  family: "Familia",
  pet: "Mascotas",
  education: "Educación",
  work: "Trabajo",
  gift: "Regalos",
  plane: "Viajes",
  entertainment: "Entretenimiento",
};

export const DEFAULT_EXPENSE_FOLDER_COLOR: ExpenseFolderColor = "slate";
export const DEFAULT_EXPENSE_FOLDER_ICON: ExpenseFolderIcon = "folder";

/**
 * Frequently used folder presets surfaced as one-click suggestions when creating
 * folders, so common categories can be added without filling the form manually.
 */
export interface ExpenseFolderPreset {
  color: ExpenseFolderColor;
  icon: ExpenseFolderIcon;
  name: string;
}

export const EXPENSE_FOLDER_PRESETS: ExpenseFolderPreset[] = [
  { color: "blue", icon: "home", name: "Hogar" },
  { color: "amber", icon: "bolt", name: "Servicios" },
  { color: "violet", icon: "card", name: "Tarjetas" },
  { color: "teal", icon: "user", name: "Personal" },
  { color: "red", icon: "car", name: "Auto" },
  { color: "green", icon: "cart", name: "Supermercado" },
  { color: "rose", icon: "health", name: "Salud" },
  { color: "orange", icon: "food", name: "Comida" },
  { color: "indigo", icon: "education", name: "Educación" },
  { color: "pink", icon: "entertainment", name: "Entretenimiento" },
  { color: "emerald", icon: "savings", name: "Ahorro" },
  { color: "yellow", icon: "pet", name: "Mascotas" },
];

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
