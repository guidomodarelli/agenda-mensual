import type { drive_v3 } from "googleapis";

import { mapGoogleDriveStorageError } from "@/modules/storage/infrastructure/google-drive/google-drive-storage-error";

import type { StoredApplicationSettings } from "../../../domain/entities/stored-application-settings";
import type { ApplicationSettingsRepository } from "../../../domain/repositories/application-settings-repository";
import type { ApplicationSettingsDocument } from "../../../domain/value-objects/application-settings-document";
import { mapGoogleDriveSettingsFileDtoToDomain } from "../dto/mapper";

const DRIVE_FILE_FIELDS = "id,name,mimeType";
const DRIVE_FILES_CREATE_ENDPOINT = "drive.files.create";

export class GoogleDriveApplicationSettingsRepository
  implements ApplicationSettingsRepository
{
  constructor(private readonly driveClient: drive_v3.Drive) {}

  async save(
    document: ApplicationSettingsDocument,
  ): Promise<StoredApplicationSettings> {
    try {
      const response = await this.driveClient.files.create({
        fields: DRIVE_FILE_FIELDS,
        media: {
          body: document.content,
          mimeType: document.mimeType,
        },
        requestBody: {
          name: document.name,
          parents: ["appDataFolder"],
        },
      });

      return mapGoogleDriveSettingsFileDtoToDomain(response.data);
    } catch (error) {
      throw mapGoogleDriveStorageError(error, {
        endpoint: DRIVE_FILES_CREATE_ENDPOINT,
        operation: "google-drive-application-settings-repository:save",
      });
    }
  }
}
