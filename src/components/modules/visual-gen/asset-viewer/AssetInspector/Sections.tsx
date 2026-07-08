'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  STATUS_SUCCESS,
  STATUS_WARNING,
  STATUS_ERROR,
} from '@/lib/chart-colors';
import {
  formatMeters,
  formatNumber,
  type AssetBudget,
  type AssetStats,
  type BudgetViolation,
} from '../assetStats';
import { Section, Row } from './Section';

export function GeometrySection({
  stats,
  budget,
  violations,
}: {
  stats: AssetStats;
  budget: AssetBudget;
  violations: BudgetViolation[];
}) {
  const trisOver = violations.some((v) => v.metric === 'triangles');
  const drawsOver = violations.some((v) => v.metric === 'drawCalls');
  return (
    <Section title="Geometry">
      <Row label="Triangles" value={formatNumber(stats.triangles)} highlight={trisOver} />
      <Row label="Vertices" value={formatNumber(stats.vertices)} />
      <Row label="Meshes" value={String(stats.meshes)} />
      <Row
        label="Draw Calls"
        value={`${stats.drawCalls} / ${budget.maxDrawCalls}`}
        highlight={drawsOver}
      />
    </Section>
  );
}

export function BoundingBoxSection({ stats }: { stats: AssetStats }) {
  const { width, height, depth } = stats.boundingBox;
  return (
    <Section title="Bounding Box (m)">
      <Row label="Width (X)" value={formatMeters(width)} />
      <Row label="Height (Y)" value={formatMeters(height)} />
      <Row label="Depth (Z)" value={formatMeters(depth)} />
    </Section>
  );
}

export function MaterialsSection({ stats, budget }: { stats: AssetStats; budget: AssetBudget }) {
  const over = stats.materials.length > budget.maxMaterials;
  return (
    <Section
      title={`Materials (${stats.materials.length} / ${budget.maxMaterials})`}
      rightContent={
        over ? (
          <AlertTriangle size={12} style={{ color: STATUS_ERROR }} />
        ) : (
          <CheckCircle2 size={12} style={{ color: STATUS_SUCCESS }} />
        )
      }
    >
      {stats.materials.length === 0 ? (
        <div className="text-text-muted">No materials</div>
      ) : (
        <ul className="space-y-0.5">
          {stats.materials.map((m, i) => (
            <li key={`${m.name}-${i}`} className="flex justify-between gap-2 truncate">
              <span className="truncate text-text" title={m.name}>
                {m.name}
              </span>
              <span className="shrink-0 text-text-muted">
                {m.type.replace('Material', '')} · {m.textureCount} tex
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export function TexturesSection({ stats, budget }: { stats: AssetStats; budget: AssetBudget }) {
  const overSized = stats.textures.filter(
    (t) => Math.max(t.width, t.height) > budget.maxTextureSize,
  );
  return (
    <Section
      title={`Textures (${stats.textures.length})`}
      rightContent={
        overSized.length > 0 ? (
          <span
            className="text-[10px] font-semibold"
            style={{ color: STATUS_ERROR }}
          >
            {overSized.length} over {budget.maxTextureSize}px
          </span>
        ) : (
          <CheckCircle2 size={12} style={{ color: STATUS_SUCCESS }} />
        )
      }
    >
      {stats.textures.length === 0 ? (
        <div className="text-text-muted">No textures</div>
      ) : (
        <ul className="space-y-0.5">
          {stats.textures.map((t, i) => {
            const dim = Math.max(t.width, t.height);
            const over = dim > budget.maxTextureSize;
            return (
              <li
                key={`${t.name}-${i}`}
                className="flex justify-between gap-2 truncate"
                style={over ? { color: STATUS_ERROR } : undefined}
              >
                <span className="truncate" title={t.name}>
                  {t.name}
                </span>
                <span className="shrink-0 flex items-center gap-1 text-text-muted">
                  {!t.isPowerOfTwo && t.width > 0 && (
                    <span title="Not power-of-two" style={{ color: STATUS_WARNING }}>NPOT</span>
                  )}
                  <span style={over ? { color: STATUS_ERROR } : undefined}>
                    {t.width}×{t.height}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

export function AnimationsSection({ stats }: { stats: AssetStats }) {
  return (
    <Section title={`Animations (${stats.animations.length})`}>
      {stats.animations.length === 0 ? (
        <div className="text-text-muted">No embedded clips</div>
      ) : (
        <ul className="space-y-0.5">
          {stats.animations.map((a, i) => (
            <li key={`${a.name}-${i}`} className="flex justify-between gap-2 truncate">
              <span className="truncate text-text" title={a.name}>
                {a.name}
              </span>
              <span className="shrink-0 text-text-muted">
                {a.duration.toFixed(2)}s · {a.trackCount} tr
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
