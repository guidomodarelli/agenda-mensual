CREATE TABLE `application_settings_documents` (
	`content` text NOT NULL,
	`mime_type` text NOT NULL,
	`name` text NOT NULL,
	`updated_at_iso` text NOT NULL,
	`user_subject` text NOT NULL,
	PRIMARY KEY(`user_subject`, `name`)
);
--> statement-breakpoint
CREATE TABLE `lenders_catalog_documents` (
	`payload_json` text NOT NULL,
	`updated_at_iso` text NOT NULL,
	`user_subject` text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE `monthly_expenses_documents` (
	`month` text NOT NULL,
	`payload_json` text NOT NULL,
	`updated_at_iso` text NOT NULL,
	`user_subject` text NOT NULL,
	PRIMARY KEY(`user_subject`, `month`)
);
