import { saveUserFile } from "@/modules/user-files/application/use-cases/save-user-file";
import { GoogleDriveUserFilesRepository } from "@/modules/user-files/infrastructure/google-drive/repositories/google-drive-user-files-repository";
import { createStorageApiHandler } from "@/modules/storage/infrastructure/api/create-storage-api-handler";

export default createStorageApiHandler({
  operationLabel: "user files",
  async save({ command, driveClient }) {
    return saveUserFile({
      command,
      repository: new GoogleDriveUserFilesRepository(driveClient),
    });
  },
});
