'use client';

import { useMemo, useState, useCallback } from 'react';
import { User, Cpu, Camera, Zap, Keyboard } from 'lucide-react';
import {
  MODULE_COLORS, STATUS_ERROR,
  ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_CYAN,
  OPACITY_8, OPACITY_10, OPACITY_20, OPACITY_30,
} from '@/lib/chart-colors';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { useFeatureMatrix } from '@/hooks/useFeatureMatrix';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { STATUS_COLORS, TabHeader, SectionLabel, FeatureGrid, LoadingSpinner } from './_shared';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';

const ACCENT = MODULE_COLORS.core;

/* ── Class tree ────────────────────────────────────────────────────────────── */

interface ClassNode {
  name: string;
  subtitle?: string;
  color: string;
  children?: ClassNode[];
  crossRef?: string;
}

const CLASS_TREE: ClassNode = {
  name: 'ACharacter',
  subtitle: 'UE5 Base',
  color: '#64748b',
  children: [
    {
      name: 'AARPGCharacterBase',
      subtitle: 'arpg-character',
      color: ACCENT,
      children: [
        {
          name: 'AARPGPlayerCharacter',
          subtitle: 'Player',
          color: ACCENT_EMERALD,
        },
        {
          name: 'AARPGEnemyCharacter',
          subtitle: 'Enemy',
          color: STATUS_ERROR,
          crossRef: 'arpg-enemy-ai',
        },
      ],
    },
  ],
};

/* ── Component slots ───────────────────────────────────────────────────────── */

interface ComponentSlot {
  name: string;
  icon: typeof Cpu;
  featureName: string;
  color: string;
}

const COMPONENT_SLOTS: ComponentSlot[] = [
  { name: 'Enhanced Input',  icon: Keyboard, featureName: 'Enhanced Input actions', color: ACCENT_CYAN },
  { name: 'Camera',          icon: Camera,   featureName: 'Isometric camera',        color: ACCENT_ORANGE },
  { name: 'Movement',        icon: Zap,      featureName: 'WASD movement',            color: ACCENT_EMERALD },
  { name: 'Mesh',            icon: User,     featureName: 'AARPGCharacterBase',       color: ACCENT },
  { name: 'ASC',             icon: Cpu,      featureName: 'AARPGPlayerCharacter',     color: MODULE_COLORS.systems },
];

/* ── Input bindings ────────────────────────────────────────────────────────── */

interface InputBinding {
  action: string;
  defaultKey: string;
  handler: string;
  featureName: string;
}

const INPUT_BINDINGS: InputBinding[] = [
  { action: 'IA_Move',          defaultKey: 'WASD',  handler: 'HandleMove',         featureName: 'WASD movement' },
  { action: 'IA_Look',          defaultKey: 'Mouse', handler: 'HandleLook',         featureName: 'Isometric camera' },
  { action: 'IA_Interact',      defaultKey: 'E',     handler: 'HandleInteract',     featureName: 'AARPGPlayerCharacter' },
  { action: 'IA_PrimaryAttack', defaultKey: 'LMB',   handler: 'HandlePrimaryAttack', featureName: 'AARPGPlayerCharacter' },
  { action: 'IA_Dodge',         defaultKey: 'Space', handler: 'HandleDodge',        featureName: 'Dodge/dash' },
  { action: 'IA_Sprint',        defaultKey: 'Shift', handler: 'HandleSprint',       featureName: 'Sprint system' },
];

/* ── Movement states ───────────────────────────────────────────────────────── */

const MOVEMENT_STATES = [
  { label: 'Idle',   color: '#64748b' },
  { label: 'Walk',   color: ACCENT },
  { label: 'Run',    color: ACCENT_CYAN },
  { label: 'Sprint', color: ACCENT_ORANGE },
  { label: 'Dodge',  color: STATUS_ERROR },
];

/* ── Feature names ─────────────────────────────────────────────────────────── */

const CHARACTER_FEATURES = [
  'AARPGCharacterBase',
  'AARPGPlayerCharacter',
  'AARPGPlayerController',
  'Enhanced Input actions',
  'Isometric camera',
  'WASD movement',
  'Sprint system',
  'Dodge/dash',
  'AARPGGameMode',
  'UARPGGameInstance',
];

/* ── Component ─────────────────────────────────────────────────────────────── */

interface CharacterBlueprintProps {
  moduleId: SubModuleId;
}

