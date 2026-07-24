'use client';

import { MonitorSmartphone } from 'lucide-react';
import { useCoarsePointer } from '@/hooks/useCoarsePointer';

interface DesktopCanvasNoticeProps {
  /** Override the default advisory copy. */
  label?: string;
  className?: string;
}

const DEFAULT_LABEL =
  'This editor relies on click-and-drag interactions best suited to a mouse. For full control, open it on a desktop.';

/**
 * A compact, non-blocking advisory shown only on touch-first devices
 * (no-hover coarse pointer) above canvas/graph/timeline editors whose primary
 * interaction is mouse/pointer dragging. It renders nothing on desktop, so
 * wrapping an editor with it is free for the common case.
 *
 * This is the shared "best on desktop" gate referenced by the drag-heavy editors
 * (state-machine / wiring graphs, audio scene painter, plan matrix, formation and
 * level-flow editors). Reuse it instead of hand-rolling per-editor copy.
 */
export function DesktopCanvasNotice({ label = DEFAULT_LABEL, className = '' }: DesktopCanvasNoticeProps) {
  const coarse = useCoarsePointer();
  if (!coarse) return null;
  return (
    <div
      role="note"
      className={`flex items-center gap-2 rounded-md border border-border bg-surface-deep px-3 py-2 text-xs text-text-muted ${className}`}
    >
      <MonitorSmartphone className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
