'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Result } from '@/types/result';
import { GitCompare, RefreshCw, Play, Download } from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO, STATUS_NEUTRAL, ACCENT_CYAN,
  withOpacity, OPACITY_12, OPACITY_25,
} from '@/lib/chart-colors';
import { tryApiFetch } from '@/lib/api-utils';
import { useProjectStore } from '@/stores/projectStore';
import { useCharacterBlueprintStore } from '@/stores/characterBlueprintStore';
import type { FeelPreset, FeelProfile } from '@/lib/character-feel-optimizer';
import {
  diffAgainstUE, buildDriftApplyPrompt, buildAdoptLayer, UE_ADOPTED_LAYER_ID,
  type DriftRow, type DriftStatus, type ParsedFeelDefaults, type UESite,
} from '@/lib/character/feel-ue-sync';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';

/* ── Feel vs UE ───────────────────────────────────────────────────────────────
 * Reads the literal defaults the UE character sources declare (read-only route),
 * diffs them against the resolved stack, and applies ONLY the drift through the
 * parent's CLI rail on an explicit click. A UE value can be adopted into the
 * reserved 'ue-adopted' set layer instead. */

interface FeelReadData {
  moduleName: string;
  scannedFiles: number;
  truncated: boolean;
  files: string[];
  fields: ParsedFeelDefaults;
}

const STATUS_COLOR: Record<DriftStatus, string> = {
  drift: STATUS_WARNING, ambiguous: STATUS_ERROR, unparsed: STATUS_INFO, absent: STATUS_NEUTRAL, 'in-sync': STATUS_SUCCESS,
};

const at = (s: UESite) => `${s.name} ${s.path}:${s.line}`;

type ReadState = FeelReadData & { projectPath: string };

const fetchFeel = (projectPath: string) => tryApiFetch<FeelReadData>('/api/ue5-source/character-feel', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectPath }),
});

interface UEDriftPanelProps {
  resolved: FeelProfile;
  basePreset: FeelPreset;
  isRunning: boolean;
  onApplyDrift: (prompt: string, driftCount: number) => void;
}

