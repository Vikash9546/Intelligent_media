import 'dotenv/config';
import { createApp } from './api/app';
import { runMigrations } from './db/migrate';
import { closePool } from './db/pool';
import { closeQueue } from './queue/producer';
import logger from './utils/logger';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

async function main(): Promise<void> {
  // Run DB migrations on startup
  await runMigrations();

  const app = createApp();

  const server = app.listen(PORT, () => {
    logger.info({ port: PORT, env: process.env.NODE_ENV }, '🚀 API server listening');
  });

  /**
   * GRACEFUL SHUTDOWN
   *
   * On SIGTERM/SIGINT, we:
   * 1. Stop accepting new HTTP connections
   * 2. Close the BullMQ queue (no new jobs enqueued)
   * 3. Drain the DB pool (waits for in-flight queries)
   *
   * This ensures no requests are dropped mid-flight and no DB transactions
   * are left open. Kubernetes sends SIGTERM before killing the container,
   * so this is production-critical.
   */
  async function shutdown(signal: string): Promise<void> {
    logger.info({ signal }, 'Shutdown signal received — stopping gracefully');

    server.close(async () => {
      try {
        await closeQueue();
        await closePool();
        logger.info('Graceful shutdown complete');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during shutdown');
        process.exit(1);
      }
    });

    // Force kill if graceful shutdown takes > 15s
    setTimeout(() => {
      logger.error('Graceful shutdown timed out — force killing');
      process.exit(1);
    }, 15_000);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection');
    // Don't exit — log and continue. In production, consider alerting here.
  });

  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'Uncaught exception — this is fatal, shutting down');
    process.exit(1);
  });
}

main().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
