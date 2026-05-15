import express from 'express';
import 'express-async-errors'; // Patches express to forward async errors to next()
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { uploadHandler } from './upload';
import { getJobStatus, getJobResults, getJobFailure, listJobs } from './jobs';
import { errorHandler, notFoundHandler } from './errorHandler';
import { getQueue } from '../queue/producer';

/**
 * Build and configure the Express application.
 * Separated from server.ts to allow integration testing without starting a port.
 */
export function createApp(): express.Application {
  const app = express();

  // ── Security & parsing middleware ────────────────────────────────────────────
  app.use(helmet()); // Sets secure HTTP headers (CSP, HSTS, etc.)
  app.use(cors());   // Allow cross-origin requests (tighten in production with allowedOrigins)
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // HTTP request logging
  app.use(
    morgan('combined', {
      stream: {
        write: (message: string) => {
          // Pipe Morgan output through pino for structured log consistency
          const { default: logger } = require('../utils/logger');
          logger.info(message.trim());
        },
      },
    }),
  );

  // ── Bull Board dashboard (dev-only queue inspector) ─────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');

    createBullBoard({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      queues: [new BullMQAdapter(getQueue()) as any],
      serverAdapter,
    });

    app.use('/admin/queues', serverAdapter.getRouter());
  }

  // ── Health check ─────────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ── API routes ───────────────────────────────────────────────────────────────
  const router = express.Router();

  // Upload
  router.post('/upload', uploadHandler);

  // Job queries
  router.get('/jobs', listJobs);
  router.get('/jobs/:jobId/status', getJobStatus);
  router.get('/jobs/:jobId/results', getJobResults);
  router.get('/jobs/:jobId/failure', getJobFailure);

  app.use('/api/v1', router);

  // ── Error handlers (must be last) ────────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
