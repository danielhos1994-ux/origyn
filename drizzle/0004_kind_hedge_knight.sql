CREATE TABLE `meta_client_data` (
	`tenant` text PRIMARY KEY NOT NULL,
	`page_id` text NOT NULL,
	`page_name` text NOT NULL,
	`instagram_id` text,
	`instagram_username` text,
	`snapshot` text,
	`synced_at` integer
);
