import pino from 'pino';

/**
 * Structured logger using pino.
 * In production, outputs newline-delimited JSON for log aggregators (Datadog, CloudWatch).
 * In development, uses pino-pretty for human-readable output.
 *
 * Fields convention: { jobId, checkName, durationMs, passed, error }
 */
const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: 'media-pipeline' },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});

export default logger;
