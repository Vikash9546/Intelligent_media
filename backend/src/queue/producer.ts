import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import logger from '../utils/logger';

/**
 * Shared Redis connection for BullMQ.
 *
 * WHY IOREDIS OVER THE BUILT-IN BULLMQ CONNECTION?
 * BullMQ accepts either a connection config object or an ioredis instance.
 * Using a shared ioredis instance avoids BullMQ creating multiple connections
 * (one per Queue, one per Worker, one per QueueEvents) — important at scale.
 *
 * Note: BullMQ requires a separate connection per Queue/Worker/QueueEvents
 * because each uses BLPOP/subscribe which blocks the connection. We create
 * a factory function rather than a single shared connection.
 */
export function createRedisConnection(): IORedis {
  const redisUrl = process.env.REDIS_URL;
  const options: any = {
    maxRetriesPerRequest: null, // Required by BullMQ — it manages retries internally
    enableReadyCheck: false,    // Avoids blocking on Redis startup
    lazyConnect: true,
  };

  let connection: IORedis;

  if (redisUrl) {
    if (redisUrl.startsWith('rediss://')) {
      options.tls = {
        rejectUnauthorized: false,
      };
    }
    connection = new IORedis(redisUrl, options);
  } else {
    connection = new IORedis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      ...options,
    });
  }

  connection.on('error', (err) => {
    logger.error({ err }, 'Redis connection error');
  });

  connection.on('connect', () => {
    logger.info('Redis: connected');
  });

  return connection;
}

/** Name of the image analysis queue — centralised to avoid typos */
export const QUEUE_NAME = 'image-analysis';

/** Job payload shape for type safety throughout the codebase */
export interface ImageJobPayload {
  jobId: string;
  filePath: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
}

/** Singleton queue instance for the API layer to enqueue jobs */
let _queue: Queue<ImageJobPayload> | null = null;

export function getQueue(): Queue<ImageJobPayload> {
  if (!_queue) {
    _queue = new Queue<ImageJobPayload>(QUEUE_NAME, {
      connection: createRedisConnection(),
      defaultJobOptions: {
        /**
         * RETRY STRATEGY:
         * - attempts: 3 — one initial attempt + 2 retries
         * - exponential backoff starting at 2 s: retry at ~2s, ~4s, ~8s
         * - This handles transient failures (Redis blip, DB connection lost)
         *   without hammering the system immediately
         */
        attempts: parseInt(process.env.QUEUE_ATTEMPTS ?? '3', 10),
        backoff: {
          type: 'exponential',
          delay: parseInt(process.env.QUEUE_BACKOFF_DELAY ?? '2000', 10),
        },
        /**
         * Keep completed/failed job metadata in Redis for 7 days.
         * This allows the Bull Board dashboard to show historical jobs
         * and gives engineers time to investigate failures.
         * Trade-off: uses Redis memory. At high volume, reduce to 24h or
         * move to a DB-backed audit log.
         */
        removeOnComplete: false,
        removeOnFail: false,
      },
    });

    logger.info({ queue: QUEUE_NAME }, 'BullMQ queue initialised');
  }
  return _queue;
}

/** Enqueue a new image analysis job */
export async function enqueueImageJob(payload: ImageJobPayload): Promise<void> {
  const queue = getQueue();
  await queue.add('process-image', payload, {
    jobId: payload.jobId, // Use our UUID as the BullMQ job ID for traceability
  });
  logger.info({ jobId: payload.jobId }, 'Job enqueued successfully');
}

/** Graceful shutdown: close the queue connection */
export async function closeQueue(): Promise<void> {
  if (_queue) {
    await _queue.close();
    _queue = null;
    logger.info('BullMQ queue closed');
  }
}
