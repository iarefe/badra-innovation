CREATE TABLE `employee_avatars` (
	`employee_id` text PRIMARY KEY NOT NULL,
	`object_key` text DEFAULT '' NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade
);
