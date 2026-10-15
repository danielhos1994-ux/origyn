CREATE TABLE `social_comments` (
	`tenant` text NOT NULL,
	`id` text NOT NULL,
	`platform` text NOT NULL,
	`post_id` text NOT NULL,
	`parent_id` text,
	`author_name` text NOT NULL,
	`author_id` text,
	`text` text NOT NULL,
	`created_at` text NOT NULL,
	`collected_at` integer NOT NULL,
	`is_own` integer DEFAULT 0 NOT NULL,
	`category` text,
	`sentiment` text,
	`topic` text,
	`summary` text,
	`priority` text,
	`suggested_action` text,
	`confidence` real,
	`model` text,
	`classified_at` integer,
	`classify_error` text,
	PRIMARY KEY(`tenant`, `id`)
);
--> statement-breakpoint
CREATE INDEX `idx_comments_tenant_date` ON `social_comments` (`tenant`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_comments_pending` ON `social_comments` (`tenant`,`classified_at`);--> statement-breakpoint
CREATE INDEX `idx_comments_category` ON `social_comments` (`tenant`,`category`,`topic`);--> statement-breakpoint
CREATE TABLE `social_posts` (
	`tenant` text NOT NULL,
	`id` text NOT NULL,
	`platform` text NOT NULL,
	`text` text NOT NULL,
	`permalink` text,
	`created_at` text NOT NULL,
	`reactions` integer,
	`comments_count` integer,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`tenant`, `id`)
);
--> statement-breakpoint
CREATE INDEX `idx_posts_tenant_date` ON `social_posts` (`tenant`,`created_at`);--> statement-breakpoint
CREATE TABLE `sync_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant` text NOT NULL,
	`trigger` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`status` text NOT NULL,
	`new_comments` integer DEFAULT 0 NOT NULL,
	`classified` integer DEFAULT 0 NOT NULL,
	`message` text
);
--> statement-breakpoint
CREATE INDEX `idx_runs_tenant_start` ON `sync_runs` (`tenant`,`started_at`);