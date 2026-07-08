import type { LogEntry } from '../types';
import type { BuildParseResult } from '../UE5BuildParser';
import type { ListImperativeAPI } from 'react-window';

// --- Grouped log types ---

export type GroupedLogEntry =
  | { kind: 'single'; log: LogEntry }
  | { kind: 'tool_pair'; toolUse: LogEntry; toolResult: LogEntry; id: string }
  | { kind: 'tool_batch'; pairs: { toolUse: LogEntry; toolResult: LogEntry }[]; id: string };

// --- Virtualized row for react-window ---

export interface LogRowData { logs: LogEntry[]; }

// --- Main TerminalOutput component ---

export interface TerminalOutputProps {
  logs: LogEntry[];
  isStreaming: boolean;
  queuePendingCount: number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  listRef: React.RefObject<ListImperativeAPI | null>;
  onScroll: () => void;
  buildParseCache: Map<string, BuildParseResult>;
  onBuildFix: (prompt: string) => void;
  // Scroll button
  scrollBtnVisible: boolean;
  isAutoScroll: boolean;
  unseenCount: number;
  onScrollToBottom: () => void;
  // Empty state
  accentColor?: string;
  onPromptFill?: (prompt: string) => void;
}

// --- Selection toolbar ---

export interface SelectionToolbarState {
  text: string;
  /** Horizontal center of the selection, in container content coords. */
  anchorX: number;
  /** Top of the selection rect, in container content coords. */
  anchorTop: number;
  /** Bottom of the selection rect, in container content coords (used when flipping below). */
  anchorBottom: number;
}

export interface ToolbarPosition {
  left: number;
  top: number;
  caretX: number;
  flipped: boolean;
}

// --- Client-side entity extraction (lightweight regex, no server call) ---

export interface InlineEntity {
  type: 'class' | 'file' | 'concept' | 'warning' | 'step';
  value: string;
  parent?: string;
  moduleId?: string;
}
