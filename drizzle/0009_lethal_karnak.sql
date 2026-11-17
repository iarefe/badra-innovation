CREATE TABLE `prospective_declines` (
	`employee_id` text NOT NULL,
	`prospective_id` text NOT NULL,
	`revision` integer NOT NULL,
	PRIMARY KEY(`employee_id`, `prospective_id`),
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`prospective_id`) REFERENCES `prospective_employees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `prospective_employees` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`avatar_key` text DEFAULT '' NOT NULL,
	`linked_employee_id` text,
	`link_token` text DEFAULT '' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`linked_employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prospective_employees_phone_unique` ON `prospective_employees` (`phone`);--> statement-breakpoint
CREATE UNIQUE INDEX `prospective_employees_linked_employee_id_unique` ON `prospective_employees` (`linked_employee_id`);