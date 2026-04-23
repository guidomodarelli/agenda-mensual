CREATE TABLE `lenders_catalog` (
	`lender_id` text NOT NULL,
	`name` text NOT NULL,
	`notes` text,
	`type` text NOT NULL,
	`updated_at_iso` text NOT NULL,
	`user_subject` text NOT NULL,
	PRIMARY KEY(`user_subject`, `lender_id`)
);
--> statement-breakpoint
WITH `parsed_lenders` AS (
	SELECT
		TRIM(json_extract(`lender`.`value`, '$.id')) AS `lender_id`,
		TRIM(json_extract(`lender`.`value`, '$.name')) AS `name`,
		NULLIF(TRIM(COALESCE(json_extract(`lender`.`value`, '$.notes'), '')), '') AS `notes`,
		TRIM(json_extract(`lender`.`value`, '$.type')) AS `type`,
		`lenders_catalog_documents`.`updated_at_iso` AS `updated_at_iso`,
		`lenders_catalog_documents`.`user_subject` AS `user_subject`,
		CAST(`lender`.`key` AS INTEGER) AS `lender_index`
	FROM `lenders_catalog_documents`, json_each(`lenders_catalog_documents`.`payload_json`, '$.lenders') AS `lender`
	WHERE
		NULLIF(TRIM(COALESCE(json_extract(`lender`.`value`, '$.id'), '')), '') IS NOT NULL
		AND NULLIF(TRIM(COALESCE(json_extract(`lender`.`value`, '$.name'), '')), '') IS NOT NULL
		AND NULLIF(TRIM(COALESCE(json_extract(`lender`.`value`, '$.type'), '')), '') IS NOT NULL
), `deduplicated_lenders` AS (
	SELECT
		`lender_id`,
		`name`,
		`notes`,
		`type`,
		`updated_at_iso`,
		`user_subject`,
		ROW_NUMBER() OVER (
			PARTITION BY `user_subject`, `lender_id`
			ORDER BY `updated_at_iso` DESC, `lender_index` DESC
		) AS `duplicate_rank`
	FROM `parsed_lenders`
)
INSERT INTO `lenders_catalog` (
	`lender_id`,
	`name`,
	`notes`,
	`type`,
	`updated_at_iso`,
	`user_subject`
)
SELECT
	`lender_id`,
	`name`,
	`notes`,
	`type`,
	`updated_at_iso`,
	`user_subject`
FROM `deduplicated_lenders`
WHERE `duplicate_rank` = 1;
--> statement-breakpoint
DROP TABLE `lenders_catalog_documents`;
