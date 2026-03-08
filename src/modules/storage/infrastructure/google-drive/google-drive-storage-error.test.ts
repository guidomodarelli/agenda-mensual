import { GaxiosError } from "gaxios";

import {
  GoogleDriveStorageError,
  mapGoogleDriveStorageError,
} from "./google-drive-storage-error";

function createGoogleDriveApiError({
  apiStatus,
  httpStatus,
  message,
}: {
  apiStatus: string;
  httpStatus: number;
  message: string;
}) {
  const error = new GaxiosError(message, {} as never);

  error.response = {
    data: {
      error: {
        code: httpStatus,
        message,
        status: apiStatus,
      },
    },
    status: httpStatus,
  } as never;
  error.status = httpStatus;

  return error;
}

describe("mapGoogleDriveStorageError", () => {
  it("classifies disabled Drive API responses", () => {
    const result = mapGoogleDriveStorageError(
      createGoogleDriveApiError({
        apiStatus: "SERVICE_DISABLED",
        httpStatus: 403,
        message:
          "Google Drive API has not been used in project 588890487054 before or it is disabled.",
      }),
      {
        endpoint: "drive.files.create",
        operation: "google-drive-user-files-repository:save",
      },
    );

    expect(result).toBeInstanceOf(GoogleDriveStorageError);
    expect(result.code).toBe("api_disabled");
    expect(result.httpStatus).toBe(403);
  });

  it("classifies insufficient scope responses", () => {
    const result = mapGoogleDriveStorageError(
      createGoogleDriveApiError({
        apiStatus: "PERMISSION_DENIED",
        httpStatus: 403,
        message: "Request had insufficient authentication scopes.",
      }),
      {
        endpoint: "drive.files.create",
        operation: "google-drive-user-files-repository:save",
      },
    );

    expect(result.code).toBe("invalid_scope");
  });

  it("classifies invalid payload responses", () => {
    const result = mapGoogleDriveStorageError(
      createGoogleDriveApiError({
        apiStatus: "INVALID_ARGUMENT",
        httpStatus: 400,
        message: "Invalid Value",
      }),
      {
        endpoint: "drive.files.create",
        operation: "google-drive-user-files-repository:save",
      },
    );

    expect(result.code).toBe("invalid_payload");
  });

  it("falls back to an unexpected classification for unknown errors", () => {
    const result = mapGoogleDriveStorageError(new Error("boom"), {
      endpoint: "drive.files.create",
      operation: "google-drive-user-files-repository:save",
    });

    expect(result.code).toBe("unexpected");
    expect(result.message).toContain(
      "google-drive-user-files-repository:save failed while calling drive.files.create",
    );
  });
});
