CREATE TABLE `audio_usage` (
	`account_id` text NOT NULL,
	`audio_id` text NOT NULL,
	`post_id` text NOT NULL,
	`used_at` text DEFAULT (datetime('now')) NOT NULL,
	PRIMARY KEY(`account_id`, `audio_id`, `post_id`)
);
--> statement-breakpoint
ALTER TABLE `posts` ADD `audio_id` text;