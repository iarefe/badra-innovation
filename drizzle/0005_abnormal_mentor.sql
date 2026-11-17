CREATE TABLE `phone_otps` (
	`id` text PRIMARY KEY NOT NULL,
	`phone` text NOT NULL,
	`digest` text NOT NULL,
	`expires_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`used` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
PRAGMA defer_foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_employees` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text,
	`phone` text,
	`name` text NOT NULL,
	`email` text,
	`department` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_employees`("id", "number", "phone", "name", "email", "department", "active", "created_at") SELECT "id", "number", "phone", "name", "email", "department", "active", "created_at" FROM `employees`;--> statement-breakpoint
DROP TABLE `employees`;--> statement-breakpoint
ALTER TABLE `__new_employees` RENAME TO `employees`;--> statement-breakpoint
PRAGMA defer_foreign_keys=OFF;--> statement-breakpoint
CREATE UNIQUE INDEX `employees_number_unique` ON `employees` (`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `employees_phone_unique` ON `employees` (`phone`);--> statement-breakpoint
CREATE UNIQUE INDEX `employees_email_unique` ON `employees` (`email`);