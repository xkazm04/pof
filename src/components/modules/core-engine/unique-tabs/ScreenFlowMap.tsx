'use client';

import { useMemo, useState, useCallback } from 'react';
import { Monitor, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import {
  MODULE_COLORS, STATUS_WARNING,
  ACCENT_PINK,
  OPACITY_8, OPACITY_10, OPACITY_20, OPACITY_30,
} from '@/lib/chart-colors';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { useFeatureMatrix } from '@/hooks/useFeatureMatrix';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { STATUS_COLORS, TabHeader, LoadingSpinner } from './_shared';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';

const ACCENT = ACCENT_PINK;

/* ── Screen node definitions ───────────────────────────────────────────────── */

type InputMode = 'Game' | 'UI' | 'GameAndUI';

const INPUT_MODE_COLORS: Record<InputMode, string> = {
  Game:        MODULE_COLORS.core,
  UI:          ACCENT_PINK,
  GameAndUI:   MODULE_COLORS.systems,
};

interface ScreenNode {
  id: string;
  featureName: string;
  inputMode: InputMode;
  subWidgets: string[];
  description: string;
  trigger?: string;
}

const HUD_CHILDREN: ScreenNode[] = [
  {
    id: 'hud-health',
    featureName: 'GAS attribute binding',
    inputMode: 'Game',
    subWidgets: ['WBP_HealthBar', 'WBP_ManaBar'],
    description: 'Real-time attribute delegates update bar fill percentage',
    trigger: 'Always visible',
  },
  {
    id: 'hud-abilities',
    featureName: 'Ability cooldown UI',
    inputMode: 'Game',
    subWidgets: ['WBP_AbilitySlot x4', 'WBP_CooldownSweep'],
    description: 'Ability slots with icon, cooldown sweep, keybind label',
    trigger: 'Always visible',
  },
];

const HUD_OVERLAYS: ScreenNode[] = [
  {
    id: 'inventory',
    featureName: 'Inventory screen',
    inputMode: 'UI',
    subWidgets: ['WBP_ItemGrid', 'WBP_Tooltip', 'WBP_EquipPanel'],
    description: 'Grid inventory with drag-and-drop and equipment panel',
    trigger: 'Tab',
  },
  {
    id: 'char-stats',
    featureName: 'Character stats screen',
    inputMode: 'UI',
    subWidgets: ['WBP_StatRow', 'WBP_AttributeTotal'],
    description: 'All attributes with base + bonus display',
    trigger: 'C',
  },
  {
    id: 'pause',
    featureName: 'Pause/settings menus',
    inputMode: 'UI',
    subWidgets: ['WBP_PauseMenu', 'WBP_SettingsPanel'],
    description: 'Pause menu with graphics, audio, controls settings',
    trigger: 'Esc',
  },
];

const FLOATING_NODES: ScreenNode[] = [
  {
    id: 'enemy-bars',
    featureName: 'Enemy health bars',
    inputMode: 'GameAndUI',
    subWidgets: ['WBP_EnemyHealthBar', 'UWidgetComponent'],
    description: 'Floating UWidgetComponent with fade-in/out behavior',
    trigger: 'On damage',
  },
  {
    id: 'damage-numbers',
    featureName: 'Floating damage numbers',
    inputMode: 'Game',
    subWidgets: ['WBP_DamageText', 'WBP_CritText'],
    description: 'Damage text at hit location, colored by type, crit variant',
    trigger: 'On hit',
  },
];

/* ── Component ─────────────────────────────────────────────────────────────── */

interface ScreenFlowMapProps {
  moduleId: SubModuleId;
}

export function ScreenFlowMap({ moduleId }: ScreenFlowMapProps) {
  const { features, isLoading } = useFeatureMatrix(moduleId);
  const defs = useMemo(() => MODULE_FEATURE_DEFINITIONS[moduleId] ?? [], [moduleId]);
  const [expandedNode, setExpandedNode] = useState<string | null>(null);

  const featureMap = useMemo(() => {
    const map = new Map<string, FeatureRow>();
    for (const f of features) map.set(f.featureName, f);
    return map;
  }, [features]);

  const stats = useMemo(() => {
    const total = defs.length;
    let implemented = 0, partial = 0;
    for (const d of defs) {
      const s = featureMap.get(d.featureName)?.status ?? 'unknown';
      if (s === 'implemented' || s === 'improved') implemented++;
      else if (s === 'partial') partial++;
    }
    return { total, implemented, partial };
  }, [defs, featureMap]);

  const toggleNode = useCallback((id: string) => {
    setExpandedNode((prev) => (prev === id ? null : id));
  }, []);

  if (isLoading) return <LoadingSpinner accent={ACCENT} />;

  const hudStatus: FeatureStatus = featureMap.get('Main HUD widget')?.status ?? 'unknown';
  const hudSc = STATUS_COLORS[hudStatus];

  return (
    <div className="space-y-3">
      {/* Header */}
      <TabHeader icon={Monitor} title="Screen Flow Map" implemented={stats.implemented} total={stats.total} accent={ACCENT}>
        {stats.partial > 0 && (
          <span className="flex items-center gap-1 text-2xs">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_WARNING }} />
            {stats.partial} partial
          </span>
        )}
      </TabHeader>

      {/* HUD root node */}
      <SurfaceCard level={2} className="p-3">
        <div className="text-2xs text-text-muted font-medium uppercase tracking-wider mb-2">HUD Root</div>
        <button
          onClick={() => toggleNode('hud-root')}
          className="w-full text-left"
        >
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg border"
            style={{ borderColor: `${ACCENT}50`, backgroundColor: `${ACCENT}${OPACITY_10}` }}
          >
            {expandedNode === 'hud-root'
              ? <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0" />
              : <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0" />}
            <span className="text-xs font-semibold text-text">Main HUD</span>
            <InputModeBadge mode="GameAndUI" />
            <span className="ml-auto flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: hudSc.dot }} />
              <span className="text-2xs" style={{ color: hudSc.dot }}>{hudSc.label}</span>
            </span>
          </div>
        </button>

        {expandedNode === 'hud-root' && (
          <div className="mt-2 pl-4 space-y-1 border-t border-border/40 pt-2">
            {(() => {
              const row = featureMap.get('Main HUD widget');
              const def = defs.find((d) => d.featureName === 'Main HUD widget');
              return (
                <>
                  <p className="text-2xs text-text-muted">{def?.description ?? row?.description ?? 'No description'}</p>
                  {row?.nextSteps && <p className="text-2xs" style={{ color: STATUS_WARNING }}>Next: {row.nextSteps}</p>}
                </>
              );
            })()}
          </div>
        )}

        {/* HUD children */}
        <div className="mt-2 pl-4 space-y-1">
          {HUD_CHILDREN.map((node) => (
            <ScreenNodeRow
              key={node.id}
              node={node}
              featureMap={featureMap}
              defs={defs}
              expandedNode={expandedNode}
              onToggle={toggleNode}
              arrowLabel={node.trigger}
            />
          ))}
        </div>
      </SurfaceCard>

      {/* Overlay screens */}
      <SurfaceCard level={2} className="p-3">
        <div className="text-2xs text-text-muted font-medium uppercase tracking-wider mb-2">Overlay Screens</div>
        <div className="space-y-1">
          {HUD_OVERLAYS.map((node) => (
            <ScreenNodeRow
              key={node.id}
              node={node}
              featureMap={featureMap}
              defs={defs}
              expandedNode={expandedNode}
              onToggle={toggleNode}
              arrowLabel={node.trigger}
              fromLabel="HUD"
            />
          ))}
        </div>
      </SurfaceCard>

      {/* Floating elements */}
      <SurfaceCard level={2} className="p-3">
        <div className="text-2xs text-text-muted font-medium uppercase tracking-wider mb-2">Floating Elements</div>
        <div className="space-y-1">
          {FLOATING_NODES.map((node) => (
            <ScreenNodeRow
              key={node.id}
              node={node}
              featureMap={featureMap}
              defs={defs}
              expandedNode={expandedNode}
              onToggle={toggleNode}
              arrowLabel={node.trigger}
            />
          ))}
        </div>
      </SurfaceCard>

      {/* Input mode legend */}
      <SurfaceCard level={2} className="p-3">
        <div className="text-2xs text-text-muted font-medium uppercase tracking-wider mb-2">Input Mode Legend</div>
        <div className="flex items-center gap-4 flex-wrap">
          {(Object.entries(INPUT_MODE_COLORS) as [InputMode, string][]).map(([mode, color]) => (
            <span key={mode} className="flex items-center gap-1.5 text-2xs">
              <span
                className="px-1.5 py-px rounded text-2xs font-medium"
                style={{ backgroundColor: `${color}${OPACITY_20}`, color }}
              >
                {mode}
              </span>
              <span className="text-text-muted">
                {mode === 'Game' ? 'cursor hidden' : mode === 'UI' ? 'cursor shown, game paused' : 'cursor shown, game active'}
              </span>
            </span>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Screen node row ───────────────────────────────────────────────────────── */

function ScreenNodeRow({
  node,
  featureMap,
  defs,
  expandedNode,
  onToggle,
  arrowLabel,
  fromLabel,
}: {
  node: ScreenNode;
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
  expandedNode: string | null;
  onToggle: (id: string) => void;
  arrowLabel?: string;
  fromLabel?: string;
}) {
  const row = featureMap.get(node.featureName);
  const def = defs.find((d) => d.featureName === node.featureName);
  const status: FeatureStatus = row?.status ?? 'unknown';
  const sc = STATUS_COLORS[status];
  const isExpanded = expandedNode === node.id;

  return (
    <SurfaceCard level={2}>
      <button
        onClick={() => onToggle(node.id)}
        className="w-full text-left px-3 py-2 hover:bg-surface-hover/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded
            ? <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0" />
            : <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0" />}
          {fromLabel && (
            <span className="text-2xs text-text-muted">{fromLabel} &rarr;</span>
          )}
          <span className="text-xs font-medium text-text">{node.featureName}</span>
          <InputModeBadge mode={node.inputMode} />
          {arrowLabel && (
            <span
              className="text-2xs px-1.5 py-px rounded font-mono ml-1"
              style={{ backgroundColor: `${ACCENT}${OPACITY_10}`, color: ACCENT }}
            >
              {arrowLabel}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sc.dot }} />
            <span className="text-2xs" style={{ color: sc.dot }}>{sc.label}</span>
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="px-3 pb-2 border-t border-border/40 space-y-2">
          <p className="text-2xs text-text-muted leading-relaxed mt-1.5">
            {def?.description ?? row?.description ?? 'No description'}
          </p>

          {/* Sub-widget list */}
          <div className="flex flex-wrap gap-1">
            {node.subWidgets.map((w) => (
              <span
                key={w}
                className="text-2xs font-mono px-1.5 py-px rounded"
                style={{ backgroundColor: `${ACCENT}${OPACITY_8}`, color: ACCENT }}
              >
                {w}
              </span>
            ))}
          </div>

          {row?.filePaths && row.filePaths.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {row.filePaths.slice(0, 3).map((fp) => (
                <span key={fp} className="flex items-center gap-0.5 text-2xs font-mono" style={{ color: ACCENT }}>
                  <ExternalLink className="w-2.5 h-2.5" />
                  {fp.split('/').pop()}
                </span>
              ))}
            </div>
          )}

          {row?.nextSteps && (
            <p className="text-2xs" style={{ color: STATUS_WARNING }}>Next: {row.nextSteps}</p>
          )}
        </div>
      )}
    </SurfaceCard>
  );
}

/* ── Input mode badge ──────────────────────────────────────────────────────── */

function InputModeBadge({ mode }: { mode: InputMode }) {
  const color = INPUT_MODE_COLORS[mode];
  return (
    <span
      className="text-2xs px-1.5 py-px rounded font-medium"
      style={{ backgroundColor: `${color}${OPACITY_20}`, color }}
    >
      {mode}
    </span>
  );
}
