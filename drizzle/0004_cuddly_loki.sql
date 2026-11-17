ALTER TABLE `employees` ADD `phone` text;--> statement-breakpoint
CREATE UNIQUE INDEX `employees_phone_unique` ON `employees` (`phone`);--> statement-breakpoint
ALTER TABLE `participation_settings` ADD `otp_channel` text DEFAULT 'sms' NOT NULL;