export function CharacterBlueprint({ moduleId }: CharacterBlueprintProps) {
  const { features, isLoading } = useFeatureMatrix(moduleId);
  const defs = useMemo(() => MODULE_FEATURE_DEFINITIONS[moduleId] ?? [], [moduleId]);

  const featureMap = useMemo(() => {
    const map = new Map<string, FeatureRow>();
    for (const f of features) map.set(f.featureName, f);
    return map;
  }, [features]);

  const stats = useMemo(() => {
    let implemented = 0;
    for (const name of CHARACTER_FEATURES) {
      const status = featureMap.get(name)?.status ?? 'unknown';
      if (status === 'implemented' || status === 'improved') implemented++;
    }
    return { total: CHARACTER_FEATURES.length, implemented };
  }, [featureMap]);

  const [expanded, setExpanded] = useState<string | null>(null);
  const toggleExpand = useCallback((name: string) => {
    setExpanded((prev) => (prev === name ? null : name));
  }, []);

  if (isLoading) return <LoadingSpinner accent={ACCENT} />;

  return (
    <div className="space-y-3">
      {/* Header */}
      <TabHeader icon={User} title="Character Blueprint" implemented={stats.implemented} total={stats.total} accent={ACCENT} />

      {/* Class tree */}
      <SurfaceCard level={2} className="p-3">
        <div className="text-2xs text-text-muted font-medium uppercase tracking-wider mb-3">Class Hierarchy</div>
        <ClassTreeNode node={CLASS_TREE} depth={0} />
      </SurfaceCard>

      {/* Component strip */}
      <SurfaceCard level={2} className="p-3">
        <div className="text-2xs text-text-muted font-medium uppercase tracking-wider mb-3">Component Slots</div>
        <div className="flex flex-wrap gap-2">
          {COMPONENT_SLOTS.map((slot) => {
            const status: FeatureStatus = featureMap.get(slot.featureName)?.status ?? 'unknown';
            const sc = STATUS_COLORS[status];
            const SlotIcon = slot.icon;
            return (
              <div
                key={slot.name}
                className="flex flex-col items-center gap-1.5 px-3 py-2 rounded-lg border"
                style={{ borderColor: `${slot.color}${OPACITY_30}`, backgroundColor: `${slot.color}${OPACITY_8}` }}
              >
                <SlotIcon className="w-4 h-4" style={{ color: slot.color }} />
                <span className="text-2xs font-medium text-text">{slot.name}</span>
                <span className="flex items-center gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc.dot }} />
                  <span className="text-2xs" style={{ color: sc.dot }}>{sc.label}</span>
                </span>
              </div>
            );
          })}
        </div>
      </SurfaceCard>

      {/* Movement state bar */}
      <SurfaceCard level={2} className="p-3">
        <div className="mb-3"><SectionLabel icon={Zap} label="Movement States" /></div>
        <div className="flex items-center gap-1 flex-wrap">
          {MOVEMENT_STATES.map((state, i, arr) => (
            <span key={state.label} className="flex items-center gap-1">
              <span
                className="text-xs font-mono px-2.5 py-1 rounded-md border"
                style={{
                  borderColor: `${state.color}${OPACITY_30}`,
                  backgroundColor: `${state.color}${OPACITY_10}`,
                  color: state.color,
                }}
              >
                {state.label}
              </span>
              {i < arr.length - 1 && (
                <span className="text-text-muted text-xs">&rarr;</span>
              )}
            </span>
          ))}
        </div>
        <div className="flex gap-3 mt-2 text-2xs text-text-muted">
          <span>Sprint: Shift held</span>
          <span>Dodge: Space (cooldown)</span>
        </div>
      </SurfaceCard>

      {/* Input binding table */}
      <SurfaceCard level={2} className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <Keyboard className="w-3.5 h-3.5" style={{ color: ACCENT_CYAN }} />
          <span className="text-xs font-semibold text-text">Input Bindings</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-2xs">
            <thead>
              <tr className="border-b border-border/40">
                <th className="text-left text-text-muted font-medium pb-1.5 pr-4">Action</th>
                <th className="text-left text-text-muted font-medium pb-1.5 pr-4">Default Key</th>
                <th className="text-left text-text-muted font-medium pb-1.5 pr-4">Handler</th>
                <th className="text-left text-text-muted font-medium pb-1.5">Status</th>
              </tr>
            </thead>
            <tbody className="space-y-0.5">
              {INPUT_BINDINGS.map((binding) => {
                const status: FeatureStatus = featureMap.get(binding.featureName)?.status ?? 'unknown';
                const sc = STATUS_COLORS[status];
                return (
                  <tr key={binding.action} className="border-b border-border/20">
                    <td className="py-1.5 pr-4">
                      <span className="font-mono text-text">{binding.action}</span>
                    </td>
                    <td className="py-1.5 pr-4">
                      <span
                        className="font-mono px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: `${ACCENT_CYAN}${OPACITY_10}`, color: ACCENT_CYAN }}
                      >
                        {binding.defaultKey}
                      </span>
                    </td>
                    <td className="py-1.5 pr-4">
                      <span className="font-mono text-text-muted">{binding.handler}</span>
                    </td>
                    <td className="py-1.5">
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc.dot }} />
                        <span style={{ color: sc.dot }}>{sc.label}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SurfaceCard>

      {/* Feature status list */}
      <FeatureGrid featureNames={CHARACTER_FEATURES} featureMap={featureMap} defs={defs} expanded={expanded} onToggle={toggleExpand} accent={ACCENT} />
    </div>
  );
}

/* ── Class tree node ───────────────────────────────────────────────────────── */

function ClassTreeNode({ node, depth }: { node: ClassNode; depth: number }) {
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div style={{ paddingLeft: depth === 0 ? 0 : 20 }}>
      <div className="relative flex items-center gap-2 py-1">
        {depth > 0 && (
          <span
            className="absolute left-[-12px] top-1/2 w-3 border-t"
            style={{ borderColor: `${node.color}40` }}
          />
        )}
        <span
          className="text-xs font-mono font-semibold px-2 py-0.5 rounded border"
          style={{
            borderColor: `${node.color}${OPACITY_30}`,
            backgroundColor: `${node.color}${OPACITY_10}`,
            color: node.color,
          }}
        >
          {node.name}
        </span>
        {node.subtitle && (
          <span className="text-2xs text-text-muted">{node.subtitle}</span>
        )}
        {node.crossRef && (
          <span
            className="text-2xs px-1.5 py-0.5 rounded font-mono"
            style={{ backgroundColor: `${STATUS_ERROR}${OPACITY_8}`, color: STATUS_ERROR }}
          >
            &rarr; {node.crossRef}
          </span>
        )}
      </div>
      {hasChildren && (
        <div
          className="border-l ml-2"
          style={{ borderColor: `${node.color}${OPACITY_20}` }}
        >
          {node.children!.map((child) => (
            <ClassTreeNode key={child.name} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
