CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`case_id` text NOT NULL,
	`mode` text NOT NULL,
	`chapter` integer NOT NULL,
	`choice` integer NOT NULL,
	`correct` integer NOT NULL,
	`hint` integer NOT NULL,
	`duration` integer NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `attempts_user` ON `attempts` (`user_id`);--> statement-breakpoint
CREATE TABLE `custom_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cases_user` ON `custom_cases` (`user_id`);