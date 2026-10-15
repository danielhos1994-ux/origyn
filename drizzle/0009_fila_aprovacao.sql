CREATE TABLE `moderation_log` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant` text NOT NULL,
	`comment_id` text NOT NULL,
	`action` text NOT NULL,
	`text` text,
	`result` text NOT NULL,
	`detail` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_modlog_tenant_date` ON `moderation_log` (`tenant`,`created_at`);--> statement-breakpoint
ALTER TABLE `social_comments` ADD `handled_status` text;--> statement-breakpoint
ALTER TABLE `social_comments` ADD `handled_at` integer;--> statement-breakpoint
ALTER TABLE `social_comments` ADD `handled_reply` text;--> statement-breakpoint
ALTER TABLE `social_comments` ADD `meta_reply_id` text;--> statement-breakpoint
ALTER TABLE `social_comments` ADD `handled_error` text;