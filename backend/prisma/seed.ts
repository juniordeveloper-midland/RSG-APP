import { PrismaClient, Role, UserStatus, CheckType } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting RSG database seed...');

  // 1. Create or upsert Default Client (Region Security Guarding)
  const defaultClient = await prisma.client.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Region Security Guarding',
      code: 'REGI-001',
      industry: 'Security Services',
      contact_name: 'System Administrator',
      contact_email: 'admin@rsg.com',
      contact_phone: '+1-000-000-0000',
      status: 'active',
      billing_address: '1 Security House',
      billing_city: 'London',
      billing_state: 'England',
      billing_country: 'United Kingdom',
      billing_zip: 'SW1A 1AA',
      billing_phone: '+44-000-000-0000',
      billing_email: 'billing@rsg.com',
    },
  });
  console.log(`✅ Default client seeded: ${defaultClient.name} (${defaultClient.id})`);

  // 2. Create or upsert Branch
  const branch = await prisma.branch.upsert({
    where: { id: 'branch-hq-001' },
    update: { client_id: defaultClient.id },
    create: {
      id: 'branch-hq-001',
      client_id: defaultClient.id,
      name: 'RSG Central Headquarters',
      address: '100 Security Way, City Centre',
      lat: 51.5073509,
      lng: -0.1277583,
      radius_m: 150.0,
      is_active: true,
    },
  });
  console.log(`✅ Branch seeded: ${branch.name} (${branch.id})`);

  // Hash seed passwords
  const saltRounds = 10;
  const managerPasswordHash = await bcrypt.hash('Manager123!', saltRounds);
  const guardPasswordHash = await bcrypt.hash('Guard123!', saltRounds);

  // 2. Create or upsert Manager
  const manager = await prisma.user.upsert({
    where: { email: 'manager@region.com' },
    update: {
      password_hash: managerPasswordHash,
      role: Role.manager,
      status: UserStatus.active,
      managerial_access: true,
    },
    create: {
      id: 'user-manager-001',
      branch_id: branch.id,
      name: 'RSG Operations Manager',
      email: 'manager@region.com',
      phone: '+447700900000',
      password_hash: managerPasswordHash,
      role: Role.manager,
      status: UserStatus.active,
      managerial_access: true,
      hourly_rate: 28.5,
      monthly_hours: 160,
      id_number: 'MGR-001',
      restrict_early_start: false,
      auto_checkout: false,
    },
  });
  console.log(`✅ Manager seeded: ${manager.name} (${manager.email})`);

  // 3. Create or upsert 2 Employees
  const employee1 = await prisma.user.upsert({
    where: { email: 'guard1@region.com' },
    update: {
      password_hash: guardPasswordHash,
      role: Role.employee,
      status: UserStatus.active,
    },
    create: {
      id: 'user-guard-001',
      branch_id: branch.id,
      name: 'John Smith Guard',
      email: 'guard1@region.com',
      phone: '+447700900001',
      password_hash: guardPasswordHash,
      role: Role.employee,
      status: UserStatus.active,
      managerial_access: false,
      hourly_rate: 15.5,
      monthly_hours: 160,
      id_number: 'SEC-001',
      restrict_early_start: true,
      auto_checkout: true,
    },
  });
  console.log(`✅ Employee 1 seeded: ${employee1.name} (${employee1.email})`);

  const employee2 = await prisma.user.upsert({
    where: { email: 'guard2@region.com' },
    update: {
      password_hash: guardPasswordHash,
      role: Role.employee,
      status: UserStatus.active,
    },
    create: {
      id: 'user-guard-002',
      branch_id: branch.id,
      name: 'Sarah Connor Guard',
      email: 'guard2@region.com',
      phone: '+447700900002',
      password_hash: guardPasswordHash,
      role: Role.employee,
      status: UserStatus.active,
      managerial_access: false,
      hourly_rate: 16.0,
      monthly_hours: 160,
      id_number: 'SEC-002',
      restrict_early_start: false,
      auto_checkout: true,
    },
  });
  console.log(`✅ Employee 2 seeded: ${employee2.name} (${employee2.email})`);

  const suspendedEmployee = await prisma.user.upsert({
    where: { email: 'suspended@region.com' },
    update: {
      password_hash: guardPasswordHash,
      status: UserStatus.suspended,
    },
    create: {
      id: 'user-guard-suspended',
      branch_id: branch.id,
      name: 'Suspended Guard',
      email: 'suspended@region.com',
      phone: '+447700900099',
      password_hash: guardPasswordHash,
      role: Role.employee,
      status: UserStatus.suspended,
      managerial_access: false,
      hourly_rate: 15.0,
      monthly_hours: 160,
      id_number: 'SEC-SUSP',
      restrict_early_start: false,
      auto_checkout: true,
    },
  });
  console.log(`✅ Suspended Employee seeded: ${suspendedEmployee.name} (${suspendedEmployee.email})`);

  // 4. Create or upsert 2 Shifts
  const shift1 = await prisma.shift.upsert({
    where: { id: 'shift-day-001' },
    update: {},
    create: {
      id: 'shift-day-001',
      branch_id: branch.id,
      name: 'Day Guard Shift',
      start_time: '07:00',
      end_time: '15:00',
      check_type: CheckType.gps,
      overtime_enabled: true,
      overtime_limit_hours: 4,
      lunch_deduction_minutes: 30,
      is_active: true,
    },
  });
  console.log(`✅ Shift 1 seeded: ${shift1.name} (${shift1.start_time} - ${shift1.end_time})`);

  const shift2 = await prisma.shift.upsert({
    where: { id: 'shift-night-002' },
    update: {},
    create: {
      id: 'shift-night-002',
      branch_id: branch.id,
      name: 'Night Patrol Shift',
      start_time: '23:00',
      end_time: '07:00',
      check_type: CheckType.qr,
      overtime_enabled: false,
      overtime_limit_hours: 0,
      lunch_deduction_minutes: 30,
      is_active: true,
    },
  });
  console.log(`✅ Shift 2 seeded: ${shift2.name} (${shift2.start_time} - ${shift2.end_time})`);

  console.log('✨ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
