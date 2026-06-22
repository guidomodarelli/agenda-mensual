import {
  getActiveFilterToken,
  parseFilterQuery,
  parseYearMonthSlug,
  serializeFilterQuery,
  tokenizeFilterQuery,
  type FilterQualifierConfig,
} from "./filter-query-grammar";

const CONFIGS: FilterQualifierConfig[] = [
  { key: "", kind: "text", label: "Descripción" },
  { columnId: "subtotal", key: "subtotal", kind: "numberRange", label: "Subtotal" },
  { columnId: "total", key: "total", kind: "numberRange", label: "Total" },
  { key: "saldo", kind: "numberRange", label: "Saldo" },
  { key: "inicio", kind: "yearMonthRange", label: "Inicio" },
  {
    columnId: "lenderName",
    key: "direccion",
    kind: "enum",
    label: "Dirección",
    options: [
      { label: "Yo debo", slug: "yo-debo", value: "payable" },
      { label: "Me deben", slug: "me-deben", value: "receivable" },
      { label: "Sin deuda", slug: "sin-deuda", value: "none" },
    ],
  },
  { columnId: "loanProgress", key: "deuda", kind: "presence", label: "Deuda / cuotas" },
  {
    columnId: "loanInstallmentRange",
    key: "vigencia",
    kind: "yearMonthRange",
    label: "Vigencia",
  },
  { key: "link", kind: "textMatch", label: "Link de pago" },
  { key: "prestamista", kind: "textMatch", label: "Prestamista" },
  {
    key: "carpeta",
    kind: "folder",
    label: "Carpeta",
    options: [
      { label: "Sin carpeta", slug: "sin-carpeta", value: "__unassigned__" },
      { label: "Hogar", slug: "hogar", value: "folder-1" },
      { label: "Viajes", slug: "viajes", value: "folder-2" },
    ],
  },
];

describe("tokenizeFilterQuery", () => {
  it("splits plain words preserving indices", () => {
    const tokens = tokenizeFilterQuery("luz agua");

    expect(tokens).toHaveLength(2);
    expect(tokens[0]).toMatchObject({ raw: "luz", startIndex: 0, endIndex: 3 });
    expect(tokens[1]).toMatchObject({ raw: "agua", startIndex: 4, endIndex: 8 });
  });

  it("keeps quoted values with spaces as a single token", () => {
    const tokens = tokenizeFilterQuery('"super mercado"');

    expect(tokens).toHaveLength(1);
    expect(tokens[0].value).toBe("super mercado");
    expect(tokens[0].hasColon).toBe(false);
  });

  it("parses key:value tokens and negation", () => {
    const tokens = tokenizeFilterQuery("subtotal:>100 -luz");

    expect(tokens[0]).toMatchObject({
      hasColon: true,
      negated: false,
      rawKey: "subtotal",
      value: ">100",
    });
    expect(tokens[1]).toMatchObject({ negated: true, value: "luz", hasColon: false });
  });

  it("treats a value-leading quote as free text, not a qualifier", () => {
    const tokens = tokenizeFilterQuery('"a:b"');

    expect(tokens[0].hasColon).toBe(false);
    expect(tokens[0].value).toBe("a:b");
  });
});

