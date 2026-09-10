import { describe, it, expect } from "vitest";
import { mapGoogleDriveSettingsFileDtoToDomain } from "./mapper";

describe("mapGoogleDriveSettingsFileDtoToDomain", () => {
  it("maps a Google Drive settings DTO into the internal domain model", () => {
    const result = mapGoogleDriveSettingsFileDtoToDomain({
      id: "settings-id",
      mimeType: "application/json",
      name: "application-settings.json",
    });

    expect(result).toEqual({
      id: "settings-id",
      mimeType: "application/json",
      name: "application-settings.json",
    });
  });

  it("throws a precise error when required fields are missing", () => {
    expect(() =>
      mapGoogleDriveSettingsFileDtoToDomain({
        name: "invalid-settings-file",
      }),
    ).toThrow(
      "Cannot map a Google Drive settings DTO without id, name, and mimeType.",
    );
  });
});
