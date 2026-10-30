import readline from 'readline';
import dotenv from 'dotenv';
import path from 'path';
import { PrismaClient } from '@prisma/client';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

async function main() {
  // 1. Refuse to run when NODE_ENV is production
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (nodeEnv.toLowerCase() === 'production') {
    console.error('\n❌ ERROR: Refusing to run reset script in PRODUCTION environment!');
    console.error('   NODE_ENV is set to "production". Aborting immediately.\n');
    process.exit(1);
  }

  // 2. Ask for confirmation before deleting
  console.log('\n============================================================');
  console.log('   REGION SECURITY GUARDING - TEST DATA CLEAN-UP SCRIPT');
  console.log('============================================================');
  console.log('⚠️  WARNING: This will permanently delete test data from:');
  console.log('   - Clients');
  console.log('   - Projects');
  console.log('   - Branches');
  console.log('   - Employees / Guards (all users except manager@region.com)');
  console.log('   - Shifts & Shift Assignments');
  console.log('   - Attendance Records');
  console.log('   - Patrol QRs & Patrol Scans');
  console.log('   - Alerts & Employee Documents');
  console.log('');
  console.log('🛡️  The manager account (manager@region.com) and DB structure');
  console.log('    will be safely preserved.');
  console.log('============================================================\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise<string>((resolve) => {
    rl.question('Are you sure you want to proceed? Type YES to confirm: ', (input) => {
      rl.close();
      resolve(input.trim());
    });
  });

  if (answer !== 'YES') {
    console.log('\n🚫 Operation cancelled. You did not enter "YES". No data was modified.\n');
    await prisma.$disconnect();
    process.exit(0);
  }

  console.log('\n⏳ Initiating clean-up in a single atomic transaction...\n');

  try {
    // 3. Execute all deletions in one transaction in a safe foreign-key order
    const results = await prisma.$transaction(
      async (tx) => {
        // A. Safely detach manager@region.com from any branch or client so foreign keys don't fail
        await tx.user.updateMany({
          where: { email: 'manager@region.com' },
          data: { branch_id: null, client_id: null },
        });

        // B. Delete patrol scans (references patrol_qrs and users)
        const patrolScans = await tx.patrolScan.deleteMany({});

        // C. Delete patrol QRs (references branches)
        const patrolQrs = await tx.patrolQr.deleteMany({});

        // D. Delete attendance records (references users and shifts)
        const attendance = await tx.attendance.deleteMany({});

        // E. Delete shift assignments (references shifts and users)
        const shiftAssignments = await tx.shiftAssignment.deleteMany({});

        // F. Delete shifts (references branches)
        const shifts = await tx.shift.deleteMany({});

        // G. Delete alerts (references branches and users)
        const alerts = await tx.alert.deleteMany({});

        // H. Delete employee documents
        const employeeDocs = await tx.employeeDocument.deleteMany({});

        // I. Clean up non-manager user tokens & resets before deleting users
        await tx.refreshToken.deleteMany({
          where: { user: { NOT: { email: 'manager@region.com' } } },
        });
        await tx.passwordReset.deleteMany({
          where: { user: { NOT: { email: 'manager@region.com' } } },
        });
        await tx.notification.deleteMany({
          where: { user: { NOT: { email: 'manager@region.com' } } },
        });

        // Unlink audit logs referencing users being deleted
        await tx.auditLog.updateMany({
          where: { user: { NOT: { email: 'manager@region.com' } } },
          data: { user_id: null },
        });

        // J. Delete all employees / users EXCEPT manager@region.com
        const employees = await tx.user.deleteMany({
          where: { email: { not: 'manager@region.com' } },
        });

        // K. Delete branches (now unreferenced by users, shifts, patrol_qrs, alerts)
        const branches = await tx.branch.deleteMany({});

        // L. Delete projects (references clients, previously referenced by branches)
        const projects = await tx.project.deleteMany({});

        // M. Delete clients (now unreferenced by branches, projects, and users)
        const clients = await tx.client.deleteMany({});

        return {
          patrolScans: patrolScans.count,
          patrolQrs: patrolQrs.count,
          attendance: attendance.count,
          shiftAssignments: shiftAssignments.count,
          shifts: shifts.count,
          alerts: alerts.count,
          employeeDocs: employeeDocs.count,
          employees: employees.count,
          branches: branches.count,
          projects: projects.count,
          clients: clients.count,
        };
      },
      {
        timeout: 60000, // 60s timeout for safety
      }
    );

    // 4. Print summary of deleted rows
    console.log('============================================================');
    console.log('🧹 RSG Database Test Data Clean-Up Summary');
    console.log('============================================================');
    console.log(`  Patrol Scans:         ${results.patrolScans} row(s) deleted`);
    console.log(`  Patrol QRs:           ${results.patrolQrs} row(s) deleted`);
    console.log(`  Attendance Records:   ${results.attendance} row(s) deleted`);
    console.log(`  Shift Assignments:    ${results.shiftAssignments} row(s) deleted`);
    console.log(`  Shifts:               ${results.shifts} row(s) deleted`);
    console.log(`  Alerts:               ${results.alerts} row(s) deleted`);
    console.log(`  Employee Documents:   ${results.employeeDocs} row(s) deleted`);
    console.log(`  Employees:            ${results.employees} row(s) deleted`);
    console.log(`  Branches:             ${results.branches} row(s) deleted`);
    console.log(`  Projects:             ${results.projects} row(s) deleted`);
    console.log(`  Clients:              ${results.clients} row(s) deleted`);
    console.log('============================================================');
    console.log('🛡️  Manager account (manager@region.com) safely preserved.');
    console.log('✅ Database schema and table structures untouched.');
    console.log('============================================================\n');
  } catch (error) {
    console.error('\n❌ Clean-up transaction failed! Rolled back entirely.', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