describe("parseFilterQuery", () => {
  it("collects free text into the description filter", () => {
    const parsed = parseFilterQuery("luz agua", CONFIGS);

    expect(parsed.descriptionFilter).toBe("luz agua");
    expect(parsed.excludedDescriptionFilters).toEqual([]);
  });

  it("collects negated text into exclusions", () => {
    const parsed = parseFilterQuery("-luz -\"super mercado\"", CONFIGS);

    expect(parsed.excludedDescriptionFilters).toEqual(["luz", "super mercado"]);
    expect(parsed.descriptionFilter).toBe("");
  });

  it("parses numeric comparators inclusively", () => {
    expect(parseFilterQuery("subtotal:>100", CONFIGS).advancedFiltersByColumn).toEqual({
      subtotal: { kind: "numberRange", min: 100 },
    });
    expect(parseFilterQuery("subtotal:>=100", CONFIGS).advancedFiltersByColumn).toEqual({
      subtotal: { kind: "numberRange", min: 100 },
    });
    expect(parseFilterQuery("subtotal:<=500", CONFIGS).advancedFiltersByColumn).toEqual({
      subtotal: { kind: "numberRange", max: 500 },
    });
    expect(parseFilterQuery("subtotal:=100", CONFIGS).advancedFiltersByColumn).toEqual({
      subtotal: { kind: "numberRange", max: 100, min: 100 },
    });
  });

  it("parses numeric ranges", () => {
    expect(parseFilterQuery("subtotal:100..500", CONFIGS).advancedFiltersByColumn).toEqual({
      subtotal: { kind: "numberRange", max: 500, min: 100 },
    });
    expect(parseFilterQuery("subtotal:100..", CONFIGS).advancedFiltersByColumn).toEqual({
      subtotal: { kind: "numberRange", min: 100 },
    });
    expect(parseFilterQuery("subtotal:..500", CONFIGS).advancedFiltersByColumn).toEqual({
      subtotal: { kind: "numberRange", max: 500 },
    });
  });

  it("merges two numeric qualifiers of the same key into a range", () => {
    const parsed = parseFilterQuery("subtotal:>100 subtotal:<500", CONFIGS);

    expect(parsed.advancedFiltersByColumn).toEqual({
      subtotal: { kind: "numberRange", max: 500, min: 100 },
    });
  });

  it("intersects repeated range qualifiers with the same bound direction", () => {
    expect(
      parseFilterQuery("total:<300 total:<500", CONFIGS).advancedFiltersByColumn,
    ).toEqual({ total: { kind: "numberRange", max: 300 } });
    expect(
      parseFilterQuery("total:>200 total:>100", CONFIGS).advancedFiltersByColumn,
    ).toEqual({ total: { kind: "numberRange", min: 200 } });
  });

  it("parses enum and presence values", () => {
    expect(parseFilterQuery("direccion:me-deben", CONFIGS).advancedFiltersByColumn).toEqual({
      lenderName: { kind: "enum", value: "receivable" },
    });
    expect(parseFilterQuery("deuda:si", CONFIGS).advancedFiltersByColumn).toEqual({
      loanProgress: { kind: "presence", value: "hasValue" },
    });
    expect(parseFilterQuery("deuda:no", CONFIGS).advancedFiltersByColumn).toEqual({
      loanProgress: { kind: "presence", value: "noValue" },
    });
  });

  it("parses year-month ranges and presence slugs", () => {
    expect(parseFilterQuery("vigencia:2026-06..2026-12", CONFIGS).advancedFiltersByColumn).toEqual({
      loanInstallmentRange: { kind: "yearMonthRange", max: 202612, min: 202606, mode: "range" },
    });
    expect(parseFilterQuery("vigencia:sin-fechas", CONFIGS).advancedFiltersByColumn).toEqual({
      loanInstallmentRange: { kind: "yearMonthRange", mode: "noValue" },
    });
    expect(parseFilterQuery("vigencia:2026-06", CONFIGS).advancedFiltersByColumn).toEqual({
      loanInstallmentRange: { kind: "yearMonthRange", max: 202606, min: 202606, mode: "range" },
    });
  });

  it("treats unknown keys as free text and reports them", () => {
    const parsed = parseFilterQuery("foo:bar", CONFIGS);

    expect(parsed.descriptionFilter).toBe("foo:bar");
    expect(parsed.invalidTokens).toEqual([{ raw: "foo:bar", reason: "unknownKey" }]);
  });

  it("ignores invalid values but reports them", () => {
    const parsed = parseFilterQuery("subtotal:abc vigencia:2026-13", CONFIGS);

    expect(parsed.advancedFiltersByColumn).toEqual({});
    expect(parsed.invalidTokens).toEqual([
      { raw: "subtotal:abc", reason: "invalidValue" },
      { raw: "vigencia:2026-13", reason: "invalidValue" },
    ]);
  });

  it("rejects an inverted numeric range as invalid", () => {
    const parsed = parseFilterQuery("total:100..50", CONFIGS);

    expect(parsed.advancedFiltersByColumn).toEqual({});
    expect(parsed.invalidTokens).toEqual([
      { raw: "total:100..50", reason: "invalidValue" },
    ]);
  });

  it("rejects a merged range that becomes inverted, keeping the first bound", () => {
    const parsed = parseFilterQuery("total:>100 total:<50", CONFIGS);

    expect(parsed.advancedFiltersByColumn).toEqual({
      total: { kind: "numberRange", min: 100 },
    });
    expect(parsed.invalidTokens).toEqual([
      { raw: "total:<50", reason: "invalidValue" },
    ]);
  });

  it("rejects an inverted year-month range", () => {
    const parsed = parseFilterQuery("vigencia:2026-12..2026-06", CONFIGS);

    expect(parsed.advancedFiltersByColumn).toEqual({});
    expect(parsed.invalidTokens).toEqual([
      { raw: "vigencia:2026-12..2026-06", reason: "invalidValue" },
    ]);
  });

  it("deduplicates exclusions by their normalized form", () => {
    const parsed = parseFilterQuery("-Agua -agua -água", CONFIGS);

    expect(parsed.excludedDescriptionFilters).toEqual(["Agua"]);
  });

  it("merges repeated year-month bounds into a range instead of replacing", () => {
    const merged = parseFilterQuery("inicio:2026-01.. inicio:..2026-06", CONFIGS);
    expect(merged.appliedFilters).toEqual([
      {
        key: "inicio",
        negated: false,
        value: { kind: "yearMonthRange", max: 202606, min: 202601, mode: "range" },
      },
    ]);

    const impossible = parseFilterQuery("inicio:2026-12.. inicio:..2026-06", CONFIGS);
    expect(impossible.appliedFilters).toEqual([
      {
        key: "inicio",
        negated: false,
        value: { kind: "yearMonthRange", min: 202612, mode: "from" },
      },
    ]);
    expect(impossible.invalidTokens).toEqual([
      { raw: "inicio:..2026-06", reason: "invalidValue" },
    ]);
  });

  it("merges and validates repeated ranges for column-less qualifiers", () => {
    const valid = parseFilterQuery("saldo:>100 saldo:<500", CONFIGS);
    expect(valid.appliedFilters).toEqual([
      { key: "saldo", negated: false, value: { kind: "numberRange", max: 500, min: 100 } },
    ]);
    expect(valid.advancedFiltersByColumn).toEqual({});

    const impossible = parseFilterQuery("saldo:>1000 saldo:<50", CONFIGS);
    expect(impossible.appliedFilters).toEqual([
      { key: "saldo", negated: false, value: { kind: "numberRange", min: 1000 } },
    ]);
    expect(impossible.invalidTokens).toEqual([
      { raw: "saldo:<50", reason: "invalidValue" },
    ]);
  });

  it("applies negated qualifiers through appliedFilters, not the column map", () => {
    const parsed = parseFilterQuery("-direccion:yo-debo", CONFIGS);

    expect(parsed.advancedFiltersByColumn).toEqual({});
    expect(parsed.excludedDescriptionFilters).toEqual([]);
    expect(parsed.appliedFilters).toEqual([
      { key: "direccion", negated: true, value: { kind: "enum", value: "payable" } },
    ]);
  });

  it("parses textMatch operators (presence, prefix, suffix, equals, contains)", () => {
    expect(parseFilterQuery("link:si", CONFIGS).appliedFilters).toEqual([
      { key: "link", negated: false, value: { kind: "textMatch", op: "has" } },
    ]);
    expect(parseFilterQuery("link:no", CONFIGS).appliedFilters).toEqual([
      { key: "link", negated: false, value: { kind: "textMatch", op: "notHas" } },
    ]);
    expect(parseFilterQuery("link:^https", CONFIGS).appliedFilters).toEqual([
      {
        key: "link",
        negated: false,
        value: { kind: "textMatch", op: "startsWith", text: "https" },
      },
    ]);
    expect(parseFilterQuery("link:pdf$", CONFIGS).appliedFilters).toEqual([
      {
        key: "link",
        negated: false,
        value: { kind: "textMatch", op: "endsWith", text: "pdf" },
      },
    ]);
    expect(parseFilterQuery("prestamista:=Juan", CONFIGS).appliedFilters).toEqual([
      {
        key: "prestamista",
        negated: false,
        value: { kind: "textMatch", op: "equals", text: "juan" },
      },
    ]);
    expect(parseFilterQuery("prestamista:juan", CONFIGS).appliedFilters).toEqual([
      {
        key: "prestamista",
        negated: false,
        value: { kind: "textMatch", op: "contains", text: "juan" },
      },
    ]);
  });

  it("parses folder qualifiers (include, exclude, unassigned)", () => {
    expect(
      parseFilterQuery("carpeta:hogar carpeta:viajes", CONFIGS).appliedFilters,
    ).toEqual([
      { key: "carpeta", negated: false, value: { kind: "folder", folderId: "folder-1" } },
      { key: "carpeta", negated: false, value: { kind: "folder", folderId: "folder-2" } },
    ]);
    expect(parseFilterQuery("-carpeta:hogar", CONFIGS).appliedFilters).toEqual([
      { key: "carpeta", negated: true, value: { kind: "folder", folderId: "folder-1" } },
    ]);
    expect(parseFilterQuery("carpeta:sin-carpeta", CONFIGS).appliedFilters).toEqual([
      {
        key: "carpeta",
        negated: false,
        value: { kind: "folder", folderId: "__unassigned__" },
      },
    ]);
  });

  it("reports unknown folder slugs as invalid values", () => {
    const parsed = parseFilterQuery("carpeta:noexiste", CONFIGS);

    expect(parsed.appliedFilters).toEqual([]);
    expect(parsed.invalidTokens).toEqual([
      { raw: "carpeta:noexiste", reason: "invalidValue" },
    ]);
  });

  it("ignores incomplete qualifiers while typing", () => {
    const parsed = parseFilterQuery("subtotal: direccion:", CONFIGS);

    expect(parsed.advancedFiltersByColumn).toEqual({});
    expect(parsed.invalidTokens).toEqual([]);
  });
});

