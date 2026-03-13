import { getLendersCatalog } from "@/modules/lenders/application/use-cases/get-lenders-catalog";
import { saveLendersCatalog } from "@/modules/lenders/application/use-cases/save-lenders-catalog";
import { createLendersApiHandler } from "@/modules/lenders/infrastructure/api/create-lenders-api-handler";
import { DrizzleLendersRepository } from "@/modules/lenders/infrastructure/turso/repositories/drizzle-lenders-repository";

export default createLendersApiHandler({
  async get({ database, userSubject }) {
    return getLendersCatalog({
      repository: new DrizzleLendersRepository(database, userSubject),
    });
  },
  async save({ command, database, userSubject }) {
    return saveLendersCatalog({
      command,
      repository: new DrizzleLendersRepository(database, userSubject),
    });
  },
});
