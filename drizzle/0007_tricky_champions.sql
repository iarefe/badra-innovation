CREATE TABLE `challenge_covers` (
	`challenge_id` text PRIMARY KEY NOT NULL,
	`object_key` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'none' NOT NULL,
	`source` text DEFAULT 'generated' NOT NULL,
	`prompt` text DEFAULT '' NOT NULL,
	`job_id` text DEFAULT '' NOT NULL,
	`started_at` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`challenge_id`) REFERENCES `challenges`(`id`) ON UPDATE no action ON DELETE cascade
);
