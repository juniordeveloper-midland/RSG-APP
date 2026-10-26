-- AlterTable
ALTER TABLE `attendance` ADD COLUMN `checkout_request_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `attendance_checkout_request_id_key` ON `attendance`(`checkout_request_id`);
