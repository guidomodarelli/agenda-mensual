import type { DataTableColumnFilterValue } from "./data-table";

/**
 * Gramática pura (sin React) para una barra de filtro estilo GitHub Issues.
 *
 * La barra acepta una query de texto con tokens `clave:valor` más texto libre.
 * Este módulo tokeniza la query, la parsea contra una configuración de
 * qualifiers y la traduce a los tres canales de filtrado que ya consume la
 * tabla: búsqueda fuzzy por descripción, exclusiones de descripción y filtros
 * avanzados por columna (`DataTableColumnFilterValue`).
 */

const DIACRITICS_PATTERN = /[̀-ͯ]/g;
const YEAR_MONTH_SLUG_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const RANGE_SEPARATOR = "..";

/** Slug de valor para los modos de presencia/rango mes-año sin cota. */
export const YEAR_MONTH_NO_VALUE_SLUG = "sin-fechas";
export const YEAR_MONTH_HAS_VALUE_SLUG = "con-fechas";
export const PRESENCE_TRUE_SLUG = "si";
export const PRESENCE_FALSE_SLUG = "no";

export type FilterQualifierKind =
  | "text"
  | "numberRange"
  | "enum"
  | "presence"
  | "yearMonthRange";

export interface FilterQualifierOption {
  /** Slug que el usuario tipea (sin acentos ni espacios). */
  slug: string;
  /** Etiqueta visible en el autocompletado. */
  label: string;
  /** Valor interno que consume el matcher de la columna. */
  value: string;
}

export interface FilterQualifierConfig {
  /**
   * Slug que el usuario tipea antes del `:`. Cadena vacía para el qualifier de
   * texto libre por defecto (búsqueda fuzzy por descripción).
   */
  key: string;
  /** Claves alternativas aceptadas al parsear (no se sugieren). */
  aliases?: string[];
  /** Columna destino para los filtros avanzados. Ausente para texto libre. */
  columnId?: string;
  kind: FilterQualifierKind;
  /** Etiqueta humana mostrada en la sugerencia de clave. */
  label: string;
  /** Valores sugeridos para enum/presence. */
  options?: FilterQualifierOption[];
}

export interface FilterQueryToken {
  /** Substring exacto del token (sin espacios alrededor). */
  raw: string;
  /** Índice del primer carácter del token en la query original. */
  startIndex: number;
  /** Índice siguiente al último carácter del token. */
  endIndex: number;
  /** Si el token arranca con `-` (negación / exclusión). */
  negated: boolean;
  /** Texto de la clave tal cual se tipeó (sin normalizar), o `null`. */
  rawKey: string | null;
  /** Valor del qualifier desenrollado de comillas, o `null` si no hay `:`. */
  value: string | null;
  /** Si el token contiene un `:` que separa clave de valor. */
  hasColon: boolean;
}

export type InvalidFilterTokenReason = "unknownKey" | "invalidValue";

export interface InvalidFilterToken {
  raw: string;
  reason: InvalidFilterTokenReason;
}

export interface ParsedFilterQuery {
  /** Texto libre positivo, concatenado para la búsqueda fuzzy por descripción. */
  descriptionFilter: string;
  /** Textos a excluir (`-texto`), crudos como espera la tabla. */
  excludedDescriptionFilters: string[];
  /** Filtros avanzados listos para inyectar a TanStack, por columnId. */
  advancedFiltersByColumn: Record<string, DataTableColumnFilterValue>;
  /** Tokens que no se pudieron aplicar (clave o valor inválidos). */
  invalidTokens: InvalidFilterToken[];
}

/** Normaliza una clave o slug: sin acentos, minúsculas, recortado. */
export function normalizeFilterSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(DIACRITICS_PATTERN, "")
    .toLocaleLowerCase()
    .trim();
}

function stripSurroundingQuotes(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];

    if ((first === '"' || first === "'") && first === last) {
      return value.slice(1, -1);
    }
  }

  // Comilla de apertura sin cierre (token a medio tipear).
  if (value.startsWith('"') || value.startsWith("'")) {
    return value.slice(1);
  }

  return value;
}

