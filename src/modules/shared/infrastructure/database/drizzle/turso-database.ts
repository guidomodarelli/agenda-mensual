import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";

import {
  requireTursoServerConfig,
} from "../turso-server-config";
import * as schema from "./schema";

export type TursoDatabase = LibSQLDatabase<typeof schema>;

export function createTursoDatabase(): TursoDatabase {
  const config = requireTursoServerConfig();
  const client = createClient({
    authToken: config.authToken,
    url: config.url,
  });

  return drizzle(client, {
    schema,
  });
}
