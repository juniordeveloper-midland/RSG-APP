-- ============================================================
-- Migration: Add client_id to branches, attach existing branches to default client,
-- and add password_hash to clients for contact person password
-- ============================================================

-- 1. Ensure the default client "Region Security Guarding" exists
INSERT IGNORE INTO `clients`
  (`id`, `name`, `code`, `website`, `industry`, `client_since`, `contact_name`, `contact_email`, `contact_phone`, `status`,
   `billing_address`, `billing_city`, `billing_state`, `billing_country`, `billing_zip`, `billing_phone`, `billing_email`,
   `created_at`, `updated_at`)
VALUES
  ('00000000-0000-0000-0000-000000000001',
   'Region Security Guarding', 'REGI-001', NULL, 'Security Services', NULL,
   'System Administrator', 'admin@rsg.com', '+1-000-000-0000', 'active',
   '1 Security House', 'London', 'England', 'United Kingdom', 'SW1A 1AA', '+44-000-000-0000', 'billing@rsg.com',
   NOW(), NOW());

-- 2. Add password_hash to clients table
ALTER TABLE `clients` ADD COLUMN `password_hash` VARCHAR(191) NULL;

-- 3. Add client_id to branches table (nullable first so existing rows don't fail)
ALTER TABLE `branches` ADD COLUMN `client_id` VARCHAR(191) NULL;

-- 4. Attach all existing branches to the default client
UPDATE `branches` SET `client_id` = '00000000-0000-0000-0000-000000000001' WHERE `client_id` IS NULL;

-- 5. Make client_id NOT NULL with default pointing to the default client
ALTER TABLE `branches` MODIFY COLUMN `client_id` VARCHAR(191) NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

-- 6. Add index and foreign key on branches.client_id
ALTER TABLE `branches` ADD INDEX `branches_client_id_idx` (`client_id`);
ALTER TABLE `branches` ADD CONSTRAINT `branches_client_id_fkey`
  FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