/**
 * Envuelve en comillas un valor que, sin comillas, se re-tokenizaría distinto:
 * espacios, un `:` (se interpretaría como `clave:valor`) o un `-` inicial (se
 * interpretaría como exclusión). Mantiene la query como fuente de verdad sin
 * pérdida entre la barra unificada y los controles clásicos.
 */
function quoteTokenIfNeeded(value: string): string {
  return /[\s:]/.test(value) || value.startsWith("-")
    ? `"${value}"`
    : value;
}

/**
 * Serializa el texto libre de descripción citando, palabra por palabra, los
 * segmentos que se parsearían como un token (por ejemplo `total:100`), de modo
 * que un filtro de descripción no se transforme en un filtro avanzado al
 * re-parsear la query.
 */
function serializeDescriptionFilter(descriptionFilter: string): string {
  return descriptionFilter
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .map(quoteTokenIfNeeded)
    .join(" ");
}

/**
 * Divide la query en tokens respetando comillas (`"..."` / `'...'` agrupan
 * espacios). Conserva los índices de cada token para que el autocompletado
 * pueda ubicar el token bajo el caret.
 */
export function tokenizeFilterQuery(query: string): FilterQueryToken[] {
  const tokens: FilterQueryToken[] = [];
  let index = 0;
  const { length } = query;

  while (index < length) {
    if (/\s/.test(query[index])) {
      index += 1;
      continue;
    }

    const startIndex = index;
    let quoteChar: string | null = null;

    while (index < length) {
      const character = query[index];

      if (quoteChar) {
        if (character === quoteChar) {
          quoteChar = null;
        }
        index += 1;
        continue;
      }

      if (character === '"' || character === "'") {
        quoteChar = character;
        index += 1;
        continue;
      }

      if (/\s/.test(character)) {
        break;
      }

      index += 1;
    }

    const raw = query.slice(startIndex, index);
    tokens.push(buildToken(raw, startIndex, index));
  }

  return tokens;
}

function findKeyColonIndex(text: string): number {
  for (let position = 0; position < text.length; position += 1) {
    const character = text[position];

    if (character === '"' || character === "'") {
      // Una comilla antes del `:` significa que no hay clave (es texto libre).
      return -1;
    }

    if (character === ":") {
      return position;
    }
  }

  return -1;
}

function buildToken(
  raw: string,
  startIndex: number,
  endIndex: number,
): FilterQueryToken {
  const negated = raw.startsWith("-") && raw.length > 1;
  const remainder = negated ? raw.slice(1) : raw;
  const colonIndex = findKeyColonIndex(remainder);

  if (colonIndex === -1) {
    return {
      endIndex,
      hasColon: false,
      negated,
      raw,
      rawKey: null,
      startIndex,
      value: stripSurroundingQuotes(remainder),
    };
  }

  return {
    endIndex,
    hasColon: true,
    negated,
    raw,
    rawKey: remainder.slice(0, colonIndex),
    startIndex,
    value: stripSurroundingQuotes(remainder.slice(colonIndex + 1)),
  };
}

function buildQualifierLookup(
  configs: FilterQualifierConfig[],
): Map<string, FilterQualifierConfig> {
  const lookup = new Map<string, FilterQualifierConfig>();

  for (const config of configs) {
    if (config.kind === "text" || !config.key) {
      continue;
    }

    lookup.set(normalizeFilterSlug(config.key), config);

    for (const alias of config.aliases ?? []) {
      lookup.set(normalizeFilterSlug(alias), config);
    }
  }

  return lookup;
}

