import { vi, describe, it, expect } from "vitest";
import type { drive_v3 } from "googleapis";

import { VISIBLE_DRIVE_FOLDER_NAME } from "@/modules/storage/shared/visible-drive-folder-name";

import { GoogleDriveUserFilesRepository } from "./google-drive-user-files-repository";

function createDriveClientMock() {
  const files = {
    create: vi.fn(),
    list: vi.fn(),
  };

  return {
    driveClient: {
      files,
    } as unknown as drive_v3.Drive,
    files,
  };
}

describe("GoogleDriveUserFilesRepository", () => {
  it("creates the visible Drive folder and stores user files inside it", async () => {
    const { driveClient, files } = createDriveClientMock();

    files.list
      .mockResolvedValueOnce({
        data: {
          files: [],
        },
      })
      .mockResolvedValueOnce({
        data: {
          files: [],
        },
      });
    files.create
      .mockResolvedValueOnce({
        data: {
          id: "visible-folder-id",
          mimeType: "application/vnd.google-apps.folder",
          name: VISIBLE_DRIVE_FOLDER_NAME,
        },
      })
      .mockResolvedValueOnce({
        data: {
          id: "user-file-id",
          mimeType: "text/csv",
          name: "expenses.csv",
          webViewLink: "https://drive.google.com/file/d/user-file-id/view",
        },
      });

    const repository = new GoogleDriveUserFilesRepository(driveClient);

    const result = await repository.save({
      content: "date,amount\n2026-03-08,32.5",
      mimeType: "text/csv",
      name: "expenses.csv",
    });

    expect(files.create).toHaveBeenNthCalledWith(1, {
      fields: "id,name,mimeType",
      requestBody: {
        mimeType: "application/vnd.google-apps.folder",
        name: VISIBLE_DRIVE_FOLDER_NAME,
      },
    });
    expect(files.create).toHaveBeenNthCalledWith(2, {
      fields: "id,name,mimeType,webViewLink",
      media: {
        body: "date,amount\n2026-03-08,32.5",
        mimeType: "text/csv",
      },
      requestBody: {
        name: "expenses.csv",
        parents: ["visible-folder-id"],
      },
    });
    expect(result).toEqual({
      id: "user-file-id",
      mimeType: "text/csv",
      name: "expenses.csv",
      viewUrl: "https://drive.google.com/file/d/user-file-id/view",
    });
  });

  it("reuses the existing visible Drive folder when it is already present", async () => {
    const { driveClient, files } = createDriveClientMock();

    files.list.mockResolvedValueOnce({
      data: {
        files: [
          {
            id: "visible-folder-id",
            name: VISIBLE_DRIVE_FOLDER_NAME,
          },
        ],
      },
    });
    files.create.mockResolvedValueOnce({
      data: {
        id: "user-file-id",
        mimeType: "text/csv",
        name: "expenses.csv",
        webViewLink: "https://drive.google.com/file/d/user-file-id/view",
      },
    });

    const repository = new GoogleDriveUserFilesRepository(driveClient);

    await repository.save({
      content: "date,amount\n2026-03-08,32.5",
      mimeType: "text/csv",
      name: "expenses.csv",
    });

    expect(files.create).toHaveBeenCalledTimes(1);
    expect(files.create).toHaveBeenCalledWith({
      fields: "id,name,mimeType,webViewLink",
      media: {
        body: "date,amount\n2026-03-08,32.5",
        mimeType: "text/csv",
      },
      requestBody: {
        name: "expenses.csv",
        parents: ["visible-folder-id"],
      },
    });
  });
});
