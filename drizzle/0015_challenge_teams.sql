CREATE TABLE `event_judges` (
	`person` text PRIMARY KEY NOT NULL,
	FOREIGN KEY (`person`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `event_teams` (
	`id` text PRIMARY KEY NOT NULL,
	`audience` integer,
	`solution` text DEFAULT '' NOT NULL,
	`announced` integer NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `challenges`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `team_announcement` (
	`id` integer PRIMARY KEY NOT NULL,
	`actor` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `team_files` (
	`team` text NOT NULL,
	`kind` text NOT NULL,
	`object_key` text NOT NULL,
	`name` text NOT NULL,
	PRIMARY KEY(`team`, `kind`),
	FOREIGN KEY (`team`) REFERENCES `event_teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `team_members` (
	`team` text NOT NULL,
	`person` text NOT NULL,
	PRIMARY KEY(`team`, `person`),
	FOREIGN KEY (`team`) REFERENCES `event_teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `team_scores` (
	`team` text NOT NULL,
	`person` text NOT NULL,
	`card` text NOT NULL,
	`stamp` integer NOT NULL,
	PRIMARY KEY(`team`, `person`),
	FOREIGN KEY (`team`) REFERENCES `event_teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
