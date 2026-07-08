import { ArrowUpRight } from 'lucide-react';
import type { SubsystemSignal } from '@/types/project-health';
import { SIGNAL_COLORS } from './constants';

export function SignalCard({ signal: s, onNavigateTab }: { signal: SubsystemSignal; onNavigateTab?: (tab: string) => void }) {
  const drillable = Boolean(s.linkTab && onNavigateTab);

  const body = (
    <>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: SIGNAL_COLORS[s.status] }} />
        <span className="text-2xs font-medium text-text">{s.label}</span>
        {drillable && (
          <ArrowUpRight className="w-3 h-3 text-text-muted ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
      <p className="text-xs text-text-muted">{s.metric}</p>
      <p className="text-xs text-text-muted mt-0.5">{s.detail}</p>
    </>
  );

  if (!drillable) {
    return <div className="rounded-lg border border-border p-2.5">{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => onNavigateTab!(s.linkTab!)}
      aria-label={`Open ${s.label}`}
      className="group rounded-lg border border-border p-2.5 text-left transition-colors hover:border-text-muted/50 hover:bg-surface/50 focus-ring"
    >
      {body}
    </button>
  );
}
