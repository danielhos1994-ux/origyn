CREATE TABLE `meta_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`meta_user_id` text NOT NULL,
	`display_name` text NOT NULL,
	`token_ciphertext` text NOT NULL,
	`expires_at` integer,
	`connected_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `meta_oauth_attempts` (
	`state_hash` text PRIMARY KEY NOT NULL,
	`browser_hash` text NOT NULL,
	`expires_at` integer NOT NULL
);
