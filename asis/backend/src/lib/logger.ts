import winston from 'winston';

const { combine, timestamp, colorize, printf, json } = winston.format;

const logFormat = printf(({ level, message, timestamp, ...meta }) => {
  return JSON.stringify({ level, timestamp, message, ...meta });
});

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(timestamp(), logFormat),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp(),
        printf(({ level, message, timestamp, ...meta }) => {
          return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
      ),
    }),
  ],
});

export const log = {
  info: (msg: string, meta?: Record<string, unknown>) => logger.info(msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => logger.error(msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => logger.warn(msg, meta),
  debug: (msg: string, meta?: Record<string, unknown>) => logger.debug(msg, meta),
};
