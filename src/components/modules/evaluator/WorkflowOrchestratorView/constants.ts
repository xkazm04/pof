import {
  Clock, Loader2, CheckCircle2, XCircle, SkipForward, RotateCcw,
  ClipboardCheck, Wrench, Rocket, Zap,
} from 'lucide-react';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import type { DAGNodeStatus } from '@/types/task-dag';
import type { SubModuleId } from '@/types/modules';

// ── Icons for templates ──────────────────────────────────────────────────────

export const TEMPLATE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ClipboardCheck,
  Wrench,
  Rocket,
  Zap,
};

// ── Node status styling ──────────────────────────────────────────────────────

export const STATUS_STYLE: Record<DAGNodeStatus, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  pending: { icon: Clock, color: 'text-text-muted/50', bg: 'bg-text-muted/5' },
  queued: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-400/10' },
  running: { icon: Loader2, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
  completed: { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-400/10' },
  failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/10' },
  skipped: { icon: SkipForward, color: 'text-text-muted/40', bg: 'bg-text-muted/5' },
  retrying: { icon: RotateCcw, color: 'text-amber-400', bg: 'bg-amber-400/10' },
};

// ── Available modules for selection ──────────────────────────────────────────

export const AVAILABLE_MODULES = Object.keys(MODULE_FEATURE_DEFINITIONS) as SubModuleId[];
