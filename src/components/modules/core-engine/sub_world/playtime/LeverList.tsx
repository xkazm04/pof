'use client';

import { Wrench, FlaskConical, Undo2 } from 'lucide-react';
import { OPACITY_10, OPACITY_20, OPACITY_40, withOpacity } from '@/lib/chart-colors';
import { isLeverApplied, type WorldLever } from '@/lib/world/playtime-scenario';
import type { Lever } from './playtime-target';

interface Props {
  levers: readonly Lever[];
  applied: readonly WorldLever[];
  color: string;
  onToggle: (lever: WorldLever) => void;
}

/** Suggested levers for one zone, each with a Try / Undo toggle into the what-if scenario. */
export function LeverList({ levers, applied, color, onToggle }: Props) {
  if (levers.length === 0) return null;
  return (
    <ul className="mt-1.5 space-y-1 pl-1">
      {levers.map((l) => {
        const on = isLeverApplied(applied, l);
        const Icon = on ? Undo2 : FlaskConical;
        return (
          <li key={`${l.kind}:${l.amount}`} className="flex items-start gap-1.5">
            <Wrench className="w-3 h-3 mt-0.5 flex-shrink-0 text-text-muted" />
            <span className="flex-1 text-xs font-mono text-text-muted leading-snug">
              <span className="font-bold" style={{ color }}>{l.label}</span>
              <span className="opacity-70"> — {l.detail}</span>
            </span>
            <button
              type="button"
              aria-pressed={on}
              aria-label={`${on ? 'Undo' : 'Try'}: ${l.label}`}
              onClick={() => onToggle({ zoneId: l.zoneId, kind: l.kind, amount: l.amount })}
              className="flex items-center gap-1 flex-shrink-0 px-1.5 py-0.5 rounded border text-xs font-mono uppercase tracking-[0.15em] focus-ring"
              style={{
                color,
                borderColor: withOpacity(color, on ? OPACITY_40 : OPACITY_20),
                backgroundColor: on ? withOpacity(color, OPACITY_10) : 'transparent',
              }}
            >
              <Icon className="w-2.5 h-2.5" aria-hidden="true" />
              {on ? 'Undo' : 'Try'}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
