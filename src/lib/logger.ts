/**
 * Centralized logger — thin wrapper over console that can be swapped
 * for structured logging (e.g. pino, winston) without touching call sites.
 *
 * Use this instead of raw console.log / console.warn / console.info.
 * console.error is allowed by ESLint since it's the standard error path.
 */

/* eslint-disable no-console */

export const logger = {
  info: (...args: unknown[]) => console.info(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  debug: (...args: unknown[]) => console.debug(...args),
  log: (...args: unknown[]) => console.log(...args),
} as const;
