'use client';

import { useCallback, useState } from 'react';
import { AlertTriangle, Settings2 } from 'lucide-react';
import { STATUS_ERROR } from '@/lib/chart-colors';
import {
  formatNumber,
  UE5_PRESETS,
  type AssetBudget,
  type BudgetViolation,
} from '../assetStats';
import { Section } from './Section';

export function BudgetSection({
  budget,
  violations,
  onChange,
}: {
  budget: AssetBudget;
  violations: BudgetViolation[];
  onChange: (b: AssetBudget) => void;
}) {
  const [open, setOpen] = useState(true);

  const applyPreset = useCallback(
    (key: keyof typeof UE5_PRESETS) => {
      onChange(UE5_PRESETS[key]);
    },
    [onChange],
  );

  const updateField = useCallback(
    (field: keyof AssetBudget, raw: string) => {
      const n = Math.max(0, Number(raw) || 0);
      onChange({ ...budget, [field]: n });
    },
    [budget, onChange],
  );

  return (
    <Section
      title="UE5 Budget"
      icon={<Settings2 size={12} />}
      open={open}
      onToggle={() => setOpen((v) => !v)}
      rightContent={
        <span className="text-[10px] text-text-muted">
          {violations.length === 0 ? 'OK' : `${violations.length} issue${violations.length === 1 ? '' : 's'}`}
        </span>
      }
    >
      <div className="flex flex-wrap gap-1 mb-2">
        {Object.keys(UE5_PRESETS).map((key) => (
          <button
            key={key}
            onClick={() => applyPreset(key as keyof typeof UE5_PRESETS)}
            className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide bg-surface text-text-muted hover:text-text hover:bg-[var(--visual-gen)]/20 transition-colors"
          >
            {key}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <BudgetField
          label="Max Tris"
          value={budget.maxTriangles}
          onChange={(v) => updateField('maxTriangles', v)}
        />
        <BudgetField
          label="Max Tex Size"
          value={budget.maxTextureSize}
          onChange={(v) => updateField('maxTextureSize', v)}
        />
        <BudgetField
          label="Max Materials"
          value={budget.maxMaterials}
          onChange={(v) => updateField('maxMaterials', v)}
        />
        <BudgetField
          label="Max Draw Calls"
          value={budget.maxDrawCalls}
          onChange={(v) => updateField('maxDrawCalls', v)}
        />
      </div>
      {violations.length > 0 && (
        <ul className="mt-2 space-y-1">
          {violations.map((v, i) => (
            <li
              key={`${v.metric}-${i}`}
              className="flex items-start gap-1.5 px-2 py-1 rounded"
              style={{ backgroundColor: `${STATUS_ERROR}14`, color: STATUS_ERROR }}
            >
              <AlertTriangle size={10} className="mt-[2px] shrink-0" />
              <span className="flex-1">
                {v.label}: <strong>{formatNumber(v.actual)}</strong>
                {v.detail ? ` (${v.detail})` : ''} &gt; {formatNumber(v.limit)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function BudgetField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (raw: string) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-text-muted">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-surface border border-border rounded px-1.5 py-1 text-xs text-text focus:outline-none focus:border-[var(--visual-gen)]"
      />
    </label>
  );
}