describe("serializeFilterQuery", () => {
  it("round-trips a mixed query into a canonical form", () => {
    const query = "luz subtotal:100..500 direccion:me-deben deuda:si vigencia:sin-fechas -agua";
    const parsed = parseFilterQuery(query, CONFIGS);

    expect(serializeFilterQuery(parsed, CONFIGS)).toBe(
      "luz subtotal:100..500 direccion:me-deben deuda:si vigencia:sin-fechas -agua",
    );
  });

  it("serializes single-bound numeric ranges and equality", () => {
    expect(
      serializeFilterQuery(parseFilterQuery("subtotal:>100", CONFIGS), CONFIGS),
    ).toBe("subtotal:>=100");
    expect(
      serializeFilterQuery(parseFilterQuery("subtotal:=100", CONFIGS), CONFIGS),
    ).toBe("subtotal:=100");
  });

  it("quotes excluded values that contain spaces", () => {
    const parsed = parseFilterQuery('-"super mercado"', CONFIGS);

    expect(serializeFilterQuery(parsed, CONFIGS)).toBe('-"super mercado"');
  });

  it("round-trips textMatch, folder and negated qualifiers", () => {
    const query = "link:^https -carpeta:hogar prestamista:juan direccion:me-deben";
    const parsed = parseFilterQuery(query, CONFIGS);

    expect(serializeFilterQuery(parsed, CONFIGS)).toBe(
      "direccion:me-deben link:^https -carpeta:hogar prestamista:juan",
    );
  });

  it("quotes free-text description words that look like qualifiers (lossless)", () => {
    const parsed = {
      advancedFiltersByColumn: {},
      appliedFilters: [],
      descriptionFilter: "total:100 luz",
      excludedDescriptionFilters: [],
      invalidTokens: [],
    };
    const serialized = serializeFilterQuery(parsed, CONFIGS);

    expect(serialized).toBe('"total:100" luz');
    // Re-parsing must keep it as a description filter, not an advanced filter.
    const reparsed = parseFilterQuery(serialized, CONFIGS);
    expect(reparsed.descriptionFilter).toBe("total:100 luz");
    expect(reparsed.advancedFiltersByColumn).toEqual({});
  });

  it("quotes excluded values that look like qualifiers", () => {
    const parsed = {
      advancedFiltersByColumn: {},
      appliedFilters: [],
      descriptionFilter: "",
      excludedDescriptionFilters: ["total:100"],
      invalidTokens: [],
    };
    const serialized = serializeFilterQuery(parsed, CONFIGS);

    expect(serialized).toBe('-"total:100"');
    expect(parseFilterQuery(serialized, CONFIGS).excludedDescriptionFilters).toEqual([
      "total:100",
    ]);
  });
});

