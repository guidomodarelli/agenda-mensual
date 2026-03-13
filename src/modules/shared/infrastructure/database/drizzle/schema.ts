import { primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const monthlyExpensesDocumentsTable = sqliteTable(
  "monthly_expenses_documents",
  {
    month: text("month").notNull(),
    payloadJson: text("payload_json").notNull(),
    updatedAtIso: text("updated_at_iso").notNull(),
    userSubject: text("user_subject").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userSubject, table.month],
    }),
  ],
);

export const lendersCatalogDocumentsTable = sqliteTable(
  "lenders_catalog_documents",
  {
    payloadJson: text("payload_json").notNull(),
    updatedAtIso: text("updated_at_iso").notNull(),
    userSubject: text("user_subject").primaryKey(),
  },
);

export const applicationSettingsDocumentsTable = sqliteTable(
  "application_settings_documents",
  {
    content: text("content").notNull(),
    mimeType: text("mime_type").notNull(),
    name: text("name").notNull(),
    updatedAtIso: text("updated_at_iso").notNull(),
    userSubject: text("user_subject").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userSubject, table.name],
    }),
  ],
);
