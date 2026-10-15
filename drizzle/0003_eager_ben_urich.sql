CREATE TABLE `meta_app_config` (
	`id` text PRIMARY KEY NOT NULL,
	`secret_ciphertext` text NOT NULL,
	`graph_version` text NOT NULL,
	`updated_at` integer NOT NULL
);
