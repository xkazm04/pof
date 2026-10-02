'use client';

import { useMemo } from 'react';
import { Rail } from '@/components/layout-lab/ui/Rail';
import { Stat } from '@/components/layout-lab/ui/Stat';
import { useViewerStore } from '@/components/modules/visual-gen/asset-viewer/useViewerStore';
import { formatNumber, formatMeters } from '@/components/modules/visual-gen/asset-viewer/assetStats';
import {
  gradeViewerAsset,
  DRAW_CALLS_PROXY_NOTE,
  type RowSeverity,
} from '@/components/modules/visual-gen/asset-viewer/assetGrade';
import { POLYCOUNT_PRESETS, type AssetClass } from '@/lib/visual-gen/polycount-presets';

const mono = { fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xs)' } as const;

const heading = {
  ...mono,
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  color: 'var(--lab-muted)',
  marginBottom: 'var(--lab-s2)',
};

const note = { ...mono, color: 'var(--lab-muted)', lineHeight: 1.6 };

/** What each grade says, in words. How BAD it is comes from the gate's severity, not here. */
const VERDICT_WORD: Record<string, string> = {
  honored: 'WITHIN CEILING', over: 'OVER CEILING', matches: 'SIZE MATCHES', off: 'SIZE OFF',
  upright: 'STANDS UPRIGHT', lying: 'LYING ON ITS SIDE', unmeasured: 'UNMEASURED',
};

/** Colourblind-safe: glyph + word, never hue alone (WCAG 1.4.1). Keyed by the gate's severity. */
const SEVERITY_TAG: Record<RowSeverity, { glyph: string; tone: string }> = {
  fail: { glyph: '✕', tone: 'var(--lab-bad)' },
  warn: { glyph: '!', tone: 'var(--lab-warn)' },
  pass: { glyph: '✓', tone: 'var(--lab-ok)' },
  unmeasured: { glyph: '?', tone: 'var(--lab-warn)' },
};

function VerdictRow({ verdict, severity, line }: { verdict: string; severity: RowSeverity; line: string }) {
  const tag = SEVERITY_TAG[severity];
  return (
    <div data-testid={`verdict-${verdict}`} data-severity={severity} style={{ ...mono, lineHeight: 1.6 }}>
      <div style={{ color: tag.tone, letterSpacing: '0.06em' }}>
        {tag.glyph} {VERDICT_WORD[verdict] ?? VERDICT_WORD.unmeasured}
      </div>
      <div style={{ color: 'var(--lab-muted)' }}>{line}</div>
    </div>
  );
}

