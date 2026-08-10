CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`ig_user_id` text NOT NULL,
	`fb_page_id` text NOT NULL,
	`threads_user_id` text,
	`category_focus` text NOT NULL,
	`timezone` text NOT NULL,
	`posting_hours_local` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `background_usage` (
	`account_id` text NOT NULL,
	`background_id` text NOT NULL,
	`post_id` text NOT NULL,
	`used_at` text DEFAULT (datetime('now')) NOT NULL,
	PRIMARY KEY(`account_id`, `background_id`, `post_id`)
);
--> statement-breakpoint
CREATE TABLE `backgrounds` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`external_id` text,
	`source_url` text NOT NULL,
	`description` text,
	`attribution` text,
	`category_id` text,
	`darkness` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_backgrounds_external` ON `backgrounds` (`source`,`external_id`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `embedding_cache` (
	`text_hash` text PRIMARY KEY NOT NULL,
	`input_text` text NOT NULL,
	`vector` text NOT NULL,
	`provider` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ig_token` (
	`account_id` text PRIMARY KEY NOT NULL,
	`access_token_encrypted` text NOT NULL,
	`expires_at` text NOT NULL,
	`threads_access_token_encrypted` text,
	`threads_expires_at` text,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`quote_id` text,
	`background_id` text,
	`template_id` text NOT NULL,
	`caption_template_id` text NOT NULL,
	`mode` text NOT NULL,
	`composed_image_path` text,
	`ig_media_id` text,
	`ig_permalink` text,
	`threads_post_id` text,
	`stories_media_id` text,
	`status` text NOT NULL,
	`error_message` text,
	`scheduled_for` text NOT NULL,
	`published_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_posts_account_status` ON `posts` (`account_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_posts_account_published_at` ON `posts` (`account_id`,`published_at`);--> statement-breakpoint
CREATE TABLE `quote_usage` (
	`account_id` text NOT NULL,
	`quote_id` text NOT NULL,
	`post_id` text NOT NULL,
	`used_at` text DEFAULT (datetime('now')) NOT NULL,
	PRIMARY KEY(`account_id`, `quote_id`, `post_id`)
);
--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`text` text NOT NULL,
	`author` text,
	`category_id` text NOT NULL,
	`source` text DEFAULT 'curated' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_quotes_text_author` ON `quotes` (`text`,`author`);--> statement-breakpoint
CREATE TABLE `settings` (
	`account_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	PRIMARY KEY(`account_id`, `key`)
);
