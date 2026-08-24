CREATE TABLE `series` (
	`id` text PRIMARY KEY NOT NULL,
	`counter` integer DEFAULT 0 NOT NULL,
	`last_posted_at` text
);
--> statement-breakpoint
ALTER TABLE `posts` ADD `series_id` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `archetype` text;