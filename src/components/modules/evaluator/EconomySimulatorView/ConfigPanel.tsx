'use client';

import { useId, useState } from 'react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { SimulationConfig } from '@/types/economy-simulator';
import { PHILOSOPHY_LABELS } from './constants';
import { validateField } from './helpers';

// ── Config Panel ────────────────────────────────────────────────────────────

export function ConfigPanel({ config, onChange, onValidity }: {
  config: SimulationConfig;
  onChange: (c: SimulationConfig) => void;
  onValidity: (label: string, error: string | null) => void;
}) {
  return (
    <SurfaceCard level={2} className="p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <ConfigField
          label="Virtual Players"
          value={config.agentCount}
          onChange={(v) => onChange({ ...config, agentCount: v })}
          min={10}
          max={500}
          onValidity={onValidity}
        />
        <ConfigField
          label="Max Level"
          value={config.maxLevel}
          onChange={(v) => onChange({ ...config, maxLevel: v })}
          min={10}
          max={100}
          onValidity={onValidity}
        />
        <ConfigField
          label="Play Hours"
          value={config.maxPlayHours}
          onChange={(v) => onChange({ ...config, maxPlayHours: v })}
          min={20}
          max={200}
          onValidity={onValidity}
        />
        <ConfigField
          label="Seed"
          value={config.seed}
          onChange={(v) => onChange({ ...config, seed: v })}
          min={1}
          max={999999}
          onValidity={onValidity}
        />
      </div>
      <div>
        <label className="text-2xs text-text-muted font-medium block mb-1">Economy Philosophy</label>
        <div className="flex flex-wrap gap-2">
          {(['loot-driven', 'scarcity-based', 'balanced'] as const).map((p) => (
            <button
              key={p}
              onClick={() => onChange({ ...config, philosophy: p })}
              className={`px-3 py-1.5 rounded-lg text-2xs font-medium transition-colors border ${
                config.philosophy === p
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                  : 'bg-surface border-border text-text-muted hover:text-text'
              }`}
            >
              {PHILOSOPHY_LABELS[p]}
            </button>
          ))}
        </div>
      </div>
    </SurfaceCard>
  );
}

/**
 * Numeric config input with visible validation feedback. Edits a raw draft so
 * the user can type freely; valid in-range values commit immediately, while
 * out-of-range or empty drafts are held (never pushed into the simulation
 * config), flagged with `aria-invalid` + an inline reason, and reported up via
 * `onValidity` so the Run button can block. On blur the draft is clamped to the
 * range (or reset to the last committed value) with a brief "clamped" note, so
 * snapping is explained rather than silent.
 */
export function ConfigField({ label, value, onChange, min, max, onValidity }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  onValidity: (label: string, error: string | null) => void;
}) {
  const fieldId = useId();
  const hintId = `${fieldId}-hint`;
  const errId = `${fieldId}-err`;
  const noteId = `${fieldId}-note`;

  const [raw, setRaw] = useState(() => String(value));
  const [lastValue, setLastValue] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [clampNote, setClampNote] = useState<string | null>(null);

  // Re-sync the draft when the committed value changes externally (e.g. defaults
  // reload) — render-time sync, no effect. Only touches this field's own state
  // (the parent's error map is already cleared by the commit that moved `value`).
  if (value !== lastValue) {
    setLastValue(value);
    if (Number(raw.trim()) !== value) setRaw(String(value));
    setError(null);
  }

  const handleChange = (text: string) => {
    setRaw(text);
    if (clampNote) setClampNote(null);
    const err = validateField(text, min, max);
    setError(err);
    onValidity(label, err);
    if (!err) {
      const n = Number(text.trim());
      if (n !== value) onChange(n);
    }
  };

  const handleBlur = () => {
    const trimmed = raw.trim();
    const n = Number(trimmed);
    if (trimmed === '' || !Number.isFinite(n)) {
      // Empty / garbage → restore the last committed value, no fuss.
      setRaw(String(value));
      setError(null);
      onValidity(label, null);
      setClampNote(null);
      return;
    }
    const clamped = Math.max(min, Math.min(max, n));
    setClampNote(
      clamped === n ? null : clamped === max ? `Clamped to max ${max}` : `Clamped to min ${min}`,
    );
    setRaw(String(clamped));
    setError(null);
    onValidity(label, null);
    if (clamped !== value) onChange(clamped);
  };

  const describedBy = [hintId, error ? errId : null, !error && clampNote ? noteId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div>
      <label htmlFor={fieldId} className="text-2xs text-text-muted font-medium block mb-1">{label}</label>
      <input
        id={fieldId}
        type="number"
        inputMode="numeric"
        value={raw}
        min={min}
        max={max}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        className={`w-full px-2.5 py-1.5 bg-surface border rounded-lg text-xs text-text focus:outline-none transition-colors ${
          error ? 'border-red-400/60 focus:border-red-400' : 'border-border focus:border-amber-500/40'
        }`}
      />
      <div className="mt-1 space-y-0.5">
        <span id={hintId} className="block text-2xs text-text-muted/60">Range {min}–{max}</span>
        {error ? (
          <span id={errId} role="alert" className="block text-2xs text-red-400 font-medium">{error}</span>
        ) : clampNote ? (
          <span id={noteId} role="status" className="block text-2xs text-amber-400 font-medium">{clampNote}</span>
        ) : null}
      </div>
    </div>
  );
}
