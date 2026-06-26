import type { ExpenseFolderOption } from "./expense-folder-picker";
import type { LenderOption } from "./lender-picker";
import {
  buildMonthlyExpensesFilterQualifiers,
  slugifyLenderName,
} from "./monthly-expenses-filter-qualifiers";

const EXPENSE_FOLDERS: ExpenseFolderOption[] = [
  { color: "blue", icon: "home", id: "folder-1", name: "Hogar" },
  { color: "violet", icon: "card", id: "folder-2", name: "Tarjeta" },
];

const LENDERS: LenderOption[] = [
  { id: "lender-1", name: "Vero Hadad", type: "family" },
  { id: "lender-2", name: "Banco Galicia", type: "bank" },
];

function buildQualifiers() {
  return buildMonthlyExpensesFilterQualifiers({
    expenseFolders: EXPENSE_FOLDERS,
    lenders: LENDERS,
  });
}

describe("buildMonthlyExpensesFilterQualifiers", () => {
  it("prepends the free-text description qualifier", () => {
    const [first] = buildQualifiers();

    expect(first).toEqual({ key: "", kind: "text", label: "Descripción" });
  });

  it("exposes the full catalog including column-less qualifiers", () => {
    const keys = buildQualifiers().map((qualifier) => qualifier.key);

    // La presencia se unifica en las meta-claves `tiene:`/`no:`, así que ya no
    // existe el qualifier `enviado` duplicado junto a `enviados`.
    expect(keys).not.toContain("enviado");

    for (const key of [
      "subtotal",
      "total",
      "usd",
      "pagos",
      "registros",
      "enviados",
      "cuotas-pagadas",
      "cuotas-restantes",
      "cuotas-total",
      "link",
      "prestamista",
      "direccion",
      "deuda",
      "inicio",
      "fin",
      "carpeta",
    ]) {
      expect(keys).toContain(key);
    }
  });

  it("uses the right kinds for the new text and folder qualifiers", () => {
    const byKey = new Map(
      buildQualifiers().map((qualifier) => [qualifier.key, qualifier]),
    );

    expect(byKey.get("link")?.kind).toBe("textMatch");
    expect(byKey.get("prestamista")?.kind).toBe("enum");
    expect(byKey.get("carpeta")?.kind).toBe("folder");
    expect(byKey.get("subtotal")?.kind).toBe("numberRange");
    expect(byKey.get("subtotal")?.columnId).toBeUndefined();
  });

  it("builds prestamista options from the loaded lenders with a person icon", () => {
    const prestamista = buildQualifiers().find(
      (qualifier) => qualifier.key === "prestamista",
    );

    expect(prestamista?.iconName).toBe("user");
    expect(prestamista?.options).toEqual([
      { label: "Vero Hadad", slug: "vero-hadad", value: "lender-1" },
      { label: "Banco Galicia", slug: "banco-galicia", value: "lender-2" },
    ]);
  });

  it("builds folder options from existing folders only", () => {
    const carpeta = buildQualifiers().find(
      (qualifier) => qualifier.key === "carpeta",
    );

    expect(carpeta?.options).toEqual([
      { label: "Hogar", slug: "hogar", value: "folder-1" },
      { label: "Tarjeta", slug: "tarjeta", value: "folder-2" },
    ]);
  });

  it("slugifies multi-word folder names into a single token", () => {
    const carpeta = buildMonthlyExpensesFilterQualifiers({
      expenseFolders: [
        { color: "violet", icon: "card", id: "folder-3", name: "Tarjeta Visa" },
      ],
      lenders: [],
    }).find((qualifier) => qualifier.key === "carpeta");
    const visaOption = carpeta?.options?.find(
      (option) => option.value === "folder-3",
    );

    expect(visaOption?.slug).toBe("tarjeta-visa");
    expect(visaOption?.slug).not.toMatch(/\s/);
  });

  it("disambiguates colliding folder slugs stably per id (order-independent)", () => {
    const folders = [
      { color: "blue" as const, icon: "home" as const, id: "folder-a", name: "Hogar" },
      { color: "teal" as const, icon: "home" as const, id: "folder-b", name: "Hógar" },
    ];
    const slugByValue = (expenseFolders: typeof folders) => {
      const carpeta = buildMonthlyExpensesFilterQualifiers({
        expenseFolders,
        lenders: [],
      }).find((qualifier) => qualifier.key === "carpeta");
      const slugs = (carpeta?.options ?? []).map((option) => option.slug);
      expect(new Set(slugs).size).toBe(slugs.length); // todos únicos
      return new Map(
        (carpeta?.options ?? []).map((option) => [option.value, option.slug]),
      );
    };

    const direct = slugByValue(folders);
    expect(direct.get("folder-a")).toBe("hogar-folder-a");
    expect(direct.get("folder-b")).toBe("hogar-folder-b");

    // Reordenar las carpetas NO cambia el slug que resuelve cada id.
    const reordered = slugByValue([folders[1], folders[0]]);
    expect(reordered.get("folder-a")).toBe(direct.get("folder-a"));
    expect(reordered.get("folder-b")).toBe(direct.get("folder-b"));
  });

  it("guarantees unique final slugs when an id-suffixed slug hits another base", () => {
    // "Hogar"/"Hógar" colisionan -> "hogar-a"/"hogar-b"; una tercera carpeta
    // llamada "Hogar a" tiene base "hogar-a", que ya está tomado -> debe deduparse.
    const carpeta = buildMonthlyExpensesFilterQualifiers({
      expenseFolders: [
        { color: "blue" as const, icon: "home" as const, id: "a", name: "Hogar" },
        { color: "teal" as const, icon: "home" as const, id: "b", name: "Hógar" },
        { color: "red" as const, icon: "home" as const, id: "c", name: "Hogar a" },
      ],
      lenders: [],
    }).find((qualifier) => qualifier.key === "carpeta");

    const slugs = (carpeta?.options ?? []).map((option) => option.slug);
    expect(new Set(slugs).size).toBe(slugs.length); // todos únicos
    const byValue = new Map(
      (carpeta?.options ?? []).map((option) => [option.value, option.slug]),
    );
    expect(byValue.get("a")).toBe("hogar-a");
    expect(byValue.get("c")).not.toBe("hogar-a");
  });

  it("resolves slug collisions identically regardless of entity list order", () => {
    // Reproduce el escenario del comentario #3456959620: "Hogar"/"Hógar" colisionan
    // en el slug base y producen el candidato "hogar-a" (id de "Hogar a"), mientras
    // que "Hogar a" tiene ese mismo slug como base. El slug asignado a cada id no
    // debe cambiar si se reordena la lista.
    const folders = [
      { color: "blue" as const, icon: "home" as const, id: "hogar-a", name: "Hogar a" },
      { color: "teal" as const, icon: "home" as const, id: "1", name: "Hogar" },
      { color: "red" as const, icon: "home" as const, id: "2", name: "Hógar" },
    ];

    const slugsByValue = (expenseFolders: typeof folders) => {
      const carpeta = buildMonthlyExpensesFilterQualifiers({
        expenseFolders,
        lenders: [],
      }).find((qualifier) => qualifier.key === "carpeta");
      const slugs = (carpeta?.options ?? []).map((option) => option.slug);
      expect(new Set(slugs).size).toBe(slugs.length); // todos únicos
      return new Map(
        (carpeta?.options ?? []).map((option) => [option.value, option.slug]),
      );
    };

    const direct = slugsByValue(folders);
    // Reordenar no cambia la asignación slug→id
    const reversed = slugsByValue([...folders].reverse());
    expect(reversed.get("hogar-a")).toBe(direct.get("hogar-a"));
    expect(reversed.get("1")).toBe(direct.get("1"));
    expect(reversed.get("2")).toBe(direct.get("2"));
  });

  it("derives direction enum options with typeable slugs", () => {
    const direction = buildQualifiers().find(
      (qualifier) => qualifier.key === "direccion",
    );

    expect(direction?.options).toEqual([
      { label: "Yo debo", slug: "yo-debo", value: "payable" },
      { label: "Me deben", slug: "me-deben", value: "receivable" },
    ]);
  });

  it("strips single and double quotes from lender slugs to avoid tokenizer issues", () => {
    // Un prestamista con apóstrofe produciría un slug con `'` que el tokenizer
    // interpreta como inicio de segmento entrecomillado, invalidando tokens posteriores.
    expect(slugifyLenderName("O'Connor")).toBe("oconnor");
    expect(slugifyLenderName('D"Angelo')).toBe("dangelo");
    expect(slugifyLenderName("Banco O'Brien SA")).toBe("banco-obrien-sa");
  });

  it("uses textMatch kind for prestamista when the lender catalog is empty", () => {
    // Si el catálogo de prestamistas falla al cargar o está vacío, el qualifier
    // debe caer a textMatch para que el usuario igual pueda filtrar por nombre visible.
    const prestamista = buildMonthlyExpensesFilterQualifiers({
      expenseFolders: [],
      lenders: [],
    }).find((qualifier) => qualifier.key === "prestamista");

    expect(prestamista?.kind).toBe("textMatch");
    expect(prestamista?.iconName).toBe("user");
    expect(prestamista?.options).toBeUndefined();
  });

  it("uses enum kind for prestamista when the lender catalog has entries", () => {
    // Confirma que la rama enum sigue activa cuando hay lenders cargados.
    const prestamista = buildQualifiers().find(
      (qualifier) => qualifier.key === "prestamista",
    );

    expect(prestamista?.kind).toBe("enum");
  });
});
