-- Migration: add_rota_enhancements
-- Adds timezone to branches (IANA name, default Europe/London) and
-- days_of_week + request_id to shift_assignments for weekly-rota support.

ALTER TABLE `branches`
  ADD COLUMN `timezone` VARCHAR(64) NOT NULL DEFAULT 'Europe/London' AFTER `radius_m`;

ALTER TABLE `shift_assignments`
  ADD COLUMN `days_of_week` JSON NULL COMMENT 'Array of 0-6 (Sun-Sat). NULL means every day.',
  ADD COLUMN `request_id` VARCHAR(191) NULL UNIQUE COMMENT 'Idempotency key for offline-safe creation.',
  ADD COLUMN `assigned_by` VARCHAR(191) NULL COMMENT 'User ID of the manager who created the assignment.';

-- Index to speed up date-range roster queries
CREATE INDEX `shift_assignments_date_range_idx`
  ON `shift_assignments` (`shift_id`, `start_date`, `end_date`);

