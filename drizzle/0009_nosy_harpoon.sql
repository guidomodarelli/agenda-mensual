CREATE TABLE `expense_folders` (
	`color` text,
	`created_at_iso` text NOT NULL,
	`expense_folder_id` text NOT NULL,
	`icon` text,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`updated_at_iso` text NOT NULL,
	`user_subject` text NOT NULL,
	PRIMARY KEY(`user_subject`, `expense_folder_id`)
);
--> statement-breakpoint
ALTER TABLE `expenses` ADD `expense_folder_id` text;--> statement-breakpoint
ALTER TABLE `expenses` ADD `sort_order` integer;