// Intent module barrel export

// Types
export type {
  IntentType,
  IntentSource,
  ComposePayload,
  ManipulatePayload,
  NavigatePayload,
  QueryPayload,
  SystemPayload,
  IntentPayloadMap,
  Intent,
  IntentResult,
  IntentHandler,
  IntentEvent,
  IntentBus,
  Director,
} from './types';

// Director
export { createDirector, NEEDS_LLM } from './director';

// Bus
export { createIntentBus } from './bus';

// Handlers
export { createComposeHandler } from './handlers/compose';
export { createManipulateHandler } from './handlers/manipulate';
export { createNavigateHandler } from './handlers/navigate';
export { createSystemHandler } from './handlers/system';

// Resize
export { computeResize, initResizeState } from './resize';
export type { ResizeState } from './resize';

// Queue
export { createIntentQueue } from './queue';
export type { IntentQueue } from './queue';

// Hooks (React integration)
export { IntentProvider, useIntent } from './hooks';