/** Blueprint inspector for /3d — Stat tiles over the loaded mesh's geometry stats. */
export function StudioInspector({ modelName }: { modelName: string | null }) {
  const stats = useViewerStore((s) => s.stats);
  const loadState = useViewerStore((s) => s.loadState);
  const loadError = useViewerStore((s) => s.loadError);
  const modelUrl = useViewerStore((s) => s.modelUrl);
  const assetClass = useViewerStore((s) => s.assetClass);
  const targetExtentM = useViewerStore((s) => s.targetExtentM);
  const setAssetClass = useViewerStore((s) => s.setAssetClass);
  const setTargetExtentM = useViewerStore((s) => s.setTargetExtentM);

  const grade = useMemo(
    () => gradeViewerAsset(stats, assetClass ?? undefined, targetExtentM),
    [stats, assetClass, targetExtentM],
  );

  return (
    <Rail title="Inspector" style={{ width: 280, flexShrink: 0, borderRight: 'none', borderLeft: '1px solid var(--lab-line)' }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 'var(--lab-s4)', display: 'flex', flexDirection: 'column', gap: 'var(--lab-s3)' }}>
        {/* Order matters: a failure and a load in flight each OUTRANK stale numbers, which
            is the whole point — the panel used to print the previous model's stats through
            both windows. `setModel` clears `stats`, so these branches are mutually
            exclusive in practice; the ordering makes that structural. */}
        {loadState === 'error' ? (
          <div role="alert" style={{ ...mono, color: 'var(--lab-bad)', lineHeight: 1.6, overflowWrap: 'anywhere' }}>
            <div>Could not load this mesh.</div>
            {modelUrl && <div style={{ color: 'var(--lab-muted)' }}>{modelUrl}</div>}
            <div style={{ color: 'var(--lab-muted)' }}>{loadError ?? 'no reason was reported'}</div>
          </div>
        ) : loadState === 'loading' ? (
          <p role="status" aria-live="polite" style={note}>
            Loading {modelName ?? 'mesh'}… stats appear when the mesh resolves — nothing here describes it yet.
          </p>
        ) : !stats || !grade ? (
          <p style={note}>
            Load a model to inspect its geometry — triangles, vertices, materials, textures, and bounds.
          </p>
        ) : (
          <>
            <div style={{ ...mono, color: 'var(--lab-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={modelName ?? undefined}>
              {modelName ?? 'Unnamed asset'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--lab-s2)' }}>
              <Stat label="Triangles" value={formatNumber(stats.triangles)} accent />
              <Stat label="Vertices" value={formatNumber(stats.vertices)} />
              <Stat label="Meshes" value={String(stats.meshes)} />
              <Stat label="Mat slots" value={String(stats.drawCalls)} />
              <Stat label="Materials" value={String(stats.materials.length)} />
              <Stat label="Textures" value={String(stats.textures.length)} />
            </div>
            {/* The old "Draw Calls" tile named a number nothing measures. It is a material
                slot count; saying so is the alternative to grading a proxy. */}
            <p style={{ ...note, marginTop: 'calc(-1 * var(--lab-s2))' }}>Mat slots — {DRAW_CALLS_PROXY_NOTE}.</p>

            {/* ── The stated input everything below grades through ─────────────── */}
            <div>
              <div style={heading}>Asset class (stated, never guessed)</div>
              <label style={{ ...mono, display: 'block', color: 'var(--lab-muted)' }}>
                <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Asset class</span>
                <select
                  aria-label="Asset class"
                  className="focus-ring"
                  value={assetClass ?? ''}
                  onChange={(e) => setAssetClass((e.target.value || null) as AssetClass | null)}
                  style={{ ...mono, width: '100%', padding: 'var(--lab-s1) var(--lab-s2)', background: 'var(--lab-panel)', color: 'var(--lab-ink)', border: '1px solid var(--lab-line)', borderRadius: 'var(--lab-r-sm)' }}
                >
                  <option value="">— not stated —</option>
                  {POLYCOUNT_PRESETS.map((p) => (
                    <option key={p.assetClass} value={p.assetClass}>{p.label}</option>
                  ))}
                </select>
              </label>
              <label style={{ ...mono, display: 'block', color: 'var(--lab-muted)', marginTop: 'var(--lab-s2)' }}>
                <span>Intended longest extent (m)</span>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  aria-label="Intended longest extent in metres"
                  className="focus-ring"
                  value={targetExtentM ?? ''}
                  placeholder={grade.targetExtentM !== undefined ? String(grade.targetExtentM) : 'none for this class'}
                  onChange={(e) => setTargetExtentM(e.target.value === '' ? null : Number(e.target.value))}
                  style={{ ...mono, width: '100%', padding: 'var(--lab-s1) var(--lab-s2)', background: 'var(--lab-panel)', color: 'var(--lab-ink)', border: '1px solid var(--lab-line)', borderRadius: 'var(--lab-r-sm)' }}
                />
              </label>
              <p style={{ ...note, marginTop: 'var(--lab-s1)' }}>{grade.gradedAs}</p>
            </div>

            {/* ── Triangle ceiling, from polycount-presets ─────────────────────── */}
            <div>
              <div style={heading}>Triangle ceiling</div>
              <VerdictRow verdict={grade.budget.verdict} severity={grade.severity.budget} line={grade.budgetLine} />
            </div>

            {/* ── Size, from world-scale. NOT a bare number under a metres heading ─ */}
            <div>
              <div style={heading}>
                Bounding box (glTF units{grade.generatorNormalized ? ' · generator-normalised' : ''})
              </div>
              <VerdictRow verdict={grade.scale.verdict} severity={grade.severity.scale} line={grade.scaleLine} />
              {grade.scale.importUniformScale !== undefined && (
                <p style={{ ...mono, color: 'var(--lab-ink)', marginTop: 'var(--lab-s1)' }}>
                  Import uniform scale ×{grade.scale.importUniformScale.toFixed(2)}
                </p>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--lab-s2)', marginTop: 'var(--lab-s2)' }}>
                <Stat label="Width" value={formatMeters(stats.boundingBox.width)} />
                <Stat label="Height" value={formatMeters(stats.boundingBox.height)} />
                <Stat label="Depth" value={formatMeters(stats.boundingBox.depth)} />
              </div>
            </div>

            {/* ── Orientation, from world-scale via the gate's orientation-lying rule ─ */}
            <div>
              <div style={heading}>Orientation (glTF +Y up)</div>
              <VerdictRow verdict={grade.orientation.verdict} severity={grade.severity.orientation} line={grade.orientationLine} />
            </div>

            {/* ── The gate's verdict on what this viewer CAN measure, and what it cannot ─ */}
            <div data-testid="geometry-rollup" data-verdict={grade.verdict}>
              <div style={heading}>Tier-1 gate · geometry only</div>
              <div style={{ ...mono, color: SEVERITY_TAG[grade.verdict].tone, letterSpacing: '0.06em' }}>
                {SEVERITY_TAG[grade.verdict].glyph} GEOMETRY {grade.verdict.toUpperCase()}
                {grade.verdict === 'unmeasured' ? ' — no asset class stated' : ''}
              </div>
              {grade.findings.map((f) => (
                <div key={f.code} style={{ ...mono, color: SEVERITY_TAG[f.severity].tone }}>{f.code} · {f.severity}</div>
              ))}
              <p style={{ ...note, marginTop: 'var(--lab-s1)' }}>
                Measured only by the Tier-1 gate (trimesh), not by this viewer: {grade.gateOnly.join(', ')}.
              </p>
            </div>
          </>
        )}
      </div>
    </Rail>
  );
}
