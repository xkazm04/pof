export type SubTab = 'dashboard' | 'fingerprints' | 'alerts';

/** A regression action that failed and can be retried from the inline error banner. */
export type FailedAction =
  | { kind: 'analyze'; sessionId: string }
  | { kind: 'dismiss'; alertId: string }
  | { kind: 'resolve'; fingerprintId: string };
