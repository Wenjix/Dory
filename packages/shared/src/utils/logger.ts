import winston from 'winston';

/**
 * Custom format: "[ServiceName] level: message"
 * Pretty-prints JSON objects in the message for readability.
 */
const bracketFormat = winston.format.printf(({ level, message, service, timestamp }) => {
  const tag = service ? `[${service}]` : '';
  return `${tag} ${level}: ${message}`;
});

export const createLogger = (service: string) => {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    defaultMeta: { service },
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          bracketFormat
        ),
      }),
    ],
  });
};

/**
 * Pretty-print an object as indented JSON for log messages.
 */
export const prettyJson = (obj: any): string => {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
};
