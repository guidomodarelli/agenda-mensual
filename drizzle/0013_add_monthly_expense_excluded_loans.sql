CREATE TABLE `monthly_expense_excluded_loans` (
	`expense_id` text NOT NULL,
	`month` text NOT NULL,
	`updated_at_iso` text NOT NULL,
	`user_subject` text NOT NULL,
	PRIMARY KEY(`user_subject`, `month`, `expense_id`)
);
