import type { drive_v3 } from "googleapis";

import { mapGoogleDriveStorageError } from "@/modules/storage/infrastructure/google-drive/google-drive-storage-error";
import { getOrCreateVisibleDriveFolder } from "@/modules/storage/infrastructure/google-drive/visible-drive-folder";

import type { StoredUserFile } from "../../../domain/entities/stored-user-file";
import type { UserFilesRepository } from "../../../domain/repositories/user-files-repository";
import type { UserFileUpload } from "../../../domain/value-objects/user-file-upload";
import { mapGoogleDriveUserFileDtoToDomain } from "../dto/mapper";

const DRIVE_FILE_FIELDS = "id,name,mimeType,webViewLink";
const DRIVE_FILES_CREATE_ENDPOINT = "drive.files.create";

export class GoogleDriveUserFilesRepository implements UserFilesRepository {
  constructor(private readonly driveClient: drive_v3.Drive) {}

  async save(file: UserFileUpload): Promise<StoredUserFile> {
    const visibleDriveFolder = await getOrCreateVisibleDriveFolder({
      driveClient: this.driveClient,
      operation: "google-drive-user-files-repository:save:getFolder",
    });
    const visibleDriveFolderId = visibleDriveFolder.id;

    if (!visibleDriveFolderId) {
      throw new Error(
        "google-drive-user-files-repository:save could not resolve a folder id for user file storage.",
      );
    }

    try {
      const response = await this.driveClient.files.create({
        fields: DRIVE_FILE_FIELDS,
        media: {
          body: file.content,
          mimeType: file.mimeType,
        },
        requestBody: {
          name: file.name,
          parents: [visibleDriveFolderId],
        },
      });

      return mapGoogleDriveUserFileDtoToDomain(response.data);
    } catch (error) {
      throw mapGoogleDriveStorageError(error, {
        endpoint: DRIVE_FILES_CREATE_ENDPOINT,
        operation: "google-drive-user-files-repository:save",
      });
    }
  }
}
