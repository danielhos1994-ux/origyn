CREATE TABLE `client_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant` text NOT NULL,
	`label` text NOT NULL,
	`token_hash` text NOT NULL,
	`user_id` text,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_grants_tenant` ON `client_grants` (`tenant`);--> statement-breakpoint
CREATE INDEX `idx_grants_hash` ON `client_grants` (`token_hash`);--> statement-breakpoint
CREATE TABLE `client_settings` (
	`tenant` text PRIMARY KEY NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `workspace_owner` (
	`key` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL
);
