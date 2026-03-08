import { saveApplicationSettings } from "@/modules/application-settings/application/use-cases/save-application-settings";
import { GoogleDriveApplicationSettingsRepository } from "@/modules/application-settings/infrastructure/google-drive/repositories/google-drive-application-settings-repository";
import { createStorageApiHandler } from "@/modules/storage/infrastructure/api/create-storage-api-handler";

export default createStorageApiHandler({
  operationLabel: "application settings",
  async save({ command, driveClient }) {
    return saveApplicationSettings({
      command,
      repository: new GoogleDriveApplicationSettingsRepository(driveClient),
    });
  },
});