export function UEDriftPanel({ resolved, basePreset, isRunning, onApplyDrift }: UEDriftPanelProps) {
  const projectPath = useProjectStore((s) => s.projectPath);
  const feelLayers = useCharacterBlueprintStore((s) => s.feelLayers);
  const addFeelLayer = useCharacterBlueprintStore((s) => s.addFeelLayer);
  const setLayerModifiers = useCharacterBlueprintStore((s) => s.setLayerModifiers);
  const toggleFeelLayer = useCharacterBlueprintStore((s) => s.toggleFeelLayer);

  const [read, setRead] = useState<ReadState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const applyPending = useRef(false);

  const settle = useCallback((path: string, res: Result<FeelReadData, string>) => {
    setLoading(false);
    setError(res.ok ? null : res.error);
    setRead(res.ok ? { ...res.data, projectPath: path } : null);
  }, []);

  const readUE = () => {
    if (!projectPath) return;
    setLoading(true);
    void fetchFeel(projectPath).then((res) => settle(projectPath, res));
  };

  // A read of another project is never shown; once a read exists, a project change
  // re-reads. After an Apply run finishes the panel re-reads too — the rows turning
  // in-sync is the observed result, not the CLI's word.
  const current = read && read.projectPath === projectPath ? read : null;
  useEffect(() => {
    if (!read || !projectPath || read.projectPath === projectPath) return;
    let live = true;
    void fetchFeel(projectPath).then((res) => { if (live) settle(projectPath, res); });
    return () => { live = false; };
  }, [projectPath, read, settle]);
  useEffect(() => {
    if (isRunning || !applyPending.current || !projectPath) return;
    applyPending.current = false;
    void fetchFeel(projectPath).then((res) => settle(projectPath, res));
  }, [isRunning, projectPath, settle]);

  const diff = useMemo(() => (current ? diffAgainstUE(resolved, current.fields) : null), [current, resolved]);
  const prompt = useMemo(() => (diff ? buildDriftApplyPrompt(diff.rows) : null), [diff]);

  const apply = () => {
    if (!prompt || !diff || isRunning) return;
    applyPending.current = true;
    onApplyDrift(prompt, diff.summary.drift);
  };

  const adopt = (row: DriftRow) => {
    if (!diff) return;
    const existing = feelLayers.find((l) => l.id === UE_ADOPTED_LAYER_ID);
    const layer = buildAdoptLayer(diff.rows, [row.field], existing);
    if (!layer) return;
    if (!existing) return addFeelLayer(layer);
    setLayerModifiers(existing.id, layer.modifiers);
    if (!existing.enabled) toggleFeelLayer(existing.id);
  };

  const listed = diff?.rows.filter((r) => r.status === 'drift' || r.status === 'ambiguous' || r.status === 'unparsed') ?? [];
  const names = (s: DriftStatus) => diff?.rows.filter((r) => r.status === s).map((r) => r.label) ?? [];

  return (
    <BlueprintPanel color={ACCENT_CYAN} className="p-3">
      <div className="flex items-center justify-between mb-2 gap-2">
        <SectionHeader icon={GitCompare} label={`Feel vs UE — ${basePreset.name}`} color={ACCENT_CYAN} />
        <button
          type="button" onClick={readUE} disabled={!projectPath || loading}
          title={projectPath ? 'Read the literal defaults from the character sources (read-only)' : 'No UE project configured'}
          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono text-text-muted hover:text-text disabled:opacity-40 focus-ring"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          {current ? 'Re-read UE' : 'Read UE'}
        </button>
      </div>

      {!projectPath && <p className="text-xs text-text-muted">No UE project configured — nothing to compare against.</p>}
      {projectPath && !current && !error && (
        <p className="text-xs text-text-muted">Not read yet. Read UE compares the resolved stack with the literal defaults in Source/&lt;Module&gt;.</p>
      )}
      {error && <p className="text-xs" style={{ color: STATUS_ERROR }}>UE read failed: {error}</p>}

      {current && diff && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-mono">
            <span style={{ color: STATUS_WARNING }}>{diff.summary.drift} drift</span>
            <span style={{ color: STATUS_SUCCESS }}>{diff.summary.inSync} in sync</span>
            <span style={{ color: STATUS_NEUTRAL }}>{diff.summary.absent} absent in UE</span>
            <span style={{ color: STATUS_INFO }}>{diff.summary.unparsed} unparsed</span>
            <span style={{ color: STATUS_ERROR }}>{diff.summary.ambiguous} ambiguous</span>
            <span className="text-text-muted">{current.scannedFiles} files in Source/{current.moduleName}{current.truncated ? ' (capped)' : ''}</span>
          </div>
          {current.scannedFiles === 0 && (
            <p className="text-xs" style={{ color: STATUS_WARNING }}>
              No .h/.cpp under Source/{current.moduleName} matched Character|Dodge|Camera — every field reads absent; nothing here proves sync.
            </p>
          )}

          <ul className="space-y-1">
            {listed.map((row) => (
              <li key={row.field} className="flex items-start justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <span className="font-mono uppercase text-2xs mr-1.5" style={{ color: STATUS_COLOR[row.status] }}>{row.status}</span>
                  <span className="text-text">{row.label}</span>
                  {row.status === 'drift' && <span className="font-mono text-text-muted"> UE {row.ueValue} → stack {Number(row.stackValue.toFixed(4))}</span>}
                  {row.sites.map((s) => <div key={at(s)} className="font-mono text-text-muted pl-2">{at(s)}{row.status === 'ambiguous' ? ` = ${s.value}` : ''}</div>)}
                  {row.runtimeWriters.map((s) => <div key={`rt-${at(s)}`} className="font-mono text-text-muted pl-2">runtime writer: {at(s)}</div>)}
                </div>
                {row.status === 'drift' && (
                  <button
                    type="button" onClick={() => adopt(row)} aria-label={`Adopt ${row.label}`}
                    title="Set the stack to the UE value (reserved 'Adopted from UE' layer)"
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-mono text-text-muted hover:text-text focus-ring shrink-0"
                  >
                    <Download className="w-3 h-3" /> Adopt
                  </button>
                )}
              </li>
            ))}
          </ul>
          {names('absent').length > 0 && (
            <p className="text-2xs text-text-muted">Not declared ({names('absent').length}): {names('absent').join(', ')}</p>
          )}
          {names('in-sync').length > 0 && (
            <p className="text-2xs text-text-muted">Matching ({names('in-sync').length}): {names('in-sync').join(', ')}</p>
          )}

          <button
            type="button" onClick={apply} disabled={!prompt || isRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
            style={{
              backgroundColor: withOpacity(STATUS_SUCCESS, OPACITY_12), color: STATUS_SUCCESS,
              border: `1px solid ${withOpacity(STATUS_SUCCESS, OPACITY_25)}`,
            }}
          >
            <Play className="w-3 h-3" />
            {!prompt ? 'In sync with UE' : isRunning ? 'Applying...' : `Apply drift only (${diff.summary.drift} to change, ${diff.summary.absent} to report)`}
          </button>
        </div>
      )}
    </BlueprintPanel>
  );
}
