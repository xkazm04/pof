// State module barrel export

// Types
export type {
  PatchOrigin,
  TaggedOperation,
  PatchGroup,
  PanelInstance,
  StreamingState,
  WorkspaceState,
  UndoStack,
  StateEngine,
  StateSubscriber,
} from './types';

// Engine
export { createStateEngine } from './engine';

// Undo
export { createUndoStack } from './undo';

// Streaming
export { createStreamController } from './streaming';
export type { StreamController } from './streaming';

// Patches
export { createTaggedPatch, captureUserChange } from './patches';

// Snapshot
export { serializeSnapshot } from './snapshot';

// React hooks
export { useWorkspaceState, useUndoRedoKeyboard } from './hooks';

// Conflict resolution
export {
  applyLLMPatchWithConflictCheck,
  acquireUserLock,
  releaseUserLock,
  getUserLockedPaths,
} from './conflict';
