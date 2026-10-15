-- Remove comentários duplicados (mesmo texto, rede e horário em publicações ligadas), mantendo o primeiro.
DELETE FROM `social_comments` WHERE rowid NOT IN (SELECT MIN(rowid) FROM `social_comments` GROUP BY `tenant`,`platform`,`text`,`created_at`);
--> statement-breakpoint
-- Reclassifica com as regras revisadas do manual (emoji, pós-compra, "vamos verificar").
UPDATE `social_comments` SET `classified_at`=NULL,`category`=NULL,`topic`=NULL,`suggested_action`=NULL,`suggested_reply`=NULL,`needs_support`=0;
