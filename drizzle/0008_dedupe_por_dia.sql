-- Duplicados que a Meta entrega com horários diferentes no mesmo dia (mesmo autor, texto e rede).
DELETE FROM `social_comments` WHERE rowid NOT IN (SELECT MIN(rowid) FROM `social_comments` GROUP BY `tenant`,`platform`,`text`,`author_name`,substr(`created_at`,1,10));
--> statement-breakpoint
UPDATE `social_comments` SET `priority`=NULL WHERE `classified_at` IS NULL;
