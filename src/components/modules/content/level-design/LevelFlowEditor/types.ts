import type { RoomNode, RoomConnection } from '@/types/level-design';
import type { PacingFinding } from '@/lib/level-design/pacing-linter';
import type { EditCommitMode } from '@/hooks/useEntityCommitBuffer';
import type { LevelEditOp } from '@/lib/level-design/level-edit';

/** The editor's undo/redo affordance — owned by whoever applies the ops. */
export interface EditorHistory {
  canUndo: boolean;
  canRedo: boolean;
  /** Undo steps available (bounded per document). */
  depth: number;
  undoLabel: string | null;
  redoLabel: string | null;
  onUndo: () => void;
  onRedo: () => void;
}

export interface LevelFlowEditorProps {
  rooms: RoomNode[];
  connections: RoomConnection[];
  /**
   * The document's difficulty arc — its first entry seeds the reachability walk
   * the link inspector uses to offer grant rooms (the same seeds the linter uses).
   */
  difficultyArc?: string[];
  /**
   * The editor's ONE write surface: every gesture is a named op. A drag emits
   * `move-room` frames as `stage` (zero writes) and commits on mouseup; held
   * arrow nudges arrive as `debounce`; discrete acts as `commit`. Returns
   * false when the op was refused (the owner reports why).
   */
  onEdit: (op: LevelEditOp, mode?: EditCommitMode) => boolean;
  /** Undo/redo — omitted for a read-only or history-less host. */
  history?: EditorHistory;
  onSelectRoom: (roomId: string | null) => void;
  selectedRoomId: string | null;
  accentColor: string;
  readOnly?: boolean;
  /** Pacing-linter findings keyed by primary room id — drives inline warning badges. */
  findingsByRoom?: Record<string, PacingFinding[]>;
}
