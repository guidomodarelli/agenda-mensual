import type { LendersRepository } from "../../domain/repositories/lenders-repository";
import { saveLendersCatalog } from "./save-lenders-catalog";

describe("saveLendersCatalog", () => {
  it("delegates a validated lenders catalog to the repository", async () => {
    const repository: LendersRepository = {
      get: jest.fn(),
      save: jest.fn().mockResolvedValue({
        id: "lenders-file-id",
        name: "lenders-catalog",
      }),
    };

    const result = await saveLendersCatalog({
      command: {
        lenders: [
          {
            id: "lender-1",
            name: "Banco Galicia",
            type: "bank",
          },
        ],
      },
      repository,
    });

    expect(repository.save).toHaveBeenCalledWith({
      lenders: [
        {
          id: "lender-1",
          name: "Banco Galicia",
          type: "bank",
        },
      ],
    });
    expect(result).toEqual({
      id: "lenders-file-id",
      name: "lenders-catalog",
    });
  });
});
