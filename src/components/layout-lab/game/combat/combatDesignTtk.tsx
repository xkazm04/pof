'use client';

/**
 * Time to kill by weapon from the weapon table's own numbers (`predictTtk`): pick a target and a range, the shared
 * `ChartPanel` bars show every enabled weapon that reaches it, fastest first. A perfect-shooter model, so it sits
 * beside the MEASURED chart rather than replacing it. Without a weapons table (or its `targets`) it says what is missing.
 */
import { useState } from 'react';
import { ChartPanel } from '@/components/layout-lab/steps/shared/ChartPanel';
import type { LabTheme } from '@/components/layout-lab/theme';
import type { CombatTable } from '@/lib/games/combatLab/combatTypes';
import { PREDICT_RANGES, predictTtk } from '@/lib/games/combatLab/predictTtk';

const SEL = { fontSize: 'var(--lab-fs-xs)', padding: '2px 6px' } as const;

export function CombatDesignTtk({ t, weapons }: { t: LabTheme; weapons?: CombatTable }) {
  const [range, setRange] = useState<number>(10);
  const [targetId, setTargetId] = useState('');
  const targets = weapons?.targets ?? [];
  if (!weapons || weapons.state !== 'ok' || targets.length === 0) {
    return (
      <p data-testid="combat-design-empty" style={{ margin: 0, fontSize: 'var(--lab-fs-sm)', color: t.muted }}>
        No design-side chart: it needs {weapons?.file ?? 'the weapons table'} with a <code>targets</code> list ({`{ id, hp }`}) and weapons carrying damage, rof_hz and range_m.
      </p>
    );
  }
  const target = targets.find((x) => x.id === targetId) ?? targets[0];
  const m = predictTtk(weapons, target, range);
  const rows = m.ready.map((p, i) => ({
    label: `${p.weapon} · ${p.shots}×`, value: Math.round(p.seconds * 100) / 100, unit: 's',
    highlight: i === 0, color: i === 0 ? 'var(--lab-ink-deep)' : 'var(--lab-muted)',
  }));
  const note = (label: string, ids: string[]) => (ids.length ? `${label}: ${ids.join(', ')}. ` : '');
  return (
    <div data-testid="combat-design-ttk" style={{ display: 'grid', gap: 'var(--lab-s2)' }}>
      <div style={{ display: 'flex', gap: 'var(--lab-s3)', flexWrap: 'wrap', alignItems: 'center', fontSize: 'var(--lab-fs-xs)', color: t.muted }}>
        <label>Target{' '}
          <select data-testid="combat-design-target" value={target.id} onChange={(e) => setTargetId(e.target.value)} className="focus-ring" style={{ ...SEL, color: t.text, background: t.panel, border: `1px solid ${t.line}` }}>
            {targets.map((x) => <option key={x.id} value={x.id}>{x.id} ({x.hp} hp)</option>)}
          </select>
        </label>
        <span role="group" aria-label="Range" style={{ display: 'flex', gap: 'var(--lab-s1)', alignItems: 'center' }}>
          Range
          {PREDICT_RANGES.map((r) => (
            <button key={r} type="button" aria-pressed={r === range} onClick={() => setRange(r)} className="focus-ring"
              style={{ ...SEL, cursor: 'pointer', color: r === range ? t.inkDeep : t.muted, background: r === range ? t.panel : 'transparent', border: `1px solid ${r === range ? t.inkDeep : t.line}` }}>{r} m</button>
          ))}
        </span>
      </div>
      {rows.length === 0
        ? <p style={{ margin: 0, fontSize: 'var(--lab-fs-sm)', color: t.muted }}>No enabled weapon with damage, rof_hz and range_m reaches {range} m.</p>
        : <ChartPanel t={t} variant="bars" rows={rows} labelWidth={170} ariaLabel={`Designed time to kill in seconds against ${target.id} at ${range} metres, by weapon`} />}
      <span style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted }}>
        {note('Out of range', m.outOfRange)}{note('Disabled in the table', m.disabled)}{note('Not modelled (needs damage, rof_hz, range_m)', m.unmodelled)}
        Label = weapon · shots to kill. Perfect shooter: every shot lands (no spread, splash or damage-over-time); includes reloads and projectile flight. Compare with the measured chart above.
      </span>
    </div>
  );
}
