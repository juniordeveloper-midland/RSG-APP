-- AlterTable
ALTER TABLE `attendance` ADD COLUMN `hours_worked` DECIMAL(5, 2) NULL,
    ADD COLUMN `lunch_deduction` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `notes` TEXT NULL,
    ADD COLUMN `overtime_hours` DECIMAL(5, 2) NULL;

-- CreateIndex
CREATE INDEX `attendance_status_idx` ON `attendance`(`status`);
