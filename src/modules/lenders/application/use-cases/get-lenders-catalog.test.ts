import { vi, describe, it, expect } from "vitest";
import type { LendersRepository } from "../../domain/repositories/lenders-repository";
import { getLendersCatalog } from "./get-lenders-catalog";

describe("getLendersCatalog", () => {
  it("returns an empty catalog when Drive has no lenders file", async () => {
    const repository: LendersRepository = {
      get: vi.fn().mockResolvedValue(null),
      save: vi.fn(),
    };

    const result = await getLendersCatalog({
      repository,
    });

    expect(result).toEqual({
      lenders: [],
    });
  });
});
