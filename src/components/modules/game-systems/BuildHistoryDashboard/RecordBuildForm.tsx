'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { PLATFORM_IDS, platformLabel } from '@/lib/packaging/build-profiles';
import { MODULE_COLORS } from '@/lib/chart-colors';

export function RecordBuildForm({ onSubmit, version }: { onSubmit: (data: Record<string, unknown>) => void; version: string }) {
  const [platform, setPlatform] = useState<string>(PLATFORM_IDS[0]);
  const [config, setConfig] = useState('Shipping');
  const [status, setStatus] = useState<'success' | 'failed'>('success');
  const [sizeGb, setSizeGb] = useState('');
  const [durationMin, setDurationMin] = useState('');

  const handleSubmit = () => {
    const sizeBytes = sizeGb ? Math.round(parseFloat(sizeGb) * 1024 * 1024 * 1024) : undefined;
    const durationMs = durationMin ? Math.round(parseFloat(durationMin) * 60000) : undefined;
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
        <span className="ml-auto text-2xs text-text-muted font-mono">Next: v{version}</span>
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
    </div>
  );
}
