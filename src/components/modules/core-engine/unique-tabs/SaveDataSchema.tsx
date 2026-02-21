'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import { Save, ChevronDown, ChevronRight, Database, Terminal, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MODULE_COLORS, STATUS_SUCCESS,
  ACCENT_CYAN, OPACITY_8, OPACITY_20, OPACITY_30,
} from '@/lib/chart-colors';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { useFeatureMatrix } from '@/hooks/useFeatureMatrix';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow } from '@/types/feature-matrix';
import { TabHeader, PipelineFlow, SectionLabel, FeatureCard, LoadingSpinner } from './_shared';

const ACCENT = ACCENT_CYAN;

type FieldType = 'int' | 'float' | 'string' | 'bool' | 'array' | 'object';
interface SchemaField { name: string; type: FieldType; source: string; details?: string }
interface SchemaGroup { id: string; label: string; color: string; fields: SchemaField[] }

const SCHEMA_GROUPS: SchemaGroup[] = [
  {
    id: 'character', label: 'SYS.CHAR_STATE', color: ACCENT_CYAN, fields: [
      { name: 'Level', type: 'int', source: 'arpg-progression', details: 'uint32 [0-100]' },
      { name: 'XP', type: 'int', source: 'arpg-progression', details: 'uint64 absolute' },
      { name: 'Position', type: 'object', source: 'arpg-character', details: 'FVector {X,Y,Z}' },
      { name: 'Attributes', type: 'object', source: 'arpg-gas', details: 'FGameplayAttributeData' },
    ]
  },
  {
    id: 'inventory', label: 'SYS.INV_BLOB', color: MODULE_COLORS.content, fields: [
      { name: 'ItemInstances', type: 'array', source: 'arpg-inventory', details: 'TArray<FItemData>' },
      { name: 'EquippedItems', type: 'object', source: 'arpg-inventory', details: 'TMap<ESlot, FItem>' },
    ]
  },
  {
    id: 'progression', label: 'SYS.PROG_TREES', color: STATUS_SUCCESS, fields: [
      { name: 'UnlockedAbilities', type: 'array', source: 'arpg-gas', details: 'TArray<FName>' },
      { name: 'SpentPoints', type: 'int', source: 'arpg-progression', details: 'uint32 sum' },
    ]
  },
  {
    id: 'world', label: 'SYS.WORLD_STATE', color: MODULE_COLORS.systems, fields: [
      { name: 'VisitedZones', type: 'array', source: 'arpg-world', details: 'TSet<FName>' },
      { name: 'CompletedEncounters', type: 'array', source: 'arpg-world', details: 'Bitmask/TArray' },
    ]
  },
];

const TYPE_COLORS: Record<FieldType, string> = {
  int: '#60a5fa', float: '#34d399', string: '#f59e0b',
  bool: '#a78bfa', array: '#f472b6', object: '#fb923c',
};

const SAVE_SLOTS = [
  { id: 'auto', label: 'AUTO_SAVE', isAuto: true, level: 14, zone: 'The Ashlands', playtime: '4h 28m', ts: '8m ago', integrity: '100%' },
  { id: 'slot-1', label: 'SLOT-01', isAuto: false, level: 14, zone: 'The Ashlands', playtime: '4h 32m', ts: '2h ago', integrity: '100%' },
  { id: 'slot-2', label: 'SLOT-02', isAuto: false, level: 7, zone: 'Verdant Plains', playtime: '1h 58m', ts: '1d ago', integrity: '98%' },
  { id: 'slot-3', label: 'SLOT-03', isAuto: false, level: 1, zone: 'Tutorial Zone', playtime: '0h 12m', ts: '3d ago', integrity: '100%' },
];

const VERSIONS = [
  { ver: 'v1.0.0', diff: 'Initial schema implementation' },
  { ver: 'v1.1.0', diff: 'Added EquippedItems serialization' },
  { ver: 'v1.2.5', diff: 'Added Abilities & Encounter flags' },
];

const FEATURE_NAMES = [
  'UARPGSaveGame', 'Custom serialization', 'Save function',
  'Load function', 'Auto-save', 'Save slot system', 'Save versioning',
];

interface SaveDataSchemaProps { moduleId: SubModuleId }

