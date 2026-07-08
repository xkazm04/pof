import type { RoomNode, RoomConnection } from '@/types/level-design';
import type { PacingFinding } from '@/lib/level-design/pacing-linter';

export interface LevelFlowEditorProps {
  rooms: RoomNode[];
  connections: RoomConnection[];
  onUpdateRooms: (rooms: RoomNode[]) => void;
  onUpdateConnections: (connections: RoomConnection[]) => void;
  onSelectRoom: (roomId: string | null) => void;
  selectedRoomId: string | null;
  accentColor: string;
  readOnly?: boolean;
  /** Pacing-linter findings keyed by primary room id — drives inline warning badges. */
  findingsByRoom?: Record<string, PacingFinding[]>;
}
