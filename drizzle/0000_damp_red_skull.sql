CREATE TABLE `grant_profiles` (
	`owner` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `grant_programs` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
--> statement-breakpoint
CREATE TABLE `grant_sync_runs` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
