CREATE TABLE `challenge_interests` (
	`challenge_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`challenge_id`, `employee_id`),
	FOREIGN KEY (`challenge_id`) REFERENCES `challenges`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `employees` ADD `roles` text DEFAULT '[]' NOT NULL;