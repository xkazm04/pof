'use client';

import { useMemo, useState, useCallback } from 'react';
import { User, Cpu, Camera, Zap, Keyboard, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  { name: 'Enhanced Input', icon: Keyboard, featureName: 'Enhanced Input actions', color: ACCENT_CYAN },
  { name: 'Camera', icon: Camera, featureName: 'Isometric camera', color: ACCENT_ORANGE },
  { name: 'Movement', icon: Zap, featureName: 'WASD movement', color: ACCENT_EMERALD },
  { name: 'Mesh', icon: User, featureName: 'AARPGCharacterBase', color: ACCENT },
  { name: 'ASC', icon: Cpu, featureName: 'AARPGPlayerCharacter', color: MODULE_COLORS.systems },
];

/* ── Input bindings ────────────────────────────────────────────────────────── */

interface InputBinding {
  action: string;
  defaultKey: string;
  handler: string;
  featureName: string;
}

const INPUT_BINDINGS: InputBinding[] = [
  { action: 'IA_Move', defaultKey: 'WASD', handler: 'HandleMove', featureName: 'WASD movement' },
  { action: 'IA_Look', defaultKey: 'Mouse', handler: 'HandleLook', featureName: 'Isometric camera' },
  { action: 'IA_Interact', defaultKey: 'E', handler: 'HandleInteract', featureName: 'AARPGPlayerCharacter' },
  { action: 'IA_PrimaryAttack', defaultKey: 'LMB', handler: 'HandlePrimaryAttack', featureName: 'AARPGPlayerCharacter' },
  { action: 'IA_Dodge', defaultKey: 'Space', handler: 'HandleDodge', featureName: 'Dodge/dash' },
  { action: 'IA_Sprint', defaultKey: 'Shift', handler: 'HandleSprint', featureName: 'Sprint system' },
];

/* ── Movement states ───────────────────────────────────────────────────────── */

