"use client";

import * as React from "react";
import { X } from "lucide-react";

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
  normalizeFilterSlug,
  parseFilterQuery,
  PRESENCE_FALSE_SLUG,
  PRESENCE_TRUE_SLUG,
  YEAR_MONTH_HAS_VALUE_SLUG,
  YEAR_MONTH_NO_VALUE_SLUG,
  type FilterQualifierConfig,
} from "@/components/ui/filter-query-grammar";

const DEFAULT_PLACEHOLDER = "Filtrar por campo o palabra clave";
const DEFAULT_ARIA_LABEL = "Filtrar gastos";
const CLEAR_FILTER_ARIA_LABEL = "Limpiar todos los filtros";
const KEY_GROUP_LABEL = "Campos";
const VALUE_GROUP_LABEL = "Valores";
const LISTBOX_ID = "filter-query-bar-listbox";
const OPTION_ID_PREFIX = "filter-query-bar-option";

const PRESENCE_VALUE_SUGGESTIONS: Array<{ slug: string; label: string }> = [
  { label: "Sí", slug: PRESENCE_TRUE_SLUG },
  { label: "No", slug: PRESENCE_FALSE_SLUG },
];

const YEAR_MONTH_VALUE_SUGGESTIONS: Array<{ slug: string; label: string }> = [
  { label: "Con fechas", slug: YEAR_MONTH_HAS_VALUE_SLUG },
  { label: "Sin fechas", slug: YEAR_MONTH_NO_VALUE_SLUG },
];

/** Opción de valor sugerida. `keepOpen` mantiene el popover para completar texto. */
interface ValueSuggestionOption {
  slug: string;
  label: string;
  keepOpen?: boolean;
}

const NUMBER_RANGE_VALUE_SUGGESTIONS: ValueSuggestionOption[] = [
  { label: "Mayor o igual (≥)", slug: ">=" },
  { label: "Menor o igual (≤)", slug: "<=" },
  { label: "Rango (100..500)", slug: ".." },
];

const TEXT_MATCH_VALUE_SUGGESTIONS: ValueSuggestionOption[] = [
  { label: "Tiene", slug: PRESENCE_TRUE_SLUG },
  { label: "No tiene", slug: PRESENCE_FALSE_SLUG },
  { keepOpen: true, label: "Empieza por…", slug: "^" },
  { keepOpen: true, label: "Igual a…", slug: "=" },
];

interface FilterSuggestion {
  id: string;
  /** Texto principal visible. */
  label: string;
  /** Texto secundario (slug o ejemplo). */
  hint?: string;
  group: "key" | "value";
  /** Texto a insertar en el rango activo de la query. */
  insertText: string;
  /** Si tras insertar se mantiene el popover abierto (encadenar clave→valor). */
  keepOpen: boolean;
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
}

function startsWithNormalized(candidate: string, prefix: string): boolean {
  if (!prefix) {
    return true;
  }

  return normalizeFilterSlug(candidate).startsWith(normalizeFilterSlug(prefix));
}

function buildKeySuggestions(
  configs: FilterQualifierConfig[],
  keyPart: string,
): FilterSuggestion[] {
  return configs
    .filter((config) => config.kind !== "text" && config.key)
    .filter(
      (config) =>
        startsWithNormalized(config.key, keyPart) ||
        startsWithNormalized(config.label, keyPart),
    )
    .map((config) => ({
      group: "key" as const,
      hint: config.key,
      id: `${OPTION_ID_PREFIX}-key-${config.key}`,
      insertText: `${config.key}:`,
      keepOpen: true,
      label: config.label,
    }));
}

function getValueSuggestionSource(
  config: FilterQualifierConfig,
): ValueSuggestionOption[] {
  if (config.kind === "enum" || config.kind === "folder") {
    return (config.options ?? []).map((option) => ({
      label: option.label,
      slug: option.slug,
    }));
  }

  if (config.kind === "presence") {
    return PRESENCE_VALUE_SUGGESTIONS;
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

function buildValueSuggestions(
  config: FilterQualifierConfig,
  valuePart: string,
): FilterSuggestion[] {
  // Los operadores (numéricos y de texto como `^`/`=`) no cierran el popover:
  // el usuario completa el número o el texto a continuación.
  const defaultKeepOpen = config.kind === "numberRange";

  return getValueSuggestionSource(config)
    .filter((option) => startsWithNormalized(option.slug, valuePart))
    .map((option) => {
      const keepOpen = option.keepOpen ?? defaultKeepOpen;

      return {
        group: "value" as const,
        hint: option.slug,
        id: `${OPTION_ID_PREFIX}-value-${config.key}-${option.slug}`,
        insertText: keepOpen ? option.slug : `${option.slug} `,
        keepOpen,
        label: option.label,
      };
    });
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
}: FilterQueryBarProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
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

    // En modo clave, un `-` inicial es una exclusión de texto (`-texto`); no se
    // sugieren claves para no pisar la negación al insertar. En modo valor
    // (`-clave:`) sí se sugieren valores: la negación queda antes del `:`.
    if (activeToken.negated && activeToken.mode === "key") {
      return [];
    }

    if (activeToken.mode === "key") {
      return buildKeySuggestions(configs, activeToken.keyPart);
    }

    const config = resolveConfigByKey(configs, activeToken.resolvedKey ?? "");

    if (!config) {
      return [];
    }

    return buildValueSuggestions(config, activeToken.valuePart);
  }, [caretIndex, configs, value]);

  const invalidTokenCount = React.useMemo(
    () => parseFilterQuery(value, configs).invalidTokens.length,
    [configs, value],
  );

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
      const before = value.slice(0, activeToken.replaceStart);
      const after = value.slice(activeToken.replaceEnd);
      const nextValue = before + suggestion.insertText + after;

      pendingCaretRef.current = before.length + suggestion.insertText.length;
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
              className="w-full pr-9"
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
              placeholder={placeholder}
              ref={inputRef}
              role="combobox"
              type="text"
              value={value}
            />
            {value ? (
              <Button
                aria-label={CLEAR_FILTER_ARIA_LABEL}
                className="absolute right-1 top-1/2 -translate-y-1/2 active:-translate-y-1/2"
                onClick={handleClear}
                size="icon-xs"
                type="button"
                variant="ghost"
              >
                <X aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) max-h-72 gap-0 overflow-y-auto p-1"
          onCloseAutoFocus={(event) => event.preventDefault()}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <ul
            aria-label={
              suggestions[0]?.group === "value"
                ? VALUE_GROUP_LABEL
                : KEY_GROUP_LABEL
            }
            className="grid gap-0.5"
            id={LISTBOX_ID}
            role="listbox"
          >
            {suggestions.map((suggestion, index) => (
              <li
                aria-selected={index === activeIndex}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm",
                  index === activeIndex
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground",
                )}
                id={suggestion.id}
                key={suggestion.id}
                onMouseDown={(event) => {
                  event.preventDefault();
                  applySuggestion(suggestion);
                }}
                role="option"
              >
                <span>{suggestion.label}</span>
                {suggestion.hint ? (
                  <span className="text-xs text-muted-foreground">
                    {suggestion.hint}
                  </span>
                ) : null}
              </li>
            ))}
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
