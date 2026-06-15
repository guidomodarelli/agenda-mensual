import { createExpenseFoldersCatalogDocument } from "./expense-folders-catalog-document";

describe("expenseFoldersCatalogDocument", () => {
  it("normalizes folders and sorts them by position then name", () => {
    const result = createExpenseFoldersCatalogDocument(
      {
        folders: [
          {
            color: "blue",
            icon: "home",
            id: "folder-2",
            name: "  Hogar  ",
            position: 1,
          },
          {
            id: "folder-1",
            name: "Servicios",
            position: 0,
          },
        ],
      },
      "Saving expense folders catalog",
    );

    expect(result).toEqual({
      folders: [
        {
          color: null,
          icon: null,
          id: "folder-1",
          name: "Servicios",
          position: 0,
        },
        {
          color: "blue",
          icon: "home",
          id: "folder-2",
          name: "Hogar",
          position: 1,
        },
      ],
    });
  });

  it("assigns a fallback position based on the input order", () => {
    const result = createExpenseFoldersCatalogDocument(
      {
        folders: [
          { id: "folder-a", name: "A" },
          { id: "folder-b", name: "B" },
        ],
      },
      "Saving expense folders catalog",
    );

    expect(result.folders.map((folder) => folder.position)).toEqual([0, 1]);
  });

  it("rejects duplicate folder names", () => {
    expect(() =>
      createExpenseFoldersCatalogDocument(
        {
          folders: [
            { id: "folder-1", name: "Hogar" },
            { id: "folder-2", name: " hogar " },
          ],
        },
        "Saving expense folders catalog",
      ),
    ).toThrow("Saving expense folders catalog requires folder names to be unique.");
  });

  it("rejects unsupported color tokens", () => {
    expect(() =>
      createExpenseFoldersCatalogDocument(
        {
          folders: [
            {
              color: "rainbow" as never,
              id: "folder-1",
              name: "Hogar",
            },
          ],
        },
        "Saving expense folders catalog",
      ),
    ).toThrow(
      "Saving expense folders catalog requires every folder color to be one of the supported palette tokens.",
    );
  });

  it("rejects unsupported icon keys", () => {
    expect(() =>
      createExpenseFoldersCatalogDocument(
        {
          folders: [
            {
              icon: "spaceship" as never,
              id: "folder-1",
              name: "Hogar",
            },
          ],
        },
        "Saving expense folders catalog",
      ),
    ).toThrow(
      "Saving expense folders catalog requires every folder icon to be one of the supported icon keys.",
    );
  });
});
