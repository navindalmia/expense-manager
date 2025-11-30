/**
 * Simple logger utility
 * In production, this can be connected to an error tracking service
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const currentLogLevel: LogLevel = process.env.NODE_ENV === 'production' ? 'error' : 'debug';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] <= LOG_LEVELS[currentLogLevel];
}

export const logger = {
  error(message: string, error?: any, context: Record<string, any> = {}) {
    if (shouldLog('error')) {
      console.error(`[ERROR] ${message}`, { error, ...context });
      // In a real app, you might want to send this to an error tracking service
      // e.g., Sentry.captureException(error, { extra: context });
    }
  },
  
  warn(message: string, context: Record<string, any> = {}) {
    if (shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, context);
    }
  },
  
  info(message: string, context: Record<string, any> = {}) {
    if (shouldLog('info')) {
      console.log(`[INFO] ${message}`, context);
    }
  },
  
  debug(message: string, context: Record<string, any> = {}) {
    if (shouldLog('debug')) {
      console.log(`[DEBUG] ${message}`, context);
    }
  },
};