export function SaveDataSchema({ moduleId }: SaveDataSchemaProps) {
  const { features, isLoading } = useFeatureMatrix(moduleId);
  const defs = useMemo(() => MODULE_FEATURE_DEFINITIONS[moduleId] ?? [], [moduleId]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['character', 'inventory']));
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);

  // Blinking cursor effect — pauses when module is suspended
  const [cursorVisible, setCursorVisible] = useState(true);
  useSuspendableEffect(() => {
    const i = setInterval(() => setCursorVisible(v => !v), 500);
    return () => clearInterval(i);
  }, []);

  const featureMap = useMemo(() => {
    const map = new Map<string, FeatureRow>();
    for (const f of features) map.set(f.featureName, f);
    return map;
  }, [features]);

  const toggleGroup = useCallback((id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleFeature = useCallback((name: string) => {
    setExpandedFeature((prev) => (prev === name ? null : name));
  }, []);

  const stats = useMemo(() => {
    const implemented = FEATURE_NAMES.filter((n) => {
      const st = featureMap.get(n)?.status ?? 'unknown';
      return st === 'implemented' || st === 'improved';
    }).length;
    return { total: FEATURE_NAMES.length, implemented };
  }, [featureMap]);

  if (isLoading) {
    return <LoadingSpinner accent={ACCENT} />;
  }

  return (
    <div className="space-y-4">
      {/* Terminal Interface Header */}
      <div className="flex items-center justify-between pb-3 border-b border-cyan-900/40 relative">
        <div className="absolute top-0 right-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
        <div className="flex items-center gap-3">
          <div className="p-2 rounded grid place-items-center bg-cyan-950/50 border border-cyan-800/50 shadow-[0_0_15px_rgba(6,182,212,0.15)] relative overflow-hidden">
            <div className="absolute inset-0 bg-cyan-500/20 animate-pulse pointer-events-none" style={{ animationDuration: '2s' }} />
            <Terminal className="w-5 h-5 relative z-10 text-cyan-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold text-cyan-100 font-mono tracking-widest uppercase" style={{ textShadow: '0 0 8px rgba(34,211,238,0.4)' }}>
              Save.Data_Schema <span className="text-cyan-400">{cursorVisible ? '_' : ' '}</span>
            </span>
            <span className="text-xs text-cyan-700 font-mono uppercase tracking-widest mt-0.5">
              Protocol: UARPG_SYS_{stats.implemented}/{stats.total}
            </span>
          </div>
        </div>
      </div>

      {/* Cyber Flow diagram */}
      <SurfaceCard level={2} className="p-4 border-cyan-900/30 bg-black/40 shadow-inner relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(6, 182, 212, .3) 25%, rgba(6, 182, 212, .3) 26%, transparent 27%, transparent 74%, rgba(6, 182, 212, .3) 75%, rgba(6, 182, 212, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(6, 182, 212, .3) 25%, rgba(6, 182, 212, .3) 26%, transparent 27%, transparent 74%, rgba(6, 182, 212, .3) 75%, rgba(6, 182, 212, .3) 76%, transparent 77%, transparent)', backgroundSize: '20px 20px' }} />
        <div className="flex items-center gap-2 mb-4 text-cyan-500/70 font-mono text-xs uppercase tracking-widest border-b border-cyan-900/40 pb-2">
          <Cpu className="w-4 h-4" /> Runtime Serialization Pipeline
        </div>
        <div className="relative z-10">
          <PipelineFlow steps={['Gather State', 'Serialize', 'SaveGame Object', 'Deserialize', 'Restore State']} accent={ACCENT} />
        </div>
      </SurfaceCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Schema tree terminal view */}
        <SurfaceCard level={2} className="p-0 border-cyan-900/30 bg-[#060b11] shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] flex flex-col h-full overflow-hidden relative">
          <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />

          <div className="px-4 py-3 border-b border-cyan-900/40 flex items-center justify-between bg-cyan-950/10">
            <span className="text-[10px] font-mono text-cyan-600 uppercase tracking-widest">DATA_STRUCTURE.h</span>
            <span className="flex gap-1.5 items-center">
              <span className="w-2 h-2 rounded-full bg-red-500/50" />
              <span className="w-2 h-2 rounded-full bg-amber-500/50" />
              <span className="w-2 h-2 rounded-full bg-green-500/50" />
            </span>
          </div>

          <div className="p-4 space-y-1 font-mono text-xs leading-relaxed overflow-y-auto custom-scrollbar relative">
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-cyan-950/20 border-r border-cyan-900/20 z-0 select-none flex flex-col pt-4 items-center text-[10px] text-cyan-800/40 font-mono">
              {[...Array(20)].map((_, i) => <div key={i} className="h-6 flex items-center">{i + 1}</div>)}
            </div>

            <div className="relative z-10 pl-6 text-cyan-500/80">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }}>
                <span className="text-purple-400">struct</span> <span className="text-emerald-400">USaveDataSchema</span> {'{'}
              </motion.div>

              <div className="pl-4 mt-1 border-l border-cyan-900/30">
                {SCHEMA_GROUPS.map((group, groupIndex) => {
                  const isOpen = expandedGroups.has(group.id);
                  return (
                    <motion.div
                      key={group.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * groupIndex }}
                      className="mb-1"
                    >
                      <button
                        onClick={() => toggleGroup(group.id)}
                        className="flex items-center gap-2 hover:bg-cyan-900/20 px-2 py-0.5 rounded transition-colors w-full text-left focus:outline-none"
                      >
                        <span className="text-cyan-700">{isOpen ? '▼' : '▶'}</span>
                        <span style={{ color: group.color, textShadow: `0 0 5px ${group.color}40` }}>{group.label}</span>
                      </button>

                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden pl-6"
                          >
                            {group.fields.map((field, i) => (
                              <div key={field.name} className="flex gap-4 py-0.5 hover:bg-white/5 pr-2 group transition-colors">
                                <span className="w-[80px] shrink-0 font-medium" style={{ color: TYPE_COLORS[field.type] }}>{field.type}</span>
                                <span className="text-cyan-100">{field.name};</span>
                                <span className="text-cyan-700/60 ml-auto hidden sm:block opacity-0 group-hover:opacity-100 transition-opacity">// {field.details}</span>
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
              <div className="mt-1 text-cyan-500/80">{'};'}</div>
            </div>

            <div className="pl-6 mt-4 text-cyan-500/40">
              &gt; EOF
            </div>
          </div>
        </SurfaceCard>

        {/* Save Slots matrix style */}
        <div className="space-y-4 h-full flex flex-col">
          <SurfaceCard level={2} className="p-0 border-cyan-900/30 bg-[#060b11] shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] flex-1 flex flex-col overflow-hidden relative">
            <div className="px-4 py-3 border-b border-cyan-900/40 flex items-center gap-2 bg-cyan-950/10">
              <Database className="w-4 h-4 text-cyan-500" />
              <span className="text-[10px] font-mono text-cyan-600 uppercase tracking-widest">MEMORY_BANKS</span>
            </div>

            <div className="p-4 space-y-3 relative z-10 flex-1 overflow-y-auto">
              {SAVE_SLOTS.map((slot, i) => (
                <motion.div
                  key={slot.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                  className={`border font-mono p-3 relative overflow-hidden group hover:border-cyan-500 transition-colors ${slot.isAuto ? 'border-amber-500/30 bg-amber-950/10' : 'border-cyan-900/40 bg-cyan-950/10'}`}
                >
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${slot.isAuto ? 'bg-amber-500' : 'bg-cyan-500 opacity-50 group-hover:opacity-100 transition-opacity'}`} />

                  <div className="flex justify-between items-start mb-2 pl-2">
                    <span className={`text-xs font-bold tracking-widest ${slot.isAuto ? 'text-amber-400' : 'text-cyan-300'}`}>{slot.label}</span>
                    <span className="text-[10px] text-cyan-700">{slot.ts}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-y-1.5 text-xs pl-2">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-cyan-700 uppercase">Location</span>
                      <span className="text-cyan-100 truncate pr-2">{slot.zone}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] text-cyan-700 uppercase">Integrity</span>
                      <span className="text-emerald-400">{slot.integrity}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] text-cyan-700 uppercase">Level</span>
                      <span className="text-cyan-100">Lv.{slot.level.toString().padStart(2, '0')}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] text-cyan-700 uppercase">Uptime</span>
                      <span className="text-cyan-100">{slot.playtime}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </SurfaceCard>
        </div>
      </div>

      {/* Migration chain terminal log */}
      <SurfaceCard level={2} className="p-3 border-cyan-900/30 bg-[#060b11] font-mono relative overflow-hidden">
        <div className="flex items-center gap-2 mb-3 border-b border-cyan-900/40 pb-2">
          <Database className="w-3.5 h-3.5 text-cyan-600" />
          <span className="text-[10px] font-bold text-cyan-600 uppercase tracking-widest">MIGRATION_HISTORY.log</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {VERSIONS.map((v, i, arr) => (
            <motion.div
              key={v.ver}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 + i * 0.1 }}
              className="flex items-center gap-3"
            >
              <div className="flex flex-col bg-cyan-950/30 border border-cyan-900/50 px-3 py-2 text-xs relative group hover:border-cyan-500/50 transition-colors">
                <span className="text-cyan-300 font-bold">{v.ver}</span>
                <span className="text-[10px] text-cyan-700 mt-1">{v.diff}</span>
                {/* Scanline hover effect */}
                <div className="absolute left-0 right-0 h-px bg-cyan-400/50 top-0 bottom-auto opacity-0 group-hover:opacity-100 group-hover:animate-[scanline_1s_ease-in-out_infinite]" />
              </div>
              {i < arr.length - 1 && <span className="text-cyan-800 text-sm">--&gt;</span>}
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Features List */}
      <div className="space-y-1.5 pt-2">
        <SectionLabel label="Engine Subsystems" />
        {FEATURE_NAMES.map((name) => (
          <FeatureCard
            key={name}
            name={name}
            featureMap={featureMap}
            defs={defs}
            expanded={expandedFeature}
            onToggle={toggleFeature}
            accent={ACCENT}
          />
        ))}
      </div>
    </div>
  );
}
