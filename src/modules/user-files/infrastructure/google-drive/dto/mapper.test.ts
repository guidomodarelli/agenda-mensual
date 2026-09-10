import { describe, it, expect } from "vitest";
import { mapGoogleDriveUserFileDtoToDomain } from "./mapper";

describe("mapGoogleDriveUserFileDtoToDomain", () => {
  it("maps a Google Drive user file DTO into the internal domain model", () => {
    const result = mapGoogleDriveUserFileDtoToDomain({
      id: "user-file-id",
      mimeType: "text/csv",
      name: "expenses.csv",
      webViewLink: "https://drive.google.com/file/d/user-file-id/view",
    });

    expect(result).toEqual({
      id: "user-file-id",
      mimeType: "text/csv",
      name: "expenses.csv",
      viewUrl: "https://drive.google.com/file/d/user-file-id/view",
    });
  });

  it("throws a precise error when required fields are missing", () => {
    expect(() =>
      mapGoogleDriveUserFileDtoToDomain({
        name: "invalid-user-file",
      }),
    ).toThrow(
      "Cannot map a Google Drive user file DTO without id, name, and mimeType.",
    );
  });
});
