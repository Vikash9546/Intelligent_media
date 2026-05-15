import 'dotenv/config';
import { startWorker } from './queue/consumer';
import { closePool } from './db/pool';
import logger from './utils/logger';

/**
 * Worker entry point — separate process from the API server.
 *
 * WHY A SEPARATE PROCESS?
 * - CPU-bound analysis tasks (Sharp convolutions, OCR) would starve the
 *   Node.js event loop if run in the same process as the API server.
 * - Separate processes allow independent scaling: 1 API instance : N workers.
 * - Worker crashes don't take down the API and vice versa.
 * - In Kubernetes, this maps to separate Deployments with different resource limits.
 */
async function main(): Promise<void> {
  logger.info('Starting image analysis worker…');

  const worker = startWorker();

  /**
   * GRACEFUL SHUTDOWN for the worker:
   * 1. Close the worker — BullMQ will finish the current job before stopping
   * 2. Drain DB pool — waits for any in-flight DB writes to complete
   *
   * BullMQ's worker.close() waits for the current processor function to
   * resolve before returning. This is the key property that prevents
   * half-processed jobs on shutdown.
   */
  async function shutdown(signal: string): Promise<void> {
    logger.info({ signal }, 'Worker shutdown signal received');

    try {
      await worker.close(); // Waits for current job to finish
      await closePool();
      logger.info('Worker shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during worker shutdown');
      process.exit(1);
    }
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Worker: unhandled promise rejection');
  });

  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'Worker: uncaught exception — shutting down');
    process.exit(1);
  });

  logger.info('Worker ready and waiting for jobs…');
}

main().catch((err) => {
  logger.error({ err }, 'Failed to start worker');
  process.exit(1);
});
