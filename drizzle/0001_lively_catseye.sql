CREATE TABLE `challenge_votes` (
	`challenge_id` text NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`challenge_id`, `user_id`),
	FOREIGN KEY (`challenge_id`) REFERENCES `challenges`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`review_note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`published_at` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workshop_members` (
	`email` text PRIMARY KEY NOT NULL,
	`role` text DEFAULT 'employee' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workshop_selection` (
	`challenge_id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`votes` integer NOT NULL,
	`rank` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workshop_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`count` integer DEFAULT 3 NOT NULL,
	`open` integer DEFAULT 1 NOT NULL,
	`finalized` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL
);
