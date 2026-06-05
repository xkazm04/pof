'use client';

import { BarChart3, Check, Download, Upload } from 'lucide-react';
import { copyToClipboard } from '@/lib/clipboard';
import { OPACITY_15, STATUS_SUCCESS, STATUS_ERROR,
  withOpacity, OPACITY_8,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import type { SimScenario } from './data';
import { ACCENT, SCENARIO_PRESETS, encodeScenario } from './data';
import { useCallback, useState } from 'react';
import { TEXT_SCALE } from '@/lib/typography-scale';

interface Props {
  scenario: SimScenario;
  selectedPreset: string;
  onLoadPreset: (presetId: string) => void;
  onOpenImport: () => void;
}

export function GASBalanceHeader({ scenario, selectedPreset, onLoadPreset, onOpenImport }: Props) {
  const [exportStatus, setExportStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  const handleExport = useCallback(async () => {
    const encoded = encodeScenario(scenario);
    const ok = await copyToClipboard(encoded);
    setExportStatus(ok ? 'copied' : 'failed');
    setTimeout(() => setExportStatus('idle'), 2000);
  }, [scenario]);

  return (
    <BlueprintPanel color={ACCENT} className="p-3 relative overflow-hidden">
      <div className="absolute right-0 top-0 w-40 h-40 blur-3xl rounded-full pointer-events-none" style={{ backgroundColor: `${withOpacity(ACCENT, OPACITY_8)}` }} />
      <SectionHeader icon={BarChart3} label="Monte Carlo Balance Simulator" color={ACCENT} />
      <p className={`${TEXT_SCALE.body} text-text-muted mt-1`}>
        Simulate thousands of combat encounters using the full GAS damage pipeline (Strength{'→'}AttackPower scaling, armor/(armor+100) reduction, crit rolls, health depletion).
        Identify TTK distributions, DPS curves, effective HP, and attribute sensitivity breakpoints.
      </p>

      {/* Scenario Presets + Export/Import */}
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <span className="text-2xs text-text-muted">Presets:</span>
        {SCENARIO_PRESETS.map(p => (
          <button key={p.id} onClick={() => onLoadPreset(p.id)}
            className="text-2xs px-2 py-0.5 rounded-md border transition-colors"
            style={{
              borderColor: selectedPreset === p.id ? ACCENT : 'var(--color-border)',
              backgroundColor: selectedPreset === p.id ? `${ACCENT}${OPACITY_15}` : 'transparent',
              color: selectedPreset === p.id ? ACCENT : 'var(--color-text-muted)',
            }}>
            {p.name}
          </button>
        ))}
        <span className="w-px h-4 bg-border/50 mx-0.5" />
        <button onClick={handleExport}
          className="text-2xs px-2 py-0.5 rounded-md border border-border flex items-center gap-1 transition-colors hover:bg-surface-2"
          style={{
            color: exportStatus === 'copied' ? STATUS_SUCCESS : exportStatus === 'failed' ? STATUS_ERROR : 'var(--color-text-muted)',
            borderColor: exportStatus === 'copied' ? STATUS_SUCCESS : exportStatus === 'failed' ? STATUS_ERROR : undefined,
          }}>
          {exportStatus === 'copied' ? <Check className="w-3 h-3" /> : <Download className="w-3 h-3" />}
          {exportStatus === 'copied' ? 'Copied!' : exportStatus === 'failed' ? 'Failed' : 'Export'}
        </button>
        <button onClick={onOpenImport}
          className="text-2xs px-2 py-0.5 rounded-md border border-border flex items-center gap-1 text-text-muted transition-colors hover:bg-surface-2">
          <Upload className="w-3 h-3" /> Import
        </button>
      </div>
    </BlueprintPanel>
  );
}
