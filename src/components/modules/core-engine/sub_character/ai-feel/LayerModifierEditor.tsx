'use client';

import { Plus, X } from 'lucide-react';
import { FEEL_FIELD_META } from '@/lib/character-feel-optimizer';
import type { LayerModifier, LayerOp } from '@/lib/feel-adjustment-layers';
import { withOpacity, OPACITY_15 } from '@/lib/chart-colors';

/* ── Per-layer modifier editor ───────────────────────────────────────────────
 * Compact rows: which field, how it combines (pct / add / set), and the value.
 * Pure-controlled — emits a fresh modifier array on every change. */

const OPS: { value: LayerOp; label: string; title: string }[] = [
  { value: 'pct', label: '%', title: 'Percent change (e.g. -20 → −20%)' },
  { value: 'add', label: '±', title: 'Absolute delta added to the value below' },
  { value: 'set', label: '=', title: 'Override with an absolute value' },
];

const selectCls =
  'rounded bg-surface-deep border border-border/40 text-xs font-mono px-1.5 py-1 text-text focus-ring';

interface LayerModifierEditorProps {
  modifiers: LayerModifier[];
  color: string;
  onChange: (modifiers: LayerModifier[]) => void;
}

export function LayerModifierEditor({ modifiers, color, onChange }: LayerModifierEditorProps) {
  const update = (i: number, patch: Partial<LayerModifier>) =>
    onChange(modifiers.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  const remove = (i: number) => onChange(modifiers.filter((_, idx) => idx !== i));
  const add = () => onChange([...modifiers, { field: FEEL_FIELD_META[0].key, op: 'pct', value: 0 }]);

  return (
    <div className="space-y-1.5 pl-2 pt-1.5">
      {modifiers.length === 0 && (
        <p className="text-2xs font-mono text-text-muted">No modifiers yet — add one below.</p>
      )}
      {modifiers.map((m, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <select
            value={m.field}
            onChange={(e) => update(i, { field: e.target.value })}
            aria-label="Modifier field"
            className={`${selectCls} flex-1 min-w-0`}
          >
            {FEEL_FIELD_META.map((f) => (
              <option key={f.key} value={f.key}>{f.label}</option>
            ))}
          </select>
          <select
            value={m.op}
            onChange={(e) => update(i, { op: e.target.value as LayerOp })}
            aria-label="Modifier operation"
            className={`${selectCls} w-12`}
          >
            {OPS.map((o) => (
              <option key={o.value} value={o.value} title={o.title}>{o.label}</option>
            ))}
          </select>
          <input
            type="number"
            value={Number.isFinite(m.value) ? m.value : 0}
            onChange={(e) => update(i, { value: e.target.value === '' ? 0 : Number(e.target.value) })}
            aria-label="Modifier value"
            className={`${selectCls} w-16 text-right`}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            aria-label="Remove modifier"
            className="p-1 rounded text-text-muted hover:text-text focus-ring"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1 text-2xs font-mono uppercase tracking-[0.15em] px-2 py-1 rounded focus-ring"
        style={{ color, backgroundColor: withOpacity(color, OPACITY_15) }}
      >
        <Plus className="w-3 h-3" /> Add modifier
      </button>
    </div>
  );
}
