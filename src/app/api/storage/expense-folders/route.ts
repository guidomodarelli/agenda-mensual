import { getExpenseFoldersCatalog } from "@/modules/expense-folders/application/use-cases/get-expense-folders-catalog";
import { saveExpenseFoldersCatalog } from "@/modules/expense-folders/application/use-cases/save-expense-folders-catalog";
import { createExpenseFoldersApiHandler } from "@/modules/expense-folders/infrastructure/api/create-expense-folders-api-handler";
import { DrizzleExpenseFoldersRepository } from "@/modules/expense-folders/infrastructure/turso/repositories/drizzle-expense-folders-repository";
import { createAppRouteHandler } from "@/modules/shared/infrastructure/next-app/next-api-handler-adapter";

const handler = createAppRouteHandler(
  createExpenseFoldersApiHandler({
    async get({ database, userSubject }) {
      return getExpenseFoldersCatalog({
        repository: new DrizzleExpenseFoldersRepository(database, userSubject),
      });
    },
    async save({ command, database, userSubject }) {
      return saveExpenseFoldersCatalog({
        command,
        repository: new DrizzleExpenseFoldersRepository(database, userSubject),
      });
    },
  }),
);

export {
  handler as DELETE,
  handler as GET,
  handler as HEAD,
  handler as OPTIONS,
  handler as PATCH,
  handler as POST,
  handler as PUT,
};
