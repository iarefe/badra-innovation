CREATE TABLE `result_publications` (
	`revision` integer PRIMARY KEY NOT NULL,
	`snapshot` text NOT NULL,
	`published_at` integer NOT NULL,
	`actor` text NOT NULL
);
