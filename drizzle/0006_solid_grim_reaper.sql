ALTER TABLE `social_comments` ADD `suggested_reply` text;--> statement-breakpoint
ALTER TABLE `social_comments` ADD `needs_support` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Reclassifica tudo com as categorias do manual da Películas Fácil (15/10/2026).
UPDATE `social_comments` SET `classified_at`=NULL,`category`=NULL,`topic`=NULL,`suggested_action`=NULL;
