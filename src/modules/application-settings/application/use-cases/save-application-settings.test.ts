import { vi, describe, it, expect } from "vitest";
import type { ApplicationSettingsRepository } from "../../domain/repositories/application-settings-repository";
import { saveApplicationSettings } from "./save-application-settings";

describe("saveApplicationSettings", () => {
  it("delegates a validated settings document to the repository", async () => {
    const repository: ApplicationSettingsRepository = {
      save: vi.fn().mockResolvedValue({
        id: "settings-file-id",
        mimeType: "application/json",
        name: "application-settings.json",
      }),
    };

    const result = await saveApplicationSettings({
      command: {
        content: "{\"theme\":\"dark\"}",
        mimeType: "application/json",
        name: "application-settings.json",
      },
      repository,
    });

    expect(repository.save).toHaveBeenCalledWith({
      content: "{\"theme\":\"dark\"}",
      mimeType: "application/json",
      name: "application-settings.json",
    });
    expect(result).toEqual({
      id: "settings-file-id",
      mimeType: "application/json",
      name: "application-settings.json",
    });
  });

  it("rejects an empty name before touching the repository", async () => {
    const repository: ApplicationSettingsRepository = {
      save: vi.fn(),
    };

    await expect(
      saveApplicationSettings({
        command: {
          content: "{\"theme\":\"dark\"}",
          mimeType: "application/json",
          name: "   ",
        },
        repository,
      }),
    ).rejects.toThrow(
      "Saving application settings requires a non-empty file name.",
    );

    expect(repository.save).not.toHaveBeenCalled();
  });
});