describe("parseYearMonthSlug", () => {
  it("accepts valid year-month and rejects invalid months", () => {
    expect(parseYearMonthSlug("2026-06")).toBe(202606);
    expect(parseYearMonthSlug("2026-13")).toBeNull();
    expect(parseYearMonthSlug("nope")).toBeNull();
  });
});

describe("getActiveFilterToken", () => {
  it("returns key mode while typing a bare word", () => {
    const active = getActiveFilterToken("sub", 3);

    expect(active.mode).toBe("key");
    expect(active.keyPart).toBe("sub");
    expect(active).toMatchObject({ replaceStart: 0, replaceEnd: 3 });
  });

  it("returns value mode after a colon and replaces only the value", () => {
    const query = "subtotal:>1";
    const active = getActiveFilterToken(query, query.length);

    expect(active.mode).toBe("value");
    expect(active.resolvedKey).toBe("subtotal");
    expect(active.valuePart).toBe(">1");
    expect(query.slice(active.replaceStart, active.replaceEnd)).toBe(">1");
  });

  it("returns key mode at a caret sitting on whitespace", () => {
    const active = getActiveFilterToken("luz ", 4);

    expect(active.mode).toBe("key");
    expect(active.keyPart).toBe("");
  });

  it("tracks negation for the active token", () => {
    const active = getActiveFilterToken("-vigencia:", 10);

    expect(active.negated).toBe(true);
    expect(active.resolvedKey).toBe("vigencia");
  });
});
