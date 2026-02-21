import type { SubModuleId } from './modules';

export type SessionLogEvent = 'started' | 'completed' | 'cancelled';

export interface SessionLogEntry {
  id: number;
  tabId: string;
  sessionKey: string;
  moduleId: SubModuleId;
  projectPath: string;
  event: SessionLogEvent;
  /** null for 'started' events, boolean for 'completed' */
  success: boolean | null;
  promptPreview: string;
  durationMs: number | null;
  createdAt: string;
}
