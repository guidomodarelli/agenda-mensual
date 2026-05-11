import { saveUserFile } from "@/modules/user-files/application/use-cases/save-user-file";
import { GoogleDriveUserFilesRepository } from "@/modules/user-files/infrastructure/google-drive/repositories/google-drive-user-files-repository";
import { createStorageApiHandler } from "@/modules/storage/infrastructure/api/create-storage-api-handler";
import { createAppRouteHandler } from "@/modules/shared/infrastructure/next-app/next-api-handler-adapter";

const handler = createAppRouteHandler(createStorageApiHandler({
  operationLabel: "user files",
  async save({ command, driveClient }) {
    return saveUserFile({
      command,
      repository: new GoogleDriveUserFilesRepository(driveClient),
    });
  },
}));

export {
  handler as DELETE,
  handler as GET,
  handler as HEAD,
  handler as OPTIONS,
  handler as PATCH,
  handler as POST,
  handler as PUT,
};
