import cron from 'node-cron';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';

/**
 * Detects missed patrols for all active QR checkpoints.
 * If more than (interval_minutes + PATROL_MISSED_GRACE_MINUTES) have elapsed
 * since the last scan (or since creation if never scanned), an Alert is created.
 */
export async function runMissedPatrolJob(): Promise<{
  checkedCheckpoints: number;
  missedAlertsCreated: number;
}> {
  const now = new Date();
  let missedAlertsCreated = 0;

  // Retrieve all active checkpoints with their parent branches
  const checkpoints = await prisma.patrolQr.findMany({
    where: {
      is_active: true,
      branch: { is_active: true },
    },
    include: {
      branch: true,
    },
  });

  for (const qr of checkpoints) {
    const intervalMinutes = qr.interval_minutes || 60;
    const thresholdMs =
      (intervalMinutes + env.PATROL_MISSED_GRACE_MINUTES) * 60 * 1000;
    const cutoff = new Date(now.getTime() - thresholdMs);

    // Look up the latest scan for this QR
    const latestScan = await prisma.patrolScan.findFirst({
      where: { qr_id: qr.id },
      orderBy: { server_time: 'desc' },
    });

    const lastActivityTime = latestScan
      ? latestScan.server_time
      : qr.created_at;

    if (lastActivityTime < cutoff) {
      // Check if an open alert for this checkpoint already exists to avoid spam
      const existingAlert = await prisma.alert.findFirst({
        where: {
          branch_id: qr.branch_id,
          type: 'missed_patrol',
          status: 'open',
          message: { contains: qr.name },
        },
      });

      if (!existingAlert) {
        const minutesOverdue = Math.round(
          (now.getTime() - lastActivityTime.getTime()) / (60 * 1000)
        );

        await prisma.alert.create({
          data: {
            branch_id: qr.branch_id,
            type: 'missed_patrol',
            severity: 'medium',
            status: 'open',
            message: `Missed Patrol Alert: Checkpoint '${qr.name}' at branch '${qr.branch.name}' has not been scanned for ${minutesOverdue} minutes (expected every ${intervalMinutes} min).`,
          },
        });

        missedAlertsCreated++;
      }
    }
  }

  return {
    checkedCheckpoints: checkpoints.length,
    missedAlertsCreated,
  };
}

/**
 * Initializes patrol background cron jobs.
 * Runs every 15 minutes in production and development.
 */
export function initPatrolCronJobs() {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  // Run every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    try {
      const result = await runMissedPatrolJob();
      if (result.missedAlertsCreated > 0) {
        // eslint-disable-next-line no-console
        console.log(
          `[CRON] Missed Patrol Job: Created ${result.missedAlertsCreated} alerts across ${result.checkedCheckpoints} checkpoints.`
        );
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[CRON ERROR] Missed Patrol Job failed:', err);
    }
  });

  // eslint-disable-next-line no-console
  console.log('⏰ Patrol Cron Job initialized: Missed patrol monitor scheduled every 15m');
}
