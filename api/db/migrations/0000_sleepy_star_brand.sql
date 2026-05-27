CREATE TABLE `calculations` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`user_id` text,
	`session_id` text,
	`manufacturer` text NOT NULL,
	`part_number` text NOT NULL,
	`purchase_url` text,
	`notes` text,
	`units` text NOT NULL,
	`wire_diameter` real NOT NULL,
	`outer_diameter` real NOT NULL,
	`active_coils` real NOT NULL,
	`average_diameter` real NOT NULL,
	`spring_rate` real NOT NULL,
	`sync_version` integer DEFAULT 1 NOT NULL,
	`device_id` text,
	CONSTRAINT "calculations_units_check" CHECK("calculations"."units" in ('mm', 'in'))
);
--> statement-breakpoint
CREATE INDEX `idx_calculations_created_at` ON `calculations` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_calculations_user_session` ON `calculations` (`user_id`,`session_id`);--> statement-breakpoint
CREATE INDEX `idx_calculations_manufacturer_part` ON `calculations` (`manufacturer`,`part_number`);--> statement-breakpoint
CREATE INDEX `idx_calculations_updated_at` ON `calculations` (`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_calculations_deleted_at` ON `calculations` (`deleted_at`) WHERE "calculations"."deleted_at" is not null;