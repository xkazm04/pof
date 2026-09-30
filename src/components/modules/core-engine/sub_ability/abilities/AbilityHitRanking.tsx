'use client';

import { ListOrdered } from 'lucide-react';
import {
  ACCENT_ORANGE, STATUS_WARNING, OVERLAY_WHITE, withOpacity, OPACITY_5, OPACITY_10, OPACITY_15,
} from '@/lib/chart-colors';
import type { AbilityHitRow } from '@/lib/ability/ability-hit-preview';
import { SectionHeader } from '../../unique-tabs/_design';
import { ELEMENT_COLORS, type AbilityElement } from '../_shared/data';

const TOP_N = 10;

function fmt(v: number | null, digits = 1): string {
  return v === null ? '—' : v.toFixed(digits);
}

/**
 * Every damaging catalog ability ranked by its canon expected hit against the
 * sandbox's current target. Clicking a row loads that ability into the sandbox.
 */
export function AbilityHitRanking({ rows, excluded, selectedId, onPick }: {
  rows: AbilityHitRow[];
  excluded: number;
  selectedId: string;
  onPick: (id: string) => void;
}) {
  const top = rows.slice(0, TOP_N);
  return (
    <div className="mt-4" data-testid="ability-hit-ranking">
      <SectionHeader icon={ListOrdered} label="Ranked vs this target" color={ACCENT_ORANGE} />
      <p className="text-xs font-mono text-text-muted mt-1 mb-2">
        Top {top.length} of {rows.length} damaging abilities by expected hit · {excluded} deal no direct damage and are not ranked
      </p>
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="text-text-muted uppercase tracking-[0.1em] text-left">
            <th className="py-1 pr-2 font-normal">#</th>
            <th className="py-1 pr-2 font-normal">Ability</th>
            <th className="py-1 pr-2 font-normal">Type</th>
            <th className="py-1 pr-2 font-normal text-right">Expected</th>
            <th className="py-1 pr-2 font-normal text-right">/ Mana</th>
            <th className="py-1 font-normal text-right">/ CD s</th>
          </tr>
        </thead>
        <tbody>
          {top.map((r, i) => {
            const color = ELEMENT_COLORS[r.element as AbilityElement] ?? ACCENT_ORANGE;
            const active = r.id === selectedId;
            return (
              <tr key={r.id} className="border-t"
                style={{
                  borderColor: withOpacity(OVERLAY_WHITE, OPACITY_10),
                  backgroundColor: active ? withOpacity(color, OPACITY_15) : undefined,
                }}>
                <td className="py-1 pr-2 text-text-muted tabular-nums">{i + 1}</td>
                <td className="py-1 pr-2">
                  <button type="button" onClick={() => onPick(r.id)}
                    className="text-left font-bold hover:underline focus-visible:underline"
                    style={{ color }} aria-pressed={active}>
                    {r.name}
                  </button>
                </td>
                <td className="py-1 pr-2 text-text">
                  {r.typeFallback ? (
                    <span title={`${r.element} has no canon damage type; the kernel treats it as Physical`}
                      className="px-1 rounded" style={{ color: STATUS_WARNING, backgroundColor: withOpacity(STATUS_WARNING, OPACITY_5) }}>
                      {r.element} → Physical
                    </span>
                  ) : r.canonType}
                </td>
                <td className="py-1 pr-2 text-right font-bold tabular-nums" style={{ color: ACCENT_ORANGE }}>{fmt(r.expected)}</td>
                <td className="py-1 pr-2 text-right text-text tabular-nums">{fmt(r.dmgPerMana, 2)}</td>
                <td className="py-1 text-right text-text tabular-nums">{fmt(r.hitPerCooldownSec)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
