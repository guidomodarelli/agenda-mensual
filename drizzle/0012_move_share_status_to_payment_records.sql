ALTER TABLE `expense_payment_records` ADD `send_status` text;--> statement-breakpoint
UPDATE `expense_payment_records`
SET `send_status` = (
	SELECT `em`.`receipt_share_status`
	FROM `expense_months` `em`
	WHERE `em`.`user_subject` = `expense_payment_records`.`user_subject`
		AND `em`.`expense_id` = `expense_payment_records`.`expense_id`
		AND `em`.`month` = `expense_payment_records`.`month`
)
WHERE `receipt_file_id` IS NOT NULL;--> statement-breakpoint
ALTER TABLE `expense_months` DROP COLUMN `receipt_share_status`;
