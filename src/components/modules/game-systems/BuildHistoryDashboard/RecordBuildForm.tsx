'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { PLATFORM_IDS, platformLabel } from '@/lib/packaging/build-profiles';
import { MODULE_COLORS, STATUS_ERROR } from '@/lib/chart-colors';

/**
 * Blank -> undefined (not recorded); otherwise a finite, non-negative number or an
 * error. `parseFloat` read 'abc' as NaN (sent as null, stored as "unknown" silently),
 * '1..5' as 1, and let '-2' through as a negative size.
 */
function parseAmount(text: string): { value?: number; ok: boolean } {
  const t = text.trim();
  if (t === '') return { ok: true };
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? { value: n, ok: true } : { ok: false };
}

// `nextVersion` is what the route will assign a green record (current + patch, or a
// pending bump) — the CURRENT version used to sit under this 'Next:' label.
export function RecordBuildForm({ onSubmit, nextVersion }: { onSubmit: (data: Record<string, unknown>) => void; nextVersion: string }) {
  const [platform, setPlatform] = useState<string>(PLATFORM_IDS[0]);
  const [config, setConfig] = useState('Shipping');
  const [status, setStatus] = useState<'success' | 'failed'>('success');
  const [sizeGb, setSizeGb] = useState('');
  const [durationMin, setDurationMin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    const size = parseAmount(sizeGb);
    const dur = parseAmount(durationMin);
    if (!size.ok || !dur.ok) {
      setError(!size.ok
        ? `Size "${sizeGb}" is not a non-negative number of GB.`
        : `Duration "${durationMin}" is not a non-negative number of minutes.`);
      return;
    }
    setError(null);
    const sizeBytes = size.value != null ? Math.round(size.value * 1024 * 1024 * 1024) : undefined;
    const durationMs = dur.value != null ? Math.round(dur.value * 60000) : undefined;
    onSubmit({ platform, config, status, sizeBytes, durationMs });
    setSizeGb('');
    setDurationMin('');
  };

  const inputClass = 'bg-background border border-border-bright rounded px-2 py-1 text-xs text-text-muted font-mono outline-none focus:border-[var(--systems)]/50 w-full';
  const selectClass = 'bg-background border border-border-bright rounded px-2 py-1 text-xs text-text-muted outline-none focus:border-[var(--systems)]/50 w-full';

  return (
    <div className="rounded border border-border-bright bg-surface-deep/80 p-3">
      <div className="flex items-center gap-1.5 mb-2.5">
        <Plus className="w-3 h-3" style={{ color: MODULE_COLORS.systems }} />
        <span className="text-xs font-medium text-text">Record Build</span>
        <span className="ml-auto text-2xs text-text-muted font-mono">Next: v{nextVersion}</span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        <div>
          <label className="text-2xs text-text-muted uppercase tracking-wider">Platform</label>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={selectClass}>
            {PLATFORM_IDS.map((id) => (
              <option key={id} value={id}>{platformLabel(id)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-2xs text-text-muted uppercase tracking-wider">Config</label>
          <select value={config} onChange={(e) => setConfig(e.target.value)} className={selectClass}>
            <option>Development</option>
            <option>DebugGame</option>
            <option>Shipping</option>
            <option>Test</option>
          </select>
        </div>
        <div>
          <label className="text-2xs text-text-muted uppercase tracking-wider">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as 'success' | 'failed')} className={selectClass}>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <div>
          <label className="text-2xs text-text-muted uppercase tracking-wider">Size (GB)</label>
          <input value={sizeGb} onChange={(e) => setSizeGb(e.target.value)} placeholder="0.0" className={inputClass} />
        </div>
        <div>
          <label className="text-2xs text-text-muted uppercase tracking-wider">Duration (min)</label>
          <input value={durationMin} onChange={(e) => setDurationMin(e.target.value)} placeholder="0" className={inputClass} />
        </div>
      </div>
      <button
        onClick={handleSubmit}
        className="mt-2 w-full py-1.5 rounded text-xs font-medium text-white bg-[var(--systems)]/80 hover:bg-[var(--systems)] transition-colors"
      >
        Record Build
      </button>
      {error && (
        <div role="alert" className="mt-1.5 text-2xs" style={{ color: STATUS_ERROR }}>{error}</div>
      )}
    </div>
  );
}
