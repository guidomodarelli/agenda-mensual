import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const monthlyExpenseMonthsTable = sqliteTable(
  "monthly_expense_months",
  {
    exchangeRateBlueRate: real("exchange_rate_blue_rate"),
    exchangeRateMonth: text("exchange_rate_month"),
    exchangeRateOfficialRate: real("exchange_rate_official_rate"),
    exchangeRateSolidarityRate: real("exchange_rate_solidarity_rate"),
    hasReplicatedFromPreviousMonth:
      integer("has_replicated_from_previous_month")
        .notNull()
        .default(0),
    month: text("month").notNull(),
    updatedAtIso: text("updated_at_iso").notNull(),
    userSubject: text("user_subject").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userSubject, table.month],
    }),
  ],
);

export const expensesTable = sqliteTable(
  "expenses",
  {
    allReceiptsFolderId: text("all_receipts_folder_id"),
    allReceiptsFolderViewUrl: text("all_receipts_folder_view_url"),
    createdAtIso: text("created_at_iso").notNull(),
    currency: text("currency").notNull(),
    description: text("description").notNull(),
    expenseId: text("expense_id").notNull(),
    loanDirection: text("loan_direction").notNull().default("payable"),
    loanInstallmentCount: integer("loan_installment_count"),
    loanLenderId: text("loan_lender_id"),
    loanLenderName: text("loan_lender_name"),
    loanStartMonth: text("loan_start_month"),
    paymentLink: text("payment_link"),
    receiptShareMessage: text("receipt_share_message"),
    receiptSharePhoneDigits: text("receipt_share_phone_digits"),
    requiresReceiptShare: integer("requires_receipt_share").notNull().default(0),
    updatedAtIso: text("updated_at_iso").notNull(),
    userSubject: text("user_subject").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userSubject, table.expenseId],
    }),
  ],
);

export const expenseMonthsTable = sqliteTable(
  "expense_months",
  {
    exchangeRateMonth: text("exchange_rate_month"),
    exchangeRateBlueRate: real("exchange_rate_blue_rate"),
    exchangeRateOfficialRate: real("exchange_rate_official_rate"),
    exchangeRateSolidarityRate: real("exchange_rate_solidarity_rate"),
    expenseId: text("expense_id").notNull(),
    isPaid: integer("is_paid").notNull().default(0),
    manualCoveredPayments: integer("manual_covered_payments").notNull().default(0),
    month: text("month").notNull(),
    monthlyFolderId: text("monthly_folder_id"),
    monthlyFolderViewUrl: text("monthly_folder_view_url"),
    occurrencesPerMonth: integer("occurrences_per_month").notNull(),
    receiptShareStatus: text("receipt_share_status"),
    subtotal: real("subtotal").notNull(),
    updatedAtIso: text("updated_at_iso").notNull(),
    userSubject: text("user_subject").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userSubject, table.expenseId, table.month],
    }),
  ],
);

export const expenseReceiptsTable = sqliteTable(
  "expense_receipts",
  {
    allReceiptsFolderId: text("all_receipts_folder_id").notNull(),
    allReceiptsFolderViewUrl: text("all_receipts_folder_view_url").notNull(),
    coveredPayments: integer("covered_payments").notNull(),
    expenseId: text("expense_id").notNull(),
    fileId: text("file_id").notNull(),
    fileName: text("file_name").notNull(),
    fileViewUrl: text("file_view_url").notNull(),
    month: text("month").notNull(),
    monthlyFolderId: text("monthly_folder_id").notNull(),
    monthlyFolderViewUrl: text("monthly_folder_view_url").notNull(),
    registeredAtIso: text("registered_at_iso"),
    userSubject: text("user_subject").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userSubject, table.expenseId, table.month, table.fileId],
    }),
  ],
);

export const expensePaymentRecordsTable = sqliteTable(
  "expense_payment_records",
  {
    coveredPayments: integer("covered_payments").notNull(),
    expenseId: text("expense_id").notNull(),
    month: text("month").notNull(),
    paymentRecordId: text("payment_record_id").notNull(),
    receiptFileId: text("receipt_file_id"),
    registeredAtIso: text("registered_at_iso"),
    userSubject: text("user_subject").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userSubject, table.expenseId, table.month, table.paymentRecordId],
    }),
  ],
);

export const lendersCatalogTable = sqliteTable(
  "lenders_catalog",
  {
    lenderId: text("lender_id").notNull(),
    name: text("name").notNull(),
    notes: text("notes"),
    type: text("type").notNull(),
    updatedAtIso: text("updated_at_iso").notNull(),
    userSubject: text("user_subject").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userSubject, table.lenderId],
    }),
  ],
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

export const globalExchangeRateSettingsTable = sqliteTable(
  "global_exchange_rate_settings",
  {
    iibbRateDecimal: real("iibb_rate_decimal").notNull(),
    settingKey: text("setting_key").primaryKey(),
    updatedAtIso: text("updated_at_iso").notNull(),
  },
);

export const monthlyExchangeRatesTable = sqliteTable("monthly_exchange_rates", {
  blueRate: real("blue_rate").notNull(),
  iibbRateDecimalUsed: real("iibb_rate_decimal_used").notNull(),
  month: text("month").primaryKey(),
  officialRate: real("official_rate").notNull(),
  solidarityRate: real("solidarity_rate").notNull(),
  source: text("source").notNull(),
  sourceDateIso: text("source_date_iso").notNull(),
  updatedAtIso: text("updated_at_iso").notNull(),
});

export const userRegistrationTracesTable = sqliteTable(
  "user_registration_traces",
  {
    authProvider: text("auth_provider").notNull(),
    lastVerifiedAtIso: text("last_verified_at_iso").notNull(),
    registeredAtIso: text("registered_at_iso").notNull(),
    registrationEmail: text("registration_email").notNull(),
    userSubject: text("user_subject").primaryKey(),
  },
  (table) => [
    index("user_registration_traces_registration_email_idx").on(
      table.registrationEmail,
    ),
    index("user_registration_traces_auth_provider_idx").on(table.authProvider),
  ],
);