const MOVEMENT_STATES = [
  { label: 'Idle', color: '#64748b' },
  { label: 'Walk', color: ACCENT },
  { label: 'Run', color: ACCENT_CYAN },
  { label: 'Sprint', color: ACCENT_ORANGE },
  { label: 'Dodge', color: STATUS_ERROR },
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
    <div className="space-y-4">
      {/* Header */}
      <TabHeader icon={User} title="Character Blueprint" implemented={stats.implemented} total={stats.total} accent={ACCENT} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Class tree & Movement */}
        <div className="space-y-4">
          <SurfaceCard level={2} className="p-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full pointer-events-none" />
            <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-4 flex items-center gap-2 relative z-10">
              <User className="w-4 h-4 text-blue-400" /> Class Hierarchy
            </div>
            <div className="bg-surface-deep/50 p-4 rounded-xl border border-border/40 relative z-10">
              <ClassTreeNode node={CLASS_TREE} depth={0} />
            </div>
          </SurfaceCard>

          <SurfaceCard level={2} className="p-4 relative">
            <div className="mb-4"><SectionLabel icon={Zap} label="Movement States Flow" /></div>
            <div className="flex flex-wrap gap-2 items-center">
              {MOVEMENT_STATES.map((state, i, arr) => (
                <span key={state.label} className="flex items-center gap-2">
                  <motion.span
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg border shadow-sm"
                    style={{
                      borderColor: `${state.color}50`,
                      backgroundColor: `${state.color}15`,
                      color: state.color,
                    }}
                  >
                    {state.label}
                  </motion.span>
                  {i < arr.length - 1 && (
                    <span className="text-text-muted text-xs mx-0.5">&rarr;</span>
                  )}
                </span>
              ))}
            </div>
            <div className="flex gap-4 mt-4 text-xs font-mono text-text-muted bg-surface/50 p-2 rounded-lg border border-border/30">
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-orange-400" /> Sprint: Shift held</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Dodge: Space (cooldown)</span>
            </div>
          </SurfaceCard>
        </div>

        {/* Components & Bindings */}
        <div className="space-y-4">
          <SurfaceCard level={2} className="p-4 relative group overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-[rgba(255,255,255,0.02)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
            <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-4 flex items-center gap-2 relative z-10">
              <Cpu className="w-4 h-4 text-cyan-400" /> Component Slots
            </div>
            <div className="grid grid-cols-2 gap-3 relative z-10">
              {COMPONENT_SLOTS.map((slot, i) => {
                const status: FeatureStatus = featureMap.get(slot.featureName)?.status ?? 'unknown';
                const sc = STATUS_COLORS[status];
                const SlotIcon = slot.icon;
                return (
                  <motion.div
                    key={slot.name}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    whileHover={{ scale: 1.02 }}
                    className="flex flex-col gap-2 p-3 rounded-xl border relative overflow-hidden"
                    style={{ borderColor: `${slot.color}30`, backgroundColor: `${slot.color}10` }}
                  >
                    <div className="absolute -right-2 -bottom-2 opacity-10">
                      <SlotIcon className="w-12 h-12" style={{ color: slot.color }} />
                    </div>
                    <div className="flex justify-between items-start">
                      <SlotIcon className="w-5 h-5" style={{ color: slot.color, filter: `drop-shadow(0 0 4px ${slot.color}80)` }} />
                      <span className="flex items-center gap-1.5 bg-surface-deep px-1.5 py-0.5 rounded shadow-sm border border-border/40">
                        <span className="w-1.5 h-1.5 rounded-full shadow-[0_0_5px_currentColor]" style={{ backgroundColor: sc.dot, color: sc.dot }} />
                        <span className="text-[10px] font-bold uppercase" style={{ color: sc.dot }}>{sc.label}</span>
                      </span>
                    </div>
                    <span className="text-xs font-bold text-text mt-1 truncate">{slot.name}</span>
                  </motion.div>
                );
              })}
            </div>
          </SurfaceCard>

          <SurfaceCard level={2} className="p-4 relative">
            <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-4 flex items-center gap-2">
              <Keyboard className="w-4 h-4 text-emerald-400" /> Input Bindings
            </div>
            <div className="overflow-x-auto custom-scrollbar pb-2">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className="font-bold text-text-muted pb-2 pr-4 uppercase tracking-wider text-[10px]">Action</th>
                    <th className="font-bold text-text-muted pb-2 pr-4 uppercase tracking-wider text-[10px]">Key</th>
                    <th className="font-bold text-text-muted pb-2 pr-4 uppercase tracking-wider text-[10px]">Handler</th>
                    <th className="font-bold text-text-muted pb-2 uppercase tracking-wider text-[10px]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {INPUT_BINDINGS.map((binding, i) => {
                    const status: FeatureStatus = featureMap.get(binding.featureName)?.status ?? 'unknown';
                    const sc = STATUS_COLORS[status];
                    return (
                      <motion.tr
                        key={binding.action}
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                        className="hover:bg-surface/30 transition-colors"
                      >
                        <td className="py-2 pr-4">
                          <span className="font-mono text-text font-medium">{binding.action}</span>
                        </td>
                        <td className="py-2 pr-4">
                          <span
                            className="font-mono text-[10px] px-2 py-0.5 rounded-md font-bold shadow-sm"
                            style={{ backgroundColor: `${ACCENT_CYAN}15`, color: ACCENT_CYAN, border: `1px solid ${ACCENT_CYAN}40` }}
                          >
                            {binding.defaultKey}
                          </span>
                        </td>
                        <td className="py-2 pr-4">
                          <span className="font-mono text-text-muted">{binding.handler}</span>
                        </td>
                        <td className="py-2">
                          <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full shadow-[0_0_5px_currentColor]" style={{ backgroundColor: sc.dot, color: sc.dot }} />
                            <span className="text-[10px] uppercase font-bold" style={{ color: sc.dot }}>{sc.label}</span>
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SurfaceCard>
        </div>
      </div>

      {/* Feature status list */}
      <SurfaceCard level={2} className="p-4">
        <div className="mb-4"><SectionLabel label="Architectural Components" /></div>
        <FeatureGrid featureNames={CHARACTER_FEATURES} featureMap={featureMap} defs={defs} expanded={expanded} onToggle={toggleExpand} accent={ACCENT} />
      </SurfaceCard>
    </div>
  );
}

/* ── Class tree node ───────────────────────────────────────────────────────── */

function ClassTreeNode({ node, depth }: { node: ClassNode; depth: number }) {
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div style={{ paddingLeft: depth === 0 ? 0 : 24 }} className="relative">
      <div className="relative flex items-center gap-3 py-2">
        {depth > 0 && (
          <span
            className="absolute left-[-16px] top-1/2 w-4 border-t-2"
            style={{ borderColor: `${node.color}50` }}
          />
        )}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="flex items-center gap-2 group cursor-default"
        >
          <span
            className="text-xs font-mono font-bold px-3 py-1.5 rounded-lg border shadow-sm transition-colors group-hover:brightness-110"
            style={{
              borderColor: `${node.color}50`,
              backgroundColor: `${node.color}15`,
              color: node.color,
            }}
          >
            {node.name}
          </span>
          {node.subtitle && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted bg-surface px-2 py-0.5 rounded-md border border-border/40">
              {node.subtitle}
            </span>
          )}
          {node.crossRef && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-md font-mono font-bold border shadow-sm flex items-center gap-1 hover:brightness-110 cursor-pointer transition-colors"
              style={{ backgroundColor: `${STATUS_ERROR}15`, color: STATUS_ERROR, borderColor: `${STATUS_ERROR}40` }}
            >
              <ExternalLink className="w-2.5 h-2.5" />
              {node.crossRef}
            </span>
          )}
        </motion.div>
      </div>
      {hasChildren && (
        <div
          className="border-l-2 ml-3.5 relative"
          style={{ borderColor: `${node.color}30` }}
        >
          {node.children!.map((child) => (
            <ClassTreeNode key={child.name} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
