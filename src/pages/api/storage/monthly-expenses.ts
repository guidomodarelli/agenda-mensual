import { saveMonthlyExpensesDocument } from "@/modules/monthly-expenses/application/use-cases/save-monthly-expenses-document";
import { createMonthlyExpensesApiHandler } from "@/modules/monthly-expenses/infrastructure/api/create-monthly-expenses-api-handler";
import { GoogleDriveMonthlyExpensesRepository } from "@/modules/monthly-expenses/infrastructure/google-drive/repositories/google-drive-monthly-expenses-repository";

export default createMonthlyExpensesApiHandler({
  async save({ command, driveClient }) {
    return saveMonthlyExpensesDocument({
      command,
      repository: new GoogleDriveMonthlyExpensesRepository(driveClient),
    });
  },
});
