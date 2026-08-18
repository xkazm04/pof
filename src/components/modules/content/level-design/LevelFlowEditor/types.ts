import type { RoomNode, RoomConnection } from '@/types/level-design';
import type { PacingFinding } from '@/lib/level-design/pacing-linter';
import type { EditCommitMode } from '@/hooks/useEntityCommitBuffer';

export interface LevelFlowEditorProps {
  rooms: RoomNode[];
  connections: RoomConnection[];
  /**
   * A drag emits one change per mouse-move but is ONE edit: those frames come
   * through as `stage` (zero writes) and mouseup commits the final position.
   */
  onUpdateRooms: (rooms: RoomNode[], mode?: EditCommitMode) => void;
  onUpdateConnections: (connections: RoomConnection[]) => void;
  onSelectRoom: (roomId: string | null) => void;
  selectedRoomId: string | null;
  accentColor: string;
  readOnly?: boolean;
  /** Pacing-linter findings keyed by primary room id — drives inline warning badges. */
  findingsByRoom?: Record<string, PacingFinding[]>;
}
