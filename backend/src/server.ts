import app from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { initAttendanceCronJobs } from './modules/attendance/attendance.cron';
import { initPatrolCronJobs } from './modules/patrol/patrol.cron';
import { bootstrapAdmin } from './modules/auth/auth.bootstrap';

const startServer = async () => {
  await bootstrapAdmin();

  const server = app.listen(env.PORT, '0.0.0.0', () => {
    // eslint-disable-next-line no-console
    console.log(`🛡️ RSG Backend listening on port ${env.PORT} [${env.NODE_ENV}]`);

    if (env.NODE_ENV !== 'test') {
      initAttendanceCronJobs();
      initPatrolCronJobs();
      // eslint-disable-next-line no-console
      console.log('⏰ Attendance & Patrol background cron jobs initialized');
    }
  });

  const gracefulShutdown = async (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      await prisma.$disconnect();
      // eslint-disable-next-line no-console
      console.log('Database connection closed. Process exited.');
      process.exit(0);
    });

    // Force close if graceful shutdown hangs
    setTimeout(() => {
      // eslint-disable-next-line no-console
      console.error('Forced shutdown due to timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
};

startServer().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error:', err);
  process.exit(1);
});
