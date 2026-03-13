import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dbCredentials: {
    authToken: process.env.TURSO_AUTH_TOKEN,
    url: process.env.TURSO_DATABASE_URL ?? "file:./local.db",
  },
  dialect: "turso",
  out: "./drizzle",
  schema: "./src/modules/shared/infrastructure/database/drizzle/schema.ts",
  strict: true,
  verbose: true,
});
