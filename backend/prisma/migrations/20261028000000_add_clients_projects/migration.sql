-- ============================================================
-- Migration: Add clients, projects tables; add project_id to branches
-- Migrate all existing branches to a default client + project
-- ============================================================

-- 1. Add ClientStatus and ProjectStatus enums (MySQL uses ENUM column type)
-- 2. Create clients table
CREATE TABLE `clients` (
  `id`              VARCHAR(191) NOT NULL,
  `name`            VARCHAR(191) NOT NULL,
  `code`            VARCHAR(191) NOT NULL,
  `website`         VARCHAR(191) NULL,
  `industry`        VARCHAR(191) NOT NULL,
  `client_since`    VARCHAR(10) NULL,
  `contact_photo`   VARCHAR(191) NULL,
  `contact_name`    VARCHAR(191) NOT NULL,
  `contact_email`   VARCHAR(191) NOT NULL,
  `contact_phone`   VARCHAR(191) NOT NULL,
  `status`          ENUM('active','inactive','archived') NOT NULL DEFAULT 'active',
  `billing_address` VARCHAR(191) NOT NULL,
  `billing_city`    VARCHAR(191) NOT NULL,
  `billing_state`   VARCHAR(191) NOT NULL,
  `billing_country` VARCHAR(191) NOT NULL,
  `billing_zip`     VARCHAR(191) NOT NULL,
  `billing_phone`   VARCHAR(191) NOT NULL,
  `billing_email`   VARCHAR(191) NOT NULL,
  `created_at`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`      DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `clients_code_key` (`code`),
  INDEX `clients_status_idx` (`status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 3. Create projects table
CREATE TABLE `projects` (
  `id`          VARCHAR(191) NOT NULL,
  `client_id`   VARCHAR(191) NOT NULL,
  `name`        VARCHAR(191) NOT NULL,
  `code`        VARCHAR(191) NOT NULL,
  `start_date`  VARCHAR(10) NOT NULL,
  `end_date`    VARCHAR(10) NULL,
  `status`      ENUM('active','on_hold','completed') NOT NULL DEFAULT 'active',
  `description` TEXT NULL,
  `created_at`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`  DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `projects_client_id_idx` (`client_id`),
  INDEX `projects_status_idx` (`status`),
  CONSTRAINT `projects_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 4. Insert the default client (Region Security Guarding)
INSERT INTO `clients`
  (`id`, `name`, `code`, `website`, `industry`, `client_since`, `contact_name`, `contact_email`, `contact_phone`, `status`,
   `billing_address`, `billing_city`, `billing_state`, `billing_country`, `billing_zip`, `billing_phone`, `billing_email`,
   `created_at`, `updated_at`)
VALUES
  ('00000000-0000-0000-0000-000000000001',
   'Region Security Guarding', 'REGI-001', NULL, 'Security Services', NULL,
   'System Administrator', 'admin@rsg.com', '+1-000-000-0000', 'active',
   '1 Security House', 'London', 'England', 'United Kingdom', 'SW1A 1AA', '+44-000-000-0000', 'billing@rsg.com',
   NOW(), NOW());

-- 5. Insert the default project
INSERT INTO `projects`
  (`id`, `client_id`, `name`, `code`, `start_date`, `status`, `description`, `created_at`, `updated_at`)
VALUES
  ('00000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000001',
   'Default Project', 'REGI-DEFAULT', CURDATE(), 'active',
   'Auto-generated project to hold existing branches during migration.',
   NOW(), NOW());

-- 6. Add project_id column to branches (nullable first so existing rows don't fail)
ALTER TABLE `branches` ADD COLUMN `project_id` VARCHAR(191) NULL;

-- 7. Assign all existing branches to the default project
UPDATE `branches` SET `project_id` = '00000000-0000-0000-0000-000000000002';

-- 8. Make project_id NOT NULL now that all rows are populated
ALTER TABLE `branches` MODIFY COLUMN `project_id` VARCHAR(191) NOT NULL DEFAULT '00000000-0000-0000-0000-000000000002';

-- 9. Add index and FK on branches.project_id
ALTER TABLE `branches` ADD INDEX `branches_project_id_idx` (`project_id`);
ALTER TABLE `branches` ADD CONSTRAINT `branches_project_id_fkey`
  FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