function parseNumber(value: string): number | null {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Parsea el valor de un qualifier numérico. Acepta comparadores (`>`, `>=`,
 * `<`, `<=`, `=`), igualdad implícita (`N`) y rangos (`A..B`, `A..`, `..B`).
 * `>` y `>=` son ambos inclusivos para preservar la semántica del matcher
 * existente (`value < min → false`); `<` y `<=` mapean a `max`.
 */
function parseNumberRangeValue(
  value: string,
): Extract<DataTableColumnFilterValue, { kind: "numberRange" }> | null {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (normalized.includes(RANGE_SEPARATOR)) {
    const [rawMin, rawMax] = normalized.split(RANGE_SEPARATOR, 2);
    const hasMin = rawMin.trim().length > 0;
    const hasMax = rawMax.trim().length > 0;

    if (!hasMin && !hasMax) {
      return null;
    }

    const min = hasMin ? parseNumber(rawMin) : null;
    const max = hasMax ? parseNumber(rawMax) : null;

    if ((hasMin && min == null) || (hasMax && max == null)) {
      return null;
    }

    return {
      kind: "numberRange",
      ...(max != null ? { max } : {}),
      ...(min != null ? { min } : {}),
    };
  }

  if (normalized.startsWith(">=") || normalized.startsWith(">")) {
    const min = parseNumber(normalized.replace(/^>=?/, ""));
    return min == null ? null : { kind: "numberRange", min };
  }

  if (normalized.startsWith("<=") || normalized.startsWith("<")) {
    const max = parseNumber(normalized.replace(/^<=?/, ""));
    return max == null ? null : { kind: "numberRange", max };
  }

  const exact = parseNumber(normalized.replace(/^=/, ""));

  return exact == null ? null : { kind: "numberRange", max: exact, min: exact };
}

/** Convierte un slug `AAAA-MM` a su valor numérico comparable `AAAAMM`. */
export function parseYearMonthSlug(value: string): number | null {
  const match = YEAR_MONTH_SLUG_PATTERN.exec(value.trim());

  if (!match) {
    return null;
  }

  const [, year, month] = match;

  return Number(`${year}${month}`);
}

/** Formatea un valor numérico `AAAAMM` de vuelta a su slug `AAAA-MM`. */
export function formatYearMonthSlug(value: number): string {
  const year = Math.floor(value / 100);
  const month = value % 100;

  return `${year}-${String(month).padStart(2, "0")}`;
}

function parseYearMonthRangeValue(
  value: string,
): Extract<DataTableColumnFilterValue, { kind: "yearMonthRange" }> | null {
  const normalized = normalizeFilterSlug(value);

  if (!normalized) {
    return null;
  }

  if (normalized === YEAR_MONTH_NO_VALUE_SLUG) {
    return { kind: "yearMonthRange", mode: "noValue" };
  }

  if (normalized === YEAR_MONTH_HAS_VALUE_SLUG) {
    return { kind: "yearMonthRange", mode: "hasValue" };
  }

  if (normalized.includes(RANGE_SEPARATOR)) {
    const [rawFrom, rawTo] = normalized.split(RANGE_SEPARATOR, 2);
    const hasFrom = rawFrom.trim().length > 0;
    const hasTo = rawTo.trim().length > 0;

    if (!hasFrom && !hasTo) {
      return null;
    }

    const min = hasFrom ? parseYearMonthSlug(rawFrom) : null;
    const max = hasTo ? parseYearMonthSlug(rawTo) : null;

    if ((hasFrom && min == null) || (hasTo && max == null)) {
      return null;
    }

    if (min != null && max != null) {
      return { kind: "yearMonthRange", max, min, mode: "range" };
    }

    if (min != null) {
      return { kind: "yearMonthRange", min, mode: "from" };
    }

    return { kind: "yearMonthRange", max: max as number, mode: "to" };
  }

  const exact = parseYearMonthSlug(normalized);

  if (exact == null) {
    return null;
  }

  return { kind: "yearMonthRange", max: exact, min: exact, mode: "range" };
}

function buildColumnFilterValue(
  config: FilterQualifierConfig,
  value: string,
): DataTableColumnFilterValue | null {
  if (config.kind === "numberRange") {
    return parseNumberRangeValue(value);
  }

  if (config.kind === "yearMonthRange") {
    return parseYearMonthRangeValue(value);
  }

  if (config.kind === "enum") {
    const normalized = normalizeFilterSlug(value);
    const option = (config.options ?? []).find(
      (candidate) => normalizeFilterSlug(candidate.slug) === normalized,
    );

    return option ? { kind: "enum", value: option.value } : null;
  }

  if (config.kind === "presence") {
    const normalized = normalizeFilterSlug(value);

    if (normalized === PRESENCE_TRUE_SLUG) {
      return { kind: "presence", value: "hasValue" };
    }

    if (normalized === PRESENCE_FALSE_SLUG) {
      return { kind: "presence", value: "noValue" };
    }

    return null;
  }

  return null;
}

function mergeColumnFilterValue(
  existing: DataTableColumnFilterValue | undefined,
  next: DataTableColumnFilterValue,
): DataTableColumnFilterValue {
  if (
    existing &&
    existing.kind === "numberRange" &&
    next.kind === "numberRange"
  ) {
    return {
      kind: "numberRange",
      ...(next.max ?? existing.max) != null
        ? { max: next.max ?? existing.max }
        : {},
      ...(next.min ?? existing.min) != null
        ? { min: next.min ?? existing.min }
        : {},
    };
  }

  return next;
}

/** Parsea la query completa contra la configuración de qualifiers. */
export function parseFilterQuery(
  query: string,
  configs: FilterQualifierConfig[],
): ParsedFilterQuery {
  const tokens = tokenizeFilterQuery(query);
  const lookup = buildQualifierLookup(configs);
  const descriptionParts: string[] = [];
  const excludedDescriptionFilters: string[] = [];
  const advancedFiltersByColumn: Record<string, DataTableColumnFilterValue> = {};
  const invalidTokens: InvalidFilterToken[] = [];

  for (const token of tokens) {
    if (token.hasColon && token.rawKey) {
      const config = lookup.get(normalizeFilterSlug(token.rawKey));

      if (!config || !config.columnId) {
        invalidTokens.push({ raw: token.raw, reason: "unknownKey" });
        const freeText = token.negated ? token.raw.slice(1) : token.raw;

        if (token.negated) {
          excludedDescriptionFilters.push(freeText.trim());
        } else if (freeText.trim()) {
          descriptionParts.push(freeText.trim());
        }

        continue;
      }

      const value = token.value ?? "";
      const filterValue = buildColumnFilterValue(config, value);

      if (!filterValue) {
        if (value.trim()) {
          invalidTokens.push({ raw: token.raw, reason: "invalidValue" });
        }

        continue;
      }

      // La negación de qualifiers no se soporta en v1: se ignora el token.
      if (token.negated) {
        continue;
      }

      advancedFiltersByColumn[config.columnId] = mergeColumnFilterValue(
        advancedFiltersByColumn[config.columnId],
        filterValue,
      );

      continue;
    }

    const text = (token.value ?? "").trim();

    if (!text) {
      continue;
    }

    if (token.negated) {
      excludedDescriptionFilters.push(text);
    } else {
      descriptionParts.push(text);
    }
  }

  return {
    advancedFiltersByColumn,
    descriptionFilter: descriptionParts.join(" "),
    excludedDescriptionFilters,
    invalidTokens,
  };
}

function serializeNumberRange(
  key: string,
  value: Extract<DataTableColumnFilterValue, { kind: "numberRange" }>,
): string | null {
  const { min, max } = value;

  if (min != null && max != null) {
    return min === max ? `${key}:=${min}` : `${key}:${min}..${max}`;
  }

  if (min != null) {
    return `${key}:>=${min}`;
  }

  if (max != null) {
    return `${key}:<=${max}`;
  }

  return null;
}

function serializeYearMonthRange(
  key: string,
  value: Extract<DataTableColumnFilterValue, { kind: "yearMonthRange" }>,
): string | null {
  if (value.mode === "noValue") {
    return `${key}:${YEAR_MONTH_NO_VALUE_SLUG}`;
  }

  if (value.mode === "hasValue") {
    return `${key}:${YEAR_MONTH_HAS_VALUE_SLUG}`;
  }

  if (value.mode === "from" && value.min != null) {
    return `${key}:${formatYearMonthSlug(value.min)}..`;
  }

  if (value.mode === "to" && value.max != null) {
    return `${key}:..${formatYearMonthSlug(value.max)}`;
  }

  if (value.mode === "range" && value.min != null && value.max != null) {
    if (value.min === value.max) {
      return `${key}:${formatYearMonthSlug(value.min)}`;
    }

    return `${key}:${formatYearMonthSlug(value.min)}..${formatYearMonthSlug(value.max)}`;
  }

  return null;
}

function serializeAdvancedFilter(
  config: FilterQualifierConfig,
  value: DataTableColumnFilterValue,
): string | null {
  if (value.kind === "numberRange") {
    return serializeNumberRange(config.key, value);
  }

  if (value.kind === "yearMonthRange") {
    return serializeYearMonthRange(config.key, value);
  }

  if (value.kind === "enum") {
    const option = (config.options ?? []).find(
      (candidate) => candidate.value === value.value,
    );

    return option ? `${config.key}:${option.slug}` : null;
  }

  return `${config.key}:${value.value === "hasValue" ? PRESENCE_TRUE_SLUG : PRESENCE_FALSE_SLUG}`;
}

/** Reconstruye una query canónica a partir de un resultado parseado. */
export function serializeFilterQuery(
  parsed: ParsedFilterQuery,
  configs: FilterQualifierConfig[],
): string {
  const segments: string[] = [];
  const descriptionFilter = parsed.descriptionFilter.trim();

  if (descriptionFilter) {
    segments.push(serializeDescriptionFilter(descriptionFilter));
  }

  for (const config of configs) {
    if (!config.columnId) {
      continue;
    }

    const value = parsed.advancedFiltersByColumn[config.columnId];

    if (!value) {
      continue;
    }

    const serialized = serializeAdvancedFilter(config, value);

    if (serialized) {
      segments.push(serialized);
    }
  }

  for (const excluded of parsed.excludedDescriptionFilters) {
    const trimmed = excluded.trim();

    if (trimmed) {
      segments.push(`-${quoteTokenIfNeeded(trimmed)}`);
    }
  }

  return segments.join(" ");
}

export type FilterSuggestionMode = "key" | "value";

export interface ActiveFilterToken {
  /** Modo de sugerencia según la posición del caret. */
  mode: FilterSuggestionMode;
  /** Texto de la clave tipeada hasta el caret (modo `key`). */
  keyPart: string;
  /** Texto del valor tipeado hasta el caret (modo `value`). */
  valuePart: string;
  /** Clave resuelta cuando el token ya tiene `:` (modo `value`). */
  resolvedKey: string | null;
  negated: boolean;
  /** Rango de la query a reemplazar al insertar una sugerencia. */
  replaceStart: number;
  replaceEnd: number;
}

/**
 * Describe el token bajo el caret para alimentar el autocompletado. Decide si
 * el usuario está tipeando una clave (sin `:`) o el valor de una clave.
 */
export function getActiveFilterToken(
  query: string,
  caretIndex: number,
): ActiveFilterToken {
  const tokens = tokenizeFilterQuery(query);
  const activeToken = tokens.find(
    (token) => caretIndex >= token.startIndex && caretIndex <= token.endIndex,
  );

  if (!activeToken) {
    return {
      keyPart: "",
      mode: "key",
      negated: false,
      replaceEnd: caretIndex,
      replaceStart: caretIndex,
      resolvedKey: null,
      valuePart: "",
    };
  }

  const negationOffset = activeToken.negated ? 1 : 0;
  const contentStart = activeToken.startIndex + negationOffset;
  const remainder = activeToken.raw.slice(negationOffset);
  const colonIndex = findKeyColonIndex(remainder);

  if (colonIndex === -1) {
    return {
      keyPart: remainder,
      mode: "key",
      negated: activeToken.negated,
      replaceEnd: activeToken.endIndex,
      replaceStart: activeToken.startIndex,
      resolvedKey: null,
      valuePart: "",
    };
  }

  const valueStart = contentStart + colonIndex + 1;

  return {
    keyPart: remainder.slice(0, colonIndex),
    mode: "value",
    negated: activeToken.negated,
    replaceEnd: activeToken.endIndex,
    replaceStart: valueStart,
    resolvedKey: remainder.slice(0, colonIndex),
    valuePart: remainder.slice(colonIndex + 1),
  };
}
