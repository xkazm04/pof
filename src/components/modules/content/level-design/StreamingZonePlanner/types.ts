// ── Types ──
// The plan's types live in lib (`@/lib/level-design/streaming-plan`), next to the
// reducer that writes the plan and the prompt builder that reads it.

import type { ZoneTransition } from '@/lib/level-design/streaming-plan';

export type {
  ZoneType,
  LoadPriority,
  TransitionStyle,
  TransitionTrigger,
  StreamingZone,
  ZoneTransition,
  StreamingZonePlannerConfig,
  StreamingMode,
  StreamingOp,
  StreamingPlanState,
  StreamingPlanStore,
} from '@/lib/level-design/streaming-plan';

export type TransitionLine = ZoneTransition & { x1: number; y1: number; x2: number; y2: number; fromName: string; toName: string };
