CREATE TABLE `faq_inquiries` (
	`id` text PRIMARY KEY NOT NULL,
	`question` text NOT NULL,
	`sender_id` text,
	`created_at` integer NOT NULL,
	`read_at` integer,
	FOREIGN KEY (`sender_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `faq_inquiries_created_idx` ON `faq_inquiries` (`created_at`,`id`);