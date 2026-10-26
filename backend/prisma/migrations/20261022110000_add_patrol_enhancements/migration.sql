-- AlterTable
ALTER TABLE `patrol_qrs` ADD COLUMN `description` VARCHAR(191) NULL,
    ADD COLUMN `interval_minutes` INTEGER NULL DEFAULT 60,
    ADD COLUMN `last_scanned_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `patrol_scans` ADD COLUMN `accuracy_m` DOUBLE NULL,
    ADD COLUMN `anomaly_reason` VARCHAR(191) NULL,
    ADD COLUMN `is_anomaly` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `patrol_qrs_is_active_idx` ON `patrol_qrs`(`is_active`);

-- CreateIndex
CREATE INDEX `patrol_scans_user_id_server_time_idx` ON `patrol_scans`(`user_id`, `server_time`);

-- CreateIndex
CREATE INDEX `patrol_scans_is_anomaly_idx` ON `patrol_scans`(`is_anomaly`);
