import type { PlaytestSession, PlaytestFinding, DirectorEvent } from '@/types/game-director';

export type DetailTab = 'findings' | 'timeline' | 'coverage';

export interface SessionDetailProps {
  session: PlaytestSession;
  onBack: () => void;
  onSimulate: () => Promise<void>;
  onDelete: () => Promise<void>;
  simulating: boolean;
  getFindings: (id: string) => Promise<PlaytestFinding[]>;
  getEvents: (id: string) => Promise<DirectorEvent[]>;
  markFixDispatched: (findingId: string) => Promise<PlaytestFinding>;
}
