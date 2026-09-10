import { vi, describe, it, expect } from "vitest";
import type { UserFilesRepository } from "../../domain/repositories/user-files-repository";
import { saveUserFile } from "./save-user-file";

describe("saveUserFile", () => {
  it("delegates a validated user file to the repository", async () => {
    const repository: UserFilesRepository = {
      save: vi.fn().mockResolvedValue({
        id: "user-file-id",
        mimeType: "text/csv",
        name: "expenses.csv",
        viewUrl: "https://drive.google.com/file/d/user-file-id/view",
      }),
    };

    const result = await saveUserFile({
      command: {
        content: "date,amount\n2026-03-08,32.5",
        mimeType: "text/csv",
        name: "expenses.csv",
      },
      repository,
    });

    expect(repository.save).toHaveBeenCalledWith({
      content: "date,amount\n2026-03-08,32.5",
      mimeType: "text/csv",
      name: "expenses.csv",
    });
    expect(result).toEqual({
      id: "user-file-id",
      mimeType: "text/csv",
      name: "expenses.csv",
      viewUrl: "https://drive.google.com/file/d/user-file-id/view",
    });
  });
});
