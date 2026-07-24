'use client';

import { useMemo, useState, useCallback } from 'react';
import { Code, AlertTriangle } from 'lucide-react';
import {
  STATUS_ERROR, STATUS_WARNING, ACCENT_CYAN_LIGHT, OVERLAY_WHITE,
  withOpacity, OPACITY_10, OPACITY_15, OPACITY_20, OPACITY_30, OPACITY_80, OPACITY_90,
} from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SectionLabel, CopyButton, NormalizedLineChart } from '../../../unique-tabs/_shared';
import { ACCENT, DR_ATTRIBUTES } from '../../_shared/data';
import { DRConfig, DR_CONFIGS } from './constants';
import { generateCurveTableCSV, generateGEHeader, generateGESource, generateDataTableJSON } from './helpers';

/* ── Component ─────────────────────────────────────────────────────────────── */

export function DRCodeGenerator() {
  const [codeGenTab, setCodeGenTab] = useState<'header' | 'source' | 'csv' | 'datatable'>('header');
  const [drConfigs, setDRConfigs] = useState<DRConfig[]>(DR_CONFIGS);

  const generatedCode = useMemo(() => {
    switch (codeGenTab) {
      case 'header': return generateGEHeader(drConfigs);
      case 'source': return generateGESource(drConfigs);
      case 'csv': return drConfigs.map(c => `// ${c.curveTableName}\n${generateCurveTableCSV(c)}`).join('\n\n');
      case 'datatable': return generateDataTableJSON(drConfigs);
    }
  }, [codeGenTab, drConfigs]);

  const getCopyText = useCallback(() => generatedCode, [generatedCode]);

  return (
    <SurfaceCard level={2} className="p-5 relative overflow-hidden">
      <SectionLabel icon={Code} label="Diminishing Returns C++ Generator" color={ACCENT} />

      {/* Config editors per attribute */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2.5 mb-3">
        {drConfigs.map((config, idx) => {
          const drAttr = DR_ATTRIBUTES.find(a => a.name === config.attribute);
          const color = drAttr?.color ?? ACCENT;
          return (
            <div key={config.attribute} className="p-3 rounded-lg border" style={{ borderColor: `${color}${OPACITY_20}`, backgroundColor: `${color}${OPACITY_10}` }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs font-bold" style={{ color }}>{config.attribute}</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-2xs text-text-muted font-mono">Soft Cap</span>
                  <input
                    type="number" min={10} max={100} step={5}
                    value={config.softCap}
                    onChange={e => setDRConfigs(prev => prev.map((c, i) => i === idx ? { ...c, softCap: Number(e.target.value) } : c))}
                    className="w-14 bg-surface-deep/50 border border-border/40 rounded px-1.5 py-0.5 text-2xs font-mono text-text text-right focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-2xs text-text-muted font-mono">Base/pt</span>
                  <input
                    type="number" min={0.001} max={100} step={0.5}
                    value={config.baseValuePerPoint}
                    onChange={e => setDRConfigs(prev => prev.map((c, i) => i === idx ? { ...c, baseValuePerPoint: Number(e.target.value) } : c))}
                    className="w-14 bg-surface-deep/50 border border-border/40 rounded px-1.5 py-0.5 text-2xs font-mono text-text text-right focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-2xs text-text-muted font-mono">Post-Cap</span>
                  <input
                    type="number" min={0.05} max={1} step={0.05}
                    value={config.postCapMultiplier}
                    onChange={e => setDRConfigs(prev => prev.map((c, i) => i === idx ? { ...c, postCapMultiplier: Number(e.target.value) } : c))}
                    className="w-14 bg-surface-deep/50 border border-border/40 rounded px-1.5 py-0.5 text-2xs font-mono text-text text-right focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                  />
                </div>
              </div>

              {/* Mini effective value preview */}
              <div className="mt-2 pt-2 border-t border-border/30">
                <div className="text-2xs text-text-muted font-mono mb-1">Effective at {config.softCap + 20} pts:</div>
                {(() => {
                  const pts = config.softCap + 20;
                  const linear = pts * config.baseValuePerPoint;
                  const preCap = config.softCap * config.baseValuePerPoint;
                  let postCap = 0;
                  const maxOver = 100 - config.softCap;
                  for (let i = 1; i <= 20; i++) {
                    const t = i / maxOver;
                    postCap += config.baseValuePerPoint * (1.0 - (1.0 - config.postCapMultiplier) * t);
                  }
                  const effective = preCap + postCap;
                  const savings = ((1 - effective / linear) * 100).toFixed(0);
                  return (
                    <div className="flex items-center gap-2 text-2xs font-mono">
                      <span className="text-text-muted">Linear: <span className="text-text">{linear.toFixed(1)}</span></span>
                      <span className="text-text-muted">DR: <span style={{ color }}>{effective.toFixed(1)}</span></span>
                      <span style={{ color: STATUS_ERROR }}>-{savings}%</span>
                    </div>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Code output tabs */}
      <div className="flex items-center gap-1 mb-2">
        {([
          { id: 'header' as const, label: 'GE_AttributeScaling.h' },
          { id: 'source' as const, label: 'GE_AttributeScaling.cpp' },
          { id: 'csv' as const, label: 'Curve Tables (.csv)' },
          { id: 'datatable' as const, label: 'Data Table (.json)' },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setCodeGenTab(tab.id)}
            className="px-2.5 py-1.5 rounded-lg text-2xs font-mono font-bold transition-all border"
            style={{
              backgroundColor: codeGenTab === tab.id ? `${ACCENT}${OPACITY_15}` : 'transparent',
              borderColor: codeGenTab === tab.id ? `${ACCENT}${OPACITY_30}` : 'var(--border)',
              color: codeGenTab === tab.id ? ACCENT : 'var(--text-muted)',
            }}
          >
            {tab.label}
          </button>
        ))}
        <div className="flex-1" />
        <CopyButton getText={getCopyText} accent={ACCENT} />
      </div>

      {/* Code output */}
      <div className="relative bg-[#0d1117] rounded-xl border border-border/40 overflow-hidden">
        <div className="px-3 py-1.5 bg-surface-deep/50 border-b border-border/30 flex items-center gap-2">
          <Code className="w-3 h-3 text-text-muted" />
          <span className="text-2xs font-mono text-text-muted">
            {codeGenTab === 'header' ? 'AbilitySystem/Effects/GE_AttributeScaling.h' :
             codeGenTab === 'source' ? 'AbilitySystem/Effects/GE_AttributeScaling.cpp' :
             codeGenTab === 'csv' ? 'Data/CurveTables/*.csv' :
             'Data/DT_DiminishingReturns.json'}
          </span>
        </div>
        <pre className="p-4 text-2xs font-mono leading-relaxed overflow-x-auto custom-scrollbar max-h-[400px] overflow-y-auto" style={{ color: withOpacity(OVERLAY_WHITE, OPACITY_90) }}>
          {generatedCode}
        </pre>
      </div>

      {/* Effective value comparison chart */}
      <div className="mt-3">
        <div className="text-2xs font-mono text-text-muted uppercase tracking-wider mb-2">Linear vs Diminished Scaling Preview</div>
        <NormalizedLineChart
          height="h-[160px]"
          showGrid={false}
          yLabels={['Max', '0']}
          xLabels={['0 pts', '50 pts', '100 pts']}
          overlay={
            <div className="absolute top-2 right-3 flex flex-col gap-1">
              {drConfigs.map(config => {
                const drAttr = DR_ATTRIBUTES.find(a => a.name === config.attribute);
                const color = drAttr?.color ?? ACCENT;
                return (
                  <div key={config.attribute} className="flex items-center gap-1.5 text-2xs font-mono">
                    <div className="w-3 h-0.5 rounded" style={{ backgroundColor: color }} />
                    <span style={{ color }}>{config.attribute}</span>
                  </div>
                );
              })}
              <div className="flex items-center gap-1.5 text-2xs font-mono text-text-muted mt-0.5">
                <div className="w-3 h-0 border-t border-dashed border-text-muted" />
                <span>Linear (no DR)</span>
              </div>
            </div>
          }
        >
          {drConfigs.map((config) => {
            const drAttr = DR_ATTRIBUTES.find(a => a.name === config.attribute);
            const color = drAttr?.color ?? ACCENT;
            const maxLinear = 100 * config.baseValuePerPoint;
            const points: string[] = [];
            const linearPoints: string[] = [];
            for (let pts = 0; pts <= 100; pts += 5) {
              const x = pts;
              const linearVal = pts * config.baseValuePerPoint;
              linearPoints.push(`${x},${100 - (linearVal / maxLinear) * 90}`);

              let effective: number;
              if (pts <= config.softCap) {
                effective = pts * config.baseValuePerPoint;
              } else {
                const preCap = config.softCap * config.baseValuePerPoint;
                let postCap = 0;
                const maxOver = 100 - config.softCap;
                for (let i = 1; i <= pts - config.softCap; i++) {
                  const t = i / maxOver;
                  postCap += config.baseValuePerPoint * (1.0 - (1.0 - config.postCapMultiplier) * t);
                }
                effective = preCap + postCap;
              }
              points.push(`${x},${100 - (effective / maxLinear) * 90}`);
            }
            return (
              <g key={config.attribute}>
                <polyline
                  points={linearPoints.join(' ')}
                  fill="none" stroke={color} strokeWidth="1" strokeDasharray="3 2"
                  vectorEffect="non-scaling-stroke" opacity={0.3}
                />
                <polyline
                  points={points.join(' ')}
                  fill="none" stroke={color} strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                  style={{ filter: `drop-shadow(0 0 2px ${color})` }}
                />
                <line
                  x1={config.softCap} y1="0" x2={config.softCap} y2="100"
                  stroke={color} strokeWidth="1" strokeDasharray="2 3"
                  vectorEffect="non-scaling-stroke" opacity={0.4}
                />
              </g>
            );
          })}
        </NormalizedLineChart>
      </div>

      {/* UE5 integration note */}
      <div className="mt-2.5 p-3 rounded-lg border" style={{ borderColor: withOpacity(STATUS_WARNING, OPACITY_20), backgroundColor: withOpacity(STATUS_WARNING, OPACITY_10) }}>
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: STATUS_WARNING }} />
          <div className="text-2xs font-mono leading-relaxed" style={{ color: withOpacity(STATUS_WARNING, OPACITY_80) }}>
            <span className="font-bold" style={{ color: STATUS_WARNING }}>UE5 Integration:</span> The generated GE replaces flat{' '}
            <span style={{ color: ACCENT_CYAN_LIGHT }}>AttackPowerPerStrength = 2.0f</span> in ARPGPlayerCharacter.
            Import the CSV as UCurveTable assets and reference them in the GE&apos;s FDiminishingReturnsConfig.
            Call <span style={{ color: ACCENT_CYAN_LIGHT }}>GetEffectiveBonus(AllocatedPoints)</span> from UI to preview values.
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}
