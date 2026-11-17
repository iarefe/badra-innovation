CREATE TABLE `final_ballot_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`phase` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `final_session_attendance` (
	`person` text PRIMARY KEY NOT NULL,
	`checked_at` integer NOT NULL,
	FOREIGN KEY (`person`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `final_solution_ballots` (
	`person` text PRIMARY KEY NOT NULL,
	`team` text NOT NULL,
	`cast_at` integer NOT NULL,
	FOREIGN KEY (`person`) REFERENCES `final_session_attendance`(`person`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team`) REFERENCES `event_teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `final_solution_ballots_team_idx` ON `final_solution_ballots` (`team`);