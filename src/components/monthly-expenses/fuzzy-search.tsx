import type { ReactNode } from "react";

const DIACRITICS_PATTERN = /[\u0300-\u036f]/g;

interface SearchCharWithSourceIndex {
  char: string;
  sourceIndex: number;
}

export function normalizeSearchValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(DIACRITICS_PATTERN, "")
    .toLocaleLowerCase();
}

function getSearchCharsWithSourceIndices(
  value: string,
): SearchCharWithSourceIndex[] {
  const chars: SearchCharWithSourceIndex[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const normalizedChar = normalizeSearchValue(value[index]);

    if (!normalizedChar) {
      continue;
    }

    for (const char of normalizedChar) {
      chars.push({
        char,
        sourceIndex: index,
      });
    }
  }

  return chars;
}

export function getFuzzyMatchIndices(value: string, query: string): number[] | null {
  const normalizedQuery = normalizeSearchValue(query).trim();

  if (!normalizedQuery) {
    return [];
  }

  const valueChars = getSearchCharsWithSourceIndices(value);
  const queryChars = Array.from(normalizedQuery);
  const matchedIndices: number[] = [];
  let valueCursor = 0;

  for (const queryChar of queryChars) {
    let foundAt = -1;

    for (let index = valueCursor; index < valueChars.length; index += 1) {
      if (valueChars[index].char === queryChar) {
        foundAt = index;
        break;
      }
    }

    if (foundAt === -1) {
      return null;
    }

    matchedIndices.push(valueChars[foundAt].sourceIndex);
    valueCursor = foundAt + 1;
  }

  return Array.from(new Set(matchedIndices));
}

export function renderHighlightedText(
  value: string,
  matchedIndices: number[],
  highlightClassName: string,
  keyPrefix: string,
): ReactNode {
  if (matchedIndices.length === 0) {
    return value;
  }

  const matchedIndexSet = new Set(matchedIndices);
  const highlightedParts: ReactNode[] = [];
  let currentStart = 0;
  let partIndex = 0;

  for (let index = 0; index < value.length; index += 1) {
    if (!matchedIndexSet.has(index)) {
      continue;
    }

    if (currentStart < index) {
      highlightedParts.push(
        <span key={`${keyPrefix}-text-${partIndex}`}>
          {value.slice(currentStart, index)}
        </span>,
      );
      partIndex += 1;
    }

    let matchEnd = index + 1;
    while (matchEnd < value.length && matchedIndexSet.has(matchEnd)) {
      matchEnd += 1;
    }

    highlightedParts.push(
      <mark className={highlightClassName} key={`${keyPrefix}-match-${partIndex}`}>
        {value.slice(index, matchEnd)}
      </mark>,
    );
    partIndex += 1;
    currentStart = matchEnd;
    index = matchEnd - 1;
  }

  if (currentStart < value.length) {
    highlightedParts.push(
      <span key={`${keyPrefix}-text-${partIndex}`}>
        {value.slice(currentStart)}
      </span>,
    );
  }

  return highlightedParts;
}