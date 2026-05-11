import {
  deleteMonthlyExpenseReceipt,
} from "@/modules/monthly-expenses/application/use-cases/delete-monthly-expense-receipt";
import {
  uploadMonthlyExpenseReceipt,
} from "@/modules/monthly-expenses/application/use-cases/upload-monthly-expense-receipt";
import {
  createMonthlyExpenseReceiptsApiHandler,
} from "@/modules/monthly-expenses/infrastructure/api/create-monthly-expense-receipts-api-handler";
import {
  GoogleDriveMonthlyExpenseReceiptsRepository,
} from "@/modules/monthly-expenses/infrastructure/google-drive/repositories/google-drive-monthly-expense-receipts-repository";
import { createAppRouteHandler } from "@/modules/shared/infrastructure/next-app/next-api-handler-adapter";

const handler = createAppRouteHandler(createMonthlyExpenseReceiptsApiHandler({
  async remove({ command, driveClient }) {
    await deleteMonthlyExpenseReceipt({
      command,
      repository: new GoogleDriveMonthlyExpenseReceiptsRepository(driveClient),
    });
  },
  async upload({ command, driveClient }) {
    return uploadMonthlyExpenseReceipt({
      command,
      repository: new GoogleDriveMonthlyExpenseReceiptsRepository(driveClient),
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
