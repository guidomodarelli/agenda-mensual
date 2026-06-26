"use client";

import * as React from "react";
import {
  Calendar,
  Check,
  CircleDot,
  CircleMinus,
  CircleSlash,
  Folder,
  Hash,
  List,
  Type,
  User,
  X,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import {
  getActiveFilterToken,
  getValueHighlightRanges,
  normalizeFilterSlug,
  parseFilterQuery,
  PRESENCE_HAS_META_KEY,
  PRESENCE_NO_META_KEY,
  UNASSIGNED_FOLDER_FILTER_VALUE,
  type AppliedFilter,
  type FilterQualifierConfig,
  type FilterQualifierKind,
  type ValueHighlightRange,
} from "@/components/ui/filter-query-grammar";

const DEFAULT_PLACEHOLDER = "Filtrar por campo o palabra clave";
const DEFAULT_ARIA_LABEL = "Filtrar gastos";
const CLEAR_FILTER_ARIA_LABEL = "Limpiar todos los filtros";
const KEY_GROUP_LABEL = "Campos";
const VALUE_GROUP_LABEL = "Valores";
const LISTBOX_ID = "filter-query-bar-listbox";
const OPTION_ID_PREFIX = "filter-query-bar-option";

/** Opción de valor sugerida. `keepOpen` mantiene el popover para completar texto. */
interface ValueSuggestionOption {
  slug: string;
  label: string;
  /** Valor interno que queda aplicado al parsear opciones enum/folder. */
  value?: string;
  keepOpen?: boolean;
  /** Id estable cuando varias opciones comparten el texto a insertar (p. ej. `*`). */
  name?: string;
  /** Texto a insertar si difiere del slug. */
  insertText?: string;
  /**
   * Posición del caret dentro del texto insertado (default: al final). Permite
   * dejar el caret entre comodines: "Empieza por…" inserta `*` con el caret antes
   * (`texto*`), "Contiene…" inserta `**` con el caret en medio (`*texto*`).
   */
  caretOffset?: number;
}

const NUMBER_RANGE_VALUE_SUGGESTIONS: ValueSuggestionOption[] = [
  { label: "Mayor o igual (≥)", slug: ">=" },
  { label: "Menor o igual (≤)", slug: "<=" },
  { label: "Rango (100..500)", slug: ".." },
];

/**
 * Operadores para qualifiers de fecha (mes-año). Reflejan los numéricos: cota
 * inferior (`>=`), cota superior (`<=`) y rango (`..`). La presencia/ausencia de
 * fecha se cubre con las meta-claves `tiene:`/`no:` del bloque universal.
 */
const YEAR_MONTH_VALUE_SUGGESTIONS: ValueSuggestionOption[] = [
  { keepOpen: true, label: "Desde (≥)", slug: ">=" },
  { keepOpen: true, label: "Hasta (≤)", slug: "<=" },
  { keepOpen: true, label: "Rango (2026-01..2026-06)", slug: ".." },
];

const TEXT_MATCH_VALUE_SUGGESTIONS: ValueSuggestionOption[] = [
  // `texto*`: el caret queda antes del `*` para escribir el prefijo.
  { caretOffset: 0, insertText: "*", keepOpen: true, label: "Empieza por…", name: "starts", slug: "" },
  // `*texto*`: el caret queda entre los dos `*`.
  { caretOffset: 1, insertText: "**", keepOpen: true, label: "Contiene…", name: "contains", slug: "" },
  // `*texto`: el caret queda después del `*` para escribir el sufijo.
  { insertText: "*", keepOpen: true, label: "Termina con…", name: "ends", slug: "" },
];

interface FilterSuggestion {
  id: string;
  /** Texto principal visible. */
  label: string;
  /** Icono a la izquierda del ítem. */
  icon: LucideIcon;
  /**
   * Grupo lógico del ítem. `meta` agrupa las opciones de presencia/exclusión
   * (`tiene:`/`no:`/`-`), que se separan visualmente de los campos.
   */
  group: "key" | "value" | "meta";
  /** Texto a insertar en el rango activo de la query. */
  insertText: string;
  /** Si tras insertar se mantiene el popover abierto (encadenar clave→valor). */
  keepOpen: boolean;
  /** Posición del caret dentro del texto insertado (default: al final). */
  caretOffset?: number;
  /**
   * Reemplaza el token completo (desde su inicio, incluyendo clave y `-`) en vez
   * de solo el tramo del valor. Lo usan las opciones universales que reescriben
   * `<clave>:` a una meta-clave (`tiene:<clave>`) o a una exclusión (`-<clave>:`).
   */
  replaceTokenStart?: boolean;
}

/** Meta-claves de presencia ofrecidas también como campos de primer nivel. */
const PRESENCE_META_KEY_SUGGESTIONS: Array<{
  key: string;
  label: string;
  icon: LucideIcon;
}> = [
  { icon: Check, key: PRESENCE_HAS_META_KEY, label: "Tiene…" },
  { icon: CircleSlash, key: PRESENCE_NO_META_KEY, label: "No tiene…" },
];

/** Icono representativo de cada tipo de qualifier, mostrado a su izquierda. */
function getKindIcon(kind: FilterQualifierKind): LucideIcon {
  switch (kind) {
    case "numberRange":
      return Hash;
    case "textMatch":
      return Type;
    case "enum":
      return List;
    case "presence":
      return CircleDot;
    case "yearMonthRange":
      return Calendar;
    case "folder":
      return Folder;
    default:
      return Type;
  }
}

/** Iconos por nombre lógico declarado en el qualifier (`config.iconName`). */
const ICON_BY_NAME: Record<string, LucideIcon> = {
  user: User,
};

/** Icono de un qualifier: override por `iconName`, o el icono por defecto del kind. */
function getQualifierIcon(config: FilterQualifierConfig): LucideIcon {
  if (config.iconName && ICON_BY_NAME[config.iconName]) {
    return ICON_BY_NAME[config.iconName];
  }

  return getKindIcon(config.kind);
}

export interface FilterQueryBarProps {
  configs: FilterQualifierConfig[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  /** Se dispara cuando el input gana o pierde el foco real del usuario. */
  onFocusChange?: (focused: boolean) => void;
  /** Acción opcional a la derecha del input (p. ej. botón de filtros avanzados). */
  trailingAction?: React.ReactNode;
}

function startsWithNormalized(candidate: string, prefix: string): boolean {
  if (!prefix) {
    return true;
  }

  return normalizeFilterSlug(candidate).startsWith(normalizeFilterSlug(prefix));
}

/** Etiqueta de la opción raíz de exclusión (arranca un token `-campo:`). */
const EXCLUDE_ROOT_LABEL = "Excluir";

interface KeySuggestionOptions {
  /** Token en modo exclusión (`-`): los campos arman `-campo:`. */
  negated: boolean;
  /** Incluir la opción "Excluir" al final (solo con la barra vacía). */
  includeExclude: boolean;
}

function buildKeySuggestions(
  configs: FilterQualifierConfig[],
  keyPart: string,
  { negated, includeExclude }: KeySuggestionOptions,
): FilterSuggestion[] {
  // En modo exclusión el campo elegido conserva el `-` para formar `-campo:`.
  const prefix = negated ? "-" : "";

  const fieldSuggestions = configs
    .filter((config) => config.kind !== "text" && config.key)
    .filter(
      (config) =>
        startsWithNormalized(config.key, keyPart) ||
        startsWithNormalized(config.label, keyPart),
    )
    .map((config) => ({
      group: "key" as const,
      icon: getQualifierIcon(config),
      id: `${OPTION_ID_PREFIX}-key-${negated ? "neg-" : ""}${config.key}`,
      insertText: `${prefix}${config.key}:`,
      keepOpen: true,
      label: config.label,
    }));

  // Meta-claves de presencia como campos de primer nivel (`tiene:` / `no:`); no
  // se ofrecen en modo exclusión (la ausencia ya se cubre con `no:`).
  const metaSuggestions = negated
    ? []
    : PRESENCE_META_KEY_SUGGESTIONS.filter(
        (meta) =>
          startsWithNormalized(meta.key, keyPart) ||
          startsWithNormalized(meta.label, keyPart),
      ).map((meta) => ({
        group: "meta" as const,
        icon: meta.icon,
        id: `${OPTION_ID_PREFIX}-key-${meta.key}`,
        insertText: `${meta.key}:`,
        keepOpen: true,
        label: meta.label,
      }));

  // "Excluir" al final (estilo GitHub): inserta `-` y reabre la lista de campos
  // para elegir cuál excluir.
  const excludeSuggestion: FilterSuggestion[] = includeExclude
    ? [
        {
          group: "meta",
          icon: CircleMinus,
          id: `${OPTION_ID_PREFIX}-exclude-root`,
          insertText: "-",
          keepOpen: true,
          label: EXCLUDE_ROOT_LABEL,
        },
      ]
    : [];

  return [...fieldSuggestions, ...metaSuggestions, ...excludeSuggestion];
}

/**
 * Sugerencias de valor para una meta-clave de presencia (`tiene:` / `no:`): el
 * "valor" es la clave del campo destino (`tiene:enviados`, `no:carpeta`).
 */
function buildMetaValueSuggestions(
  configs: FilterQualifierConfig[],
  metaKey: string,
  valuePart: string,
  appliedFilters: AppliedFilter[],
): FilterSuggestion[] {
  return configs
    .filter((config) => config.kind !== "text" && config.key)
    .filter(
      (config) =>
        !hasPresenceMetaFilterAlreadyApplied(config, appliedFilters),
    )
    .filter(
      (config) =>
        startsWithNormalized(config.key, valuePart) ||
        startsWithNormalized(config.label, valuePart),
    )
    .map((config) => ({
      group: "value" as const,
      icon: getQualifierIcon(config),
      id: `${OPTION_ID_PREFIX}-meta-${metaKey}-${config.key}`,
      insertText: `${config.key} `,
      keepOpen: false,
      label: config.label,
    }));
}

/**
 * Bloque universal que aparece al entrar a cualquier filtro: presencia
 * (`tiene:<clave>`), ausencia (`no:<clave>`) y exclusión de un valor
 * (`-<clave>:`). Reescriben el token completo, por eso usan `replaceTokenStart`.
 */
function buildPresenceAndExcludeSuggestions(
  config: FilterQualifierConfig,
): FilterSuggestion[] {
  const suggestions: FilterSuggestion[] = [
    {
      group: "meta",
      icon: CircleSlash,
      id: `${OPTION_ID_PREFIX}-presence-no-${config.key}`,
      insertText: `${PRESENCE_NO_META_KEY}:${config.key} `,
      keepOpen: false,
      label: `No tiene ${config.label}`,
      replaceTokenStart: true,
    },
    {
      group: "meta",
      icon: Check,
      id: `${OPTION_ID_PREFIX}-presence-has-${config.key}`,
      insertText: `${PRESENCE_HAS_META_KEY}:${config.key} `,
      keepOpen: false,
      label: `Tiene ${config.label}`,
      replaceTokenStart: true,
    },
  ];

  // Excluir un valor concreto solo aplica a kinds con valores; en presencia pura
  // (deuda) el único filtro es tener/no tener, ya cubierto arriba.
  if (config.kind !== "presence") {
    suggestions.push({
      group: "meta",
      icon: CircleMinus,
      id: `${OPTION_ID_PREFIX}-exclude-${config.key}`,
      insertText: `-${config.key}:`,
      keepOpen: true,
      label: `Excluir ${config.label}…`,
      replaceTokenStart: true,
    });
  }

  return suggestions;
}

function getValueSuggestionSource(
  config: FilterQualifierConfig,
): ValueSuggestionOption[] {
  if (config.kind === "enum" || config.kind === "folder") {
    return (config.options ?? []).map((option) => ({
      label: option.label,
      slug: option.slug,
      value: option.value,
    }));
  }

  if (config.kind === "presence") {
    // La presencia se ofrece con el bloque universal No/Tiene, no como valores.
    return [];
  }

  if (config.kind === "yearMonthRange") {
    return YEAR_MONTH_VALUE_SUGGESTIONS;
  }

  if (config.kind === "numberRange") {
    return NUMBER_RANGE_VALUE_SUGGESTIONS;
  }

  if (config.kind === "textMatch") {
    return TEXT_MATCH_VALUE_SUGGESTIONS;
  }

  return [];
}

function hasPresenceMetaFilterAlreadyApplied(
  config: FilterQualifierConfig,
  appliedFilters: AppliedFilter[],
): boolean {
  return appliedFilters.some(
    (appliedFilter) =>
      appliedFilter.key === config.key &&
      !appliedFilter.negated &&
      appliedFilter.value.kind === "presence",
  );
}

function hasSelectableValueAlreadyApplied(
  config: FilterQualifierConfig,
  option: ValueSuggestionOption,
  appliedFilters: AppliedFilter[],
): boolean {
  if (config.kind === "enum") {
    return appliedFilters.some(
      (appliedFilter) =>
        appliedFilter.key === config.key &&
        appliedFilter.value.kind === "enum" &&
        appliedFilter.value.value === option.value,
    );
  }

  if (config.kind === "folder") {
    return appliedFilters.some(
      (appliedFilter) =>
        appliedFilter.key === config.key &&
        appliedFilter.value.kind === "folder" &&
        appliedFilter.value.folderId === option.value,
    );
  }

  return false;
}

function getAppliedPresenceValue(
  config: FilterQualifierConfig,
  appliedFilters: AppliedFilter[],
): "hasValue" | "noValue" | null {
  const presenceFilter = appliedFilters.find(
    (appliedFilter) =>
      appliedFilter.key === config.key &&
      !appliedFilter.negated &&
      appliedFilter.value.kind === "presence",
  );

  return presenceFilter?.value.kind === "presence"
    ? presenceFilter.value.value
    : null;
}

function isSelectableValueCompatibleWithPresence(
  config: FilterQualifierConfig,
  option: ValueSuggestionOption,
  appliedFilters: AppliedFilter[],
): boolean {
  if (config.kind !== "folder") {
    return true;
  }

  const presenceValue = getAppliedPresenceValue(config, appliedFilters);

  if (presenceValue === "hasValue") {
    return option.value !== UNASSIGNED_FOLDER_FILTER_VALUE;
  }

  if (presenceValue === "noValue") {
    return false;
  }

  return true;
}

function buildValueSuggestions(
  config: FilterQualifierConfig,
  valuePart: string,
  negated: boolean,
  appliedFilters: AppliedFilter[],
): FilterSuggestion[] {
  // Los operadores numéricos no cierran el popover: el usuario completa el número.
  const defaultKeepOpen = config.kind === "numberRange";

  // Para texto, los operadores (empieza/contiene/termina) son un menú inicial:
  // aparecen al entrar al filtro y desaparecen apenas se escribe el texto, igual
  // que en GitHub. El resto de los kinds filtra sus valores a medida que se tipea.
  const sourceOptions =
    config.kind === "textMatch" && valuePart !== ""
      ? []
      : getValueSuggestionSource(config);

  // Para listas seleccionables (enum/folder) se tolera un `@` inicial al estilo
  // "mención" (p. ej. `prestamista:@vero`) al filtrar las opciones.
  const filterValuePart =
    config.kind === "enum" || config.kind === "folder"
      ? valuePart.replace(/^@/, "")
      : valuePart;

  const valueSuggestions = sourceOptions
    .filter(
      (option) =>
        !hasSelectableValueAlreadyApplied(
          config,
          option,
          appliedFilters,
        ) &&
        isSelectableValueCompatibleWithPresence(
          config,
          option,
          appliedFilters,
        ),
    )
    .filter((option) => startsWithNormalized(option.slug, filterValuePart))
    .map((option) => {
      const keepOpen = option.keepOpen ?? defaultKeepOpen;
      const insertText =
        option.insertText ?? (keepOpen ? option.slug : `${option.slug} `);

      return {
        caretOffset: option.caretOffset,
        group: "value" as const,
        icon: getQualifierIcon(config),
        id: `${OPTION_ID_PREFIX}-value-${config.key}-${option.name ?? option.slug}`,
        insertText,
        keepOpen,
        label: option.label,
      };
    });

  // El bloque universal (No tiene / Tiene / Excluir) encabeza las sugerencias al
  // entrar al filtro (valor vacío) y solo en tokens no negados: dentro de
  // `-clave:` el usuario ya excluye y elige directamente el valor a excluir.
  if (negated || valuePart.length > 0) {
    return valueSuggestions;
  }

  return [...buildPresenceAndExcludeSuggestions(config), ...valueSuggestions];
}

function resolveConfigByKey(
  configs: FilterQualifierConfig[],
  rawKey: string,
): FilterQualifierConfig | undefined {
  const normalized = normalizeFilterSlug(rawKey);

  return configs.find((config) => {
    if (config.kind === "text" || !config.key) {
      return false;
    }

    if (normalizeFilterSlug(config.key) === normalized) {
      return true;
    }

    return (config.aliases ?? []).some(
      (alias) => normalizeFilterSlug(alias) === normalized,
    );
  });
}

/**
 * Parte la query en nodos para el overlay de resaltado: los rangos de valores
 * válidos se pintan con color de acento; el resto queda con el color normal.
 */
function renderHighlightedQuery(
  value: string,
  ranges: ValueHighlightRange[],
): React.ReactNode {
  if (ranges.length === 0) {
    return value;
  }

  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  ranges.forEach((range, index) => {
    if (range.start > cursor) {
      nodes.push(value.slice(cursor, range.start));
    }

    nodes.push(
      <span className="text-primary" key={`highlight-${index}`}>
        {value.slice(range.start, range.end)}
      </span>,
    );
    cursor = range.end;
  });

  if (cursor < value.length) {
    nodes.push(value.slice(cursor));
  }

  return nodes;
}

/**
 * Barra de filtro estilo GitHub Issues: input único con autocompletado de
 * `clave:valor`. Sugiere primero los campos disponibles y luego los valores de
 * cada campo, con navegación por teclado y semántica ARIA de combobox/listbox.
 * La navegación es virtual: el foco real nunca abandona el input.
 */
export function FilterQueryBar({
  configs,
  value,
  onValueChange,
  placeholder = DEFAULT_PLACEHOLDER,
  ariaLabel = DEFAULT_ARIA_LABEL,
  className,
  onFocusChange,
  trailingAction,
}: FilterQueryBarProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const highlightOverlayRef = React.useRef<HTMLDivElement>(null);
  const pendingCaretRef = React.useRef<number | null>(null);
  const [caretIndex, setCaretIndex] = React.useState(0);
  const [isOpen, setIsOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  // El popover se abre al enfocar; sin esta marca, Tab insertaría la primera
  // sugerencia en vez de mover el foco. Solo interceptamos Tab cuando el usuario
  // navegó explícitamente las sugerencias con las flechas.
  const [hasNavigatedSuggestions, setHasNavigatedSuggestions] =
    React.useState(false);

  const suggestions = React.useMemo<FilterSuggestion[]>(() => {
    const activeToken = getActiveFilterToken(value, caretIndex);
    const appliedFilters = parseFilterQuery(value, configs).appliedFilters;

    if (activeToken.mode === "key") {
      // En modo clave negado (`-` / `-cam`) se sugieren los campos a excluir, que
      // arman `-campo:`. El texto libre `-palabra` sigue funcionando porque una
      // palabra que no matchea ninguna clave no produce sugerencias. "Excluir"
      // solo aparece con la barra vacía (sin clave a medio tipear ni negación).
      return buildKeySuggestions(configs, activeToken.keyPart, {
        includeExclude: !activeToken.negated && activeToken.keyPart === "",
        negated: activeToken.negated,
      });
    }

    const normalizedResolvedKey = normalizeFilterSlug(
      activeToken.resolvedKey ?? "",
    );

    // Meta-claves (`tiene:` / `no:`): el valor a sugerir es la clave del campo.
    if (
      normalizedResolvedKey === PRESENCE_HAS_META_KEY ||
      normalizedResolvedKey === PRESENCE_NO_META_KEY
    ) {
      return buildMetaValueSuggestions(
        configs,
        normalizedResolvedKey,
        activeToken.valuePart,
        appliedFilters,
      );
    }

    const config = resolveConfigByKey(configs, activeToken.resolvedKey ?? "");

    if (!config) {
      return [];
    }

    return buildValueSuggestions(
      config,
      activeToken.valuePart,
      activeToken.negated,
      appliedFilters,
    );
  }, [caretIndex, configs, value]);

  const invalidTokenCount = React.useMemo(
    () => parseFilterQuery(value, configs).invalidTokens.length,
    [configs, value],
  );

  const highlightRanges = React.useMemo(
    () => getValueHighlightRanges(value, configs),
    [configs, value],
  );

  // El overlay de resaltado debe seguir el scroll horizontal del input cuando el
  // texto excede el ancho visible, para que el color quede alineado al caret.
  const syncOverlayScroll = React.useCallback(() => {
    if (highlightOverlayRef.current && inputRef.current) {
      highlightOverlayRef.current.scrollLeft = inputRef.current.scrollLeft;
    }
  }, []);

  React.useEffect(() => {
    setActiveIndex((previousIndex) =>
      previousIndex < suggestions.length ? previousIndex : 0,
    );
  }, [suggestions]);

  React.useLayoutEffect(() => {
    const pendingCaret = pendingCaretRef.current;

    if (pendingCaret == null || !inputRef.current) {
      return;
    }

    inputRef.current.setSelectionRange(pendingCaret, pendingCaret);
    setCaretIndex(pendingCaret);
    pendingCaretRef.current = null;
  }, [value]);

  React.useLayoutEffect(() => {
    syncOverlayScroll();
  }, [syncOverlayScroll, value]);

  const isPopoverOpen = isOpen && suggestions.length > 0;
  const activeSuggestion = isPopoverOpen ? suggestions[activeIndex] : undefined;

  const syncCaretFromInput = React.useCallback(() => {
    if (inputRef.current) {
      setCaretIndex(inputRef.current.selectionStart ?? 0);
    }
  }, []);

  const applySuggestion = React.useCallback(
    (suggestion: FilterSuggestion) => {
      const activeToken = getActiveFilterToken(
        value,
        inputRef.current?.selectionStart ?? caretIndex,
      );
      // Las opciones universales reescriben el token entero (clave incluida); el
      // resto solo reemplaza el tramo del valor bajo el caret.
      const replaceStart = suggestion.replaceTokenStart
        ? activeToken.tokenStart
        : activeToken.replaceStart;
      const before = value.slice(0, replaceStart);
      const after = value.slice(activeToken.replaceEnd);
      const nextValue = before + suggestion.insertText + after;

      // El caret queda dentro del texto insertado (p. ej. entre los `*` de `**`).
      pendingCaretRef.current =
        before.length + (suggestion.caretOffset ?? suggestion.insertText.length);
      onValueChange(nextValue);
      setIsOpen(true);
      setActiveIndex(0);
      setHasNavigatedSuggestions(false);

      if (!suggestion.keepOpen) {
        // El valor quedó completo; el siguiente token reabrirá en modo claves.
        setIsOpen(false);
      }
    },
    [caretIndex, onValueChange, value],
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHasNavigatedSuggestions(true);

        if (!isPopoverOpen) {
          setIsOpen(true);
          return;
        }

        setActiveIndex((previousIndex) =>
          suggestions.length === 0
            ? 0
            : (previousIndex + 1) % suggestions.length,
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHasNavigatedSuggestions(true);

        if (!isPopoverOpen) {
          setIsOpen(true);
          return;
        }

        setActiveIndex((previousIndex) =>
          suggestions.length === 0
            ? 0
            : (previousIndex - 1 + suggestions.length) % suggestions.length,
        );
        return;
      }

      if (event.key === "Enter" && activeSuggestion) {
        event.preventDefault();
        applySuggestion(activeSuggestion);
        return;
      }

      // Tab solo acepta una sugerencia si el usuario la resaltó con las flechas;
      // de lo contrario deja que el foco se mueva con normalidad.
      if (
        event.key === "Tab" &&
        hasNavigatedSuggestions &&
        activeSuggestion
      ) {
        event.preventDefault();
        applySuggestion(activeSuggestion);
        return;
      }

      if (event.key === "Escape" && isPopoverOpen) {
        event.preventDefault();
        event.stopPropagation();
        setIsOpen(false);
      }
    },
    [
      activeSuggestion,
      applySuggestion,
      hasNavigatedSuggestions,
      isPopoverOpen,
      suggestions.length,
    ],
  );

  const handleClear = React.useCallback(() => {
    onValueChange("");
    pendingCaretRef.current = 0;
    setIsOpen(false);
    inputRef.current?.focus();
  }, [onValueChange]);

  return (
    <div className={cn("grid w-full gap-2", className)}>
      <Popover onOpenChange={setIsOpen} open={isPopoverOpen}>
        <PopoverAnchor asChild>
          <div className="relative w-full">
            <Input
              aria-activedescendant={activeSuggestion?.id}
              aria-autocomplete="list"
              aria-controls={LISTBOX_ID}
              aria-expanded={isPopoverOpen}
              aria-label={ariaLabel}
              autoComplete="off"
              // El texto se vuelve transparente: lo dibuja el overlay coloreado de
              // abajo. El caret queda visible con el color de texto normal. El
              // padding derecho deja lugar a los iconos (limpiar + acción opcional).
              className={cn(
                "w-full text-transparent",
                trailingAction ? "pr-16" : "pr-9",
              )}
              onChange={(event) => {
                onValueChange(event.target.value);
                setIsOpen(true);
                setActiveIndex(0);
                setHasNavigatedSuggestions(false);
                setCaretIndex(event.target.selectionStart ?? event.target.value.length);
              }}
              onClick={syncCaretFromInput}
              onBlur={() => {
                setHasNavigatedSuggestions(false);
                onFocusChange?.(false);
              }}
              onFocus={() => {
                syncCaretFromInput();
                setIsOpen(true);
                onFocusChange?.(true);
              }}
              onKeyDown={handleKeyDown}
              onKeyUp={syncCaretFromInput}
              onScroll={syncOverlayScroll}
              placeholder={placeholder}
              ref={inputRef}
              role="combobox"
              style={{ caretColor: "var(--foreground)" }}
              type="text"
              value={value}
            />
            <div
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-0 flex items-center overflow-hidden rounded-lg border border-transparent px-2.5 text-base text-foreground select-none md:text-sm",
                trailingAction ? "pr-16" : "pr-9",
              )}
              ref={highlightOverlayRef}
            >
              <span className="whitespace-pre">
                {renderHighlightedQuery(value, highlightRanges)}
              </span>
            </div>
            <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
              {value ? (
                <Button
                  aria-label={CLEAR_FILTER_ARIA_LABEL}
                  className="active:-translate-y-0"
                  onClick={handleClear}
                  size="icon-xs"
                  type="button"
                  variant="ghost"
                >
                  <X aria-hidden="true" />
                </Button>
              ) : null}
              {trailingAction}
            </div>
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          className="w-[250px] max-h-[280px] gap-0 overflow-y-auto p-1"
          onCloseAutoFocus={(event) => event.preventDefault()}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <ul
            aria-label={
              suggestions.some((suggestion) => suggestion.group === "value")
                ? VALUE_GROUP_LABEL
                : KEY_GROUP_LABEL
            }
            className="grid gap-0.5"
            id={LISTBOX_ID}
            role="listbox"
          >
            {suggestions.map((suggestion, index) => {
              const SuggestionIcon = suggestion.icon;
              // Separador entre grupos lógicos (p. ej. campos | presencia/exclusión).
              const showSeparator =
                index > 0 && suggestions[index - 1].group !== suggestion.group;

              return (
                <React.Fragment key={suggestion.id}>
                  {showSeparator ? (
                    <li
                      aria-hidden="true"
                      className="my-1 border-t border-border"
                      role="presentation"
                    />
                  ) : null}
                  <li
                    aria-selected={index === activeIndex}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                      index === activeIndex
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground",
                    )}
                    id={suggestion.id}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      applySuggestion(suggestion);
                    }}
                    role="option"
                  >
                    <SuggestionIcon
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                    <span className="truncate">{suggestion.label}</span>
                  </li>
                </React.Fragment>
              );
            })}
          </ul>
        </PopoverContent>
      </Popover>
      <span aria-live="polite" className="sr-only">
        {isPopoverOpen ? `${suggestions.length} sugerencias disponibles` : ""}
        {invalidTokenCount > 0
          ? ` ${invalidTokenCount} filtros no aplicados`
          : ""}
      </span>
    </div>
  );
}
