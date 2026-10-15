CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant` text NOT NULL,
	`comment_id` text NOT NULL,
	`action` text NOT NULL,
	`response` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_tenant_date` ON `audit` (`tenant`,`created_at`);--> statement-breakpoint
CREATE TABLE `comment_state` (
	`tenant` text NOT NULL,
	`comment_id` text NOT NULL,
	`status` text NOT NULL,
	`response` text NOT NULL,
	PRIMARY KEY(`tenant`, `comment_id`)
);
--> statement-breakpoint
CREATE TABLE `manuals` (
	`tenant` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL
);
