'use client';

import { useCallback, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Info, Settings2 } from 'lucide-react';
import {
  STATUS_SUCCESS,
  STATUS_WARNING,
  STATUS_ERROR,
  STATUS_INFO,
  STATUS_NEUTRAL,
} from '@/lib/chart-colors';
import {
  findBudgetViolations,
  formatMeters,
  formatNumber,
  UE5_PRESETS,
  type AssetBudget,
  type AssetStats,
  type BudgetViolation,
} from './assetStats';
import { useViewerStore } from './useViewerStore';

interface AssetInspectorProps {
  modelName: string | null;
}

export function AssetInspector({ modelName }: AssetInspectorProps) {
  const stats = useViewerStore((s) => s.stats);
  const budget = useViewerStore((s) => s.budget);
  const setBudget = useViewerStore((s) => s.setBudget);

  const violations = useMemo<BudgetViolation[]>(
    () => (stats ? findBudgetViolations(stats, budget) : []),
    [stats, budget],
  );

  const overBudget = violations.length > 0;

  return (
    <aside
      className="flex flex-col h-full w-[320px] shrink-0 border-l border-border bg-surface/40 overflow-hidden"
      aria-label="Asset inspector"
    >
      <header className="px-3 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Info size={14} className="text-text-muted" />
          <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Inspector
          </span>
        </div>
        <BudgetBadge overBudget={overBudget} hasStats={!!stats} />
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 text-xs">
        {!stats ? (
          <EmptyInspector />
        ) : (
          <>
            <ModelSummary modelName={modelName} stats={stats} />
            <BudgetSection
              budget={budget}
              violations={violations}
              onChange={setBudget}
            />
            <GeometrySection stats={stats} budget={budget} violations={violations} />
            <BoundingBoxSection stats={stats} />
            <MaterialsSection stats={stats} budget={budget} />
            <TexturesSection stats={stats} budget={budget} />
            <AnimationsSection stats={stats} />
          </>
        )}
      </div>
    </aside>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function BudgetBadge({ overBudget, hasStats }: { overBudget: boolean; hasStats: boolean }) {
  if (!hasStats) {
    return (
      <span className="text-[10px] uppercase tracking-wide" style={{ color: STATUS_NEUTRAL }}>
        idle
      </span>
    );
  }
  return overBudget ? (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide"
      style={{ color: STATUS_ERROR, backgroundColor: `${STATUS_ERROR}1a` }}
    >
      <AlertTriangle size={10} /> Over budget
    </span>
  ) : (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide"
      style={{ color: STATUS_SUCCESS, backgroundColor: `${STATUS_SUCCESS}1a` }}
    >
      <CheckCircle2 size={10} /> Within budget
    </span>
  );
}

function EmptyInspector() {
  return (
    <div className="text-text-muted text-xs leading-relaxed">
      Load a model with the toolbar <span className="text-text">Load Model</span> button.
      The inspector will report triangles, materials, textures, bounding box, and
      animation clips, and flag anything that exceeds your UE5 budget.
    </div>
  );
}

function ModelSummary({
  modelName,
  stats,
}: {
  modelName: string | null;
  stats: AssetStats;
}) {
  return (
    <div>
      <div className="text-text font-medium truncate" title={modelName ?? undefined}>
        {modelName ?? 'Unnamed asset'}
      </div>
      <div className="text-text-muted">
        {stats.meshes} mesh{stats.meshes === 1 ? '' : 'es'} · {stats.materials.length} mat
        · {stats.textures.length} tex · {stats.animations.length} clip
        {stats.animations.length === 1 ? '' : 's'}
      </div>
    </div>
  );
}

function BudgetSection({
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

function GeometrySection({
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

function BoundingBoxSection({ stats }: { stats: AssetStats }) {
  const { width, height, depth } = stats.boundingBox;
  return (
    <Section title="Bounding Box (m)">
      <Row label="Width (X)" value={formatMeters(width)} />
      <Row label="Height (Y)" value={formatMeters(height)} />
      <Row label="Depth (Z)" value={formatMeters(depth)} />
    </Section>
  );
}

function MaterialsSection({ stats, budget }: { stats: AssetStats; budget: AssetBudget }) {
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

function TexturesSection({ stats, budget }: { stats: AssetStats; budget: AssetBudget }) {
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

function AnimationsSection({ stats }: { stats: AssetStats }) {
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

// ── Layout primitives ────────────────────────────────────────────────────────

function Section({
  title,
  icon,
  rightContent,
  open: openProp,
  onToggle,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  rightContent?: React.ReactNode;
  open?: boolean;
  onToggle?: () => void;
  children: React.ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(true);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : internalOpen;
  const toggle = controlled ? onToggle : () => setInternalOpen((v) => !v);

  return (
    <section className="rounded border border-border bg-surface/60">
      <button
        onClick={toggle}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 hover:bg-surface transition-colors text-left"
      >
        {open ? (
          <ChevronDown size={12} className="text-text-muted" />
        ) : (
          <ChevronRight size={12} className="text-text-muted" />
        )}
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-wide text-text flex-1">
          {title}
        </span>
        {rightContent}
      </button>
      {open && <div className="px-2 pb-2 pt-1 space-y-1">{children}</div>}
    </section>
  );
}

function Row({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-text-muted">{label}</span>
      <span
        className="font-mono"
        style={highlight ? { color: STATUS_ERROR } : { color: STATUS_INFO }}
      >
        {value}
      </span>
    </div>
  );
}
