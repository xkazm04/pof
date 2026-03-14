import type { Operation } from 'fast-json-patch';
import type { LayoutTemplateId } from '../layout/types';
import type { PanelDensity, PanelRole, PanelDataSlice } from '../types/panel';

// ---------------------------------------------------------------------------
// Patch Origin
// ---------------------------------------------------------------------------

/** Identifies who initiated a state change. */
export type PatchOrigin = 'llm' | 'user';

// ---------------------------------------------------------------------------
// Tagged Operation
// ---------------------------------------------------------------------------

/** An RFC 6902 JSON Patch operation annotated with its origin. */
export type TaggedOperation = Operation & {
  /** Who initiated this operation. */
  origin: PatchOrigin;
};

// ---------------------------------------------------------------------------
// Patch Group
// ---------------------------------------------------------------------------

/**
 * A batch of related patch operations that form a single undoable unit.
 * One dispatch() call produces one PatchGroup.
 */
export interface PatchGroup {
  /** Unique identifier for this group. */
  id: string;
  /** The tagged operations that were applied. */
  patches: TaggedOperation[];
  /** Inverse operations that can undo this group. */
  inversePatches: Operation[];
  /** Who initiated the change. */
  origin: PatchOrigin;
  /** Human-readable description of the change. */
  description: string;
  /** When the change was applied (ISO timestamp). */
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Panel Instance
// ---------------------------------------------------------------------------

/** A panel that is currently placed in the workspace. */
export interface PanelInstance {
  /** Unique panel instance ID. */
  id: string;
  /** Panel type string matching a PanelDefinition.type. */
  type: string;
  /** Index of the slot this panel occupies in the layout grid. */
  slotIndex: number;
  /** Current density mode. */
  density: PanelDensity;
  /** Optional data slice controlling what subset of data the panel shows. */
  dataSlice?: PanelDataSlice;
  /** Resolved role for this panel instance. */
  role: PanelRole;
  /** Arbitrary UI state (scroll position, expanded sections, etc.). */
  uiState: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Streaming State
// ---------------------------------------------------------------------------

/** Tracks active streaming state for progressive panel reveal. */
export interface StreamingState {
  /** Whether streaming is currently in progress. */
  active: boolean;
  /** IDs of panels that have been revealed so far. */
  revealedPanelIds: string[];
  /** Per-panel streaming text buffers (panel ID -> accumulated text). */
  streamingText: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Workspace State
// ---------------------------------------------------------------------------

/** The complete workspace state that flows through the state engine. */
export interface WorkspaceState {
  /** Current layout configuration. */
  layout: {
    /** Active layout template. */
    template: LayoutTemplateId;
    /** CSS grid-template-rows value. */
    gridTemplateRows: string;
    /** CSS grid-template-columns value. */
    gridTemplateColumns: string;
  };
  /** Panels currently placed in the workspace. */
  panels: PanelInstance[];
  /** Streaming state (null when not streaming). */
  streaming: StreamingState | null;
}

// ---------------------------------------------------------------------------
// Undo Stack
// ---------------------------------------------------------------------------

/** Bounded undo/redo stack for patch groups. */
export interface UndoStack {
  /** Push a group onto the undo stack. Clears redo stack. */
  push(group: PatchGroup): void;
  /** Pop the most recent group from the undo stack. */
  undo(): PatchGroup | null;
  /** Pop the most recent group from the redo stack. */
  redo(): PatchGroup | null;
  /** Whether there are entries to undo. */
  canUndo(): boolean;
  /** Whether there are entries to redo. */
  canRedo(): boolean;
  /** Returns a copy of the undo stack. */
  getHistory(): PatchGroup[];
  /** Clear both undo and redo stacks. */
  clear(): void;
}

// ---------------------------------------------------------------------------
// State Engine
// ---------------------------------------------------------------------------

/** Subscriber callback invoked after every state change. */
export type StateSubscriber<T> = (state: T, group: PatchGroup) => void;

/** The core state engine interface. */
export interface StateEngine<T> {
  /** Get the current state (deep clone). */
  getState(): T;
  /** Get a JSON snapshot of the current state. */
  getSnapshot(): string;
  /** Apply patch operations to the state. */
  dispatch(
    operations: Operation[],
    origin: PatchOrigin,
    description: string
  ): void;
  /** Undo the most recent patch group. */
  undo(): PatchGroup | null;
  /** Redo the most recently undone patch group. */
  redo(): PatchGroup | null;
  /** Whether undo is available. */
  canUndo(): boolean;
  /** Whether redo is available. */
  canRedo(): boolean;
  /** Get the undo history. */
  getHistory(): PatchGroup[];
  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(listener: StateSubscriber<T>): () => void;
  /** Apply a new document without recording undo (for StreamController). */
  _applyWithoutUndo(newDoc: T): void;
  /** Record an undo group without applying patches (for StreamController). */
  _recordUndoGroup(
    patches: TaggedOperation[],
    inversePatches: Operation[],
    origin: PatchOrigin,
    description: string
  ): void;
}
