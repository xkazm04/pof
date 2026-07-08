import {
  Box, Variable, Zap, Puzzle, GitBranch, Hash, FileCode,
} from 'lucide-react';
import {
  ACCENT_CYAN, ACCENT_VIOLET, ACCENT_EMERALD, ACCENT_ORANGE, ACCENT_PINK,
  STATUS_NEUTRAL,
} from '@/lib/chart-colors';

// ── Section config ─────────────────────────────────────────────────────────

export interface SectionDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

export const SECTIONS: SectionDef[] = [
  { id: 'inheritance', label: 'Inheritance', icon: GitBranch, color: ACCENT_CYAN },
  { id: 'overriddenFunctions', label: 'Overridden Functions', icon: FileCode, color: ACCENT_VIOLET },
  { id: 'addedComponents', label: 'Components', icon: Box, color: ACCENT_EMERALD },
  { id: 'variables', label: 'Variables', icon: Variable, color: ACCENT_ORANGE },
  { id: 'eventGraphEntryPoints', label: 'Event Graph Entry Points', icon: Zap, color: ACCENT_PINK },
  { id: 'interfaces', label: 'Interfaces', icon: Puzzle, color: ACCENT_CYAN },
  { id: 'contentHash', label: 'Content Hash', icon: Hash, color: STATUS_NEUTRAL },
];
