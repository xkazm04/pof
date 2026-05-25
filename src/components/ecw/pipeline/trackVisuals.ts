import {
  Code2, Brain, Image, Box, Activity, Volume2, Sparkles, FlaskConical,
  type LucideIcon,
} from 'lucide-react';
import type { PipelineTrackId, TrackState } from '@/lib/pipeline/tracks';

/** Track id → icon (UI-only; the model stays icon-free). */
export const TRACK_ICON: Record<PipelineTrackId, LucideIcon> = {
  logic: Code2,
  ai: Brain,
  'art-2d': Image,
  'art-3d': Box,
  animation: Activity,
  audio: Volume2,
  vfx: Sparkles,
  test: FlaskConical,
};

/** Track state → tailwind dot/ring color classes. */
export const STATE_CLASSES: Record<TrackState, { dot: string; ring: string; label: string }> = {
  'not-started': { dot: 'bg-text-muted/40', ring: 'border-border/50', label: 'text-text-muted' },
  'in-progress': { dot: 'bg-amber-500', ring: 'border-amber-500/60', label: 'text-amber-500' },
  done: { dot: 'bg-emerald-500', ring: 'border-emerald-500/60', label: 'text-emerald-500' },
  blocked: { dot: 'bg-red-500', ring: 'border-red-500/60', label: 'text-red-500' },
};

export const STATE_LABEL: Record<TrackState, string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  done: 'Done',
  blocked: 'Blocked',
};
