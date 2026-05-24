'use client';

import {
  STATUS_WARNING,
  withOpacity, OPACITY_20, OPACITY_25,
} from '@/lib/chart-colors';
import { TACTICS_ENEMIES, TACTICS_ROLE_COLORS } from '../_shared/data';

/* ── Tactics Legend ───────────────────────────────────────────────────── */

export function TacticsLegend() {
  return (
    <div className="flex-1 space-y-3 min-w-0">
      <div>
        <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-1.5">Tactics Config</div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'MaxSimultaneous', value: '2' },
            { label: 'FlankingEnabled', value: 'true' },
          ].map(c => (
            <div key={c.label} className="bg-surface-deep rounded border border-border/30 px-2 py-1.5 text-center">
              <div className="text-xs font-mono font-bold text-text">{c.value}</div>
              <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">{c.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-1.5">Role Status</div>
        <div className="space-y-1">
          {TACTICS_ENEMIES.map(e => (
            <div key={e.id} className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: TACTICS_ROLE_COLORS[e.role] }} />
              <span className="font-mono font-bold text-text w-12">{e.label}</span>
              <span className="font-medium capitalize" style={{ color: TACTICS_ROLE_COLORS[e.role] }}>{e.role}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-sm text-text-muted leading-relaxed">
        Attack slot rotation ensures only MaxSimultaneous enemies engage at once. Flankers circle around to rear. Waiting enemies hold positions until a slot opens.
      </p>
    </div>
  );
}

/* ── Spawn Controls ──────────────────────────────────────────────────── */

export function SpawnControls({ formation, setFormation }: {
  formation: 'Circle' | 'Line' | 'Ambush';
  setFormation: (f: 'Circle' | 'Line' | 'Ambush') => void;
}) {
  return (
    <div className="flex gap-1.5">
      {(['Circle', 'Line', 'Ambush'] as const).map(f => (
        <button key={f} onClick={() => setFormation(f)}
          className="px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer border"
          style={formation === f
            ? { backgroundColor: withOpacity(STATUS_WARNING, OPACITY_20), color: STATUS_WARNING, borderColor: withOpacity(STATUS_WARNING, OPACITY_25) }
            : { color: 'var(--text-muted)', backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }
          }>
          {f}
        </button>
      ))}
    </div>
  );
}
