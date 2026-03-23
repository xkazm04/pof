'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Play, Copy, Check, ChevronRight, Download,
  Swords, Zap, Shield, Clock, Wind, RotateCcw,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO,
  ACCENT_CYAN, ACCENT_VIOLET, ACCENT_ORANGE, ACCENT_EMERALD,
  OPACITY_15, OPACITY_20,
} from '@/lib/chart-colors';

/* ══════════════════════════════════════════════════════════════════════════
   DATA MODEL — matches AnimationStateGraph.tsx schemas
   ══════════════════════════════════════════════════════════════════════════ */

interface NotifyWindow {
  name: string;
  color: string;
  start: number; // 0-1 normalized position within section
  width: number; // 0-1 normalized width
}

interface ComboSection {
  label: string;
  duration: number; // seconds
  damage: number;
  windows: NotifyWindow[];
  rootMotionDistance: number; // cm
  motionWarpTarget: boolean;
  description: string;
}

interface ComboChainEdge {
  from: number;
  to: number;
  windowStart: number; // seconds
  windowEnd: number;
}

interface GeneratedCombo {
  name: string;
  description: string;
  sections: ComboSection[];
  edges: ComboChainEdge[];
  totalDuration: number;
  totalDamage: number;
  avgDPS: number;
}

/* ══════════════════════════════════════════════════════════════════════════
   COMBO GENERATOR — deterministic generation from natural language keywords
   ══════════════════════════════════════════════════════════════════════════ */

type HitType = 'light' | 'medium' | 'heavy' | 'sweep' | 'thrust' | 'slam' | 'uppercut' | 'spin';

interface HitSpec {
  type: HitType;
  label: string;
  baseDuration: number;
  baseDamage: number;
  rootMotion: number;
  hasMotionWarp: boolean;
  hitWindowStart: number;
  hitWindowWidth: number;
  comboWindowStart: number;
  comboWindowWidth: number;
  vfxWindowStart: number;
  vfxWindowWidth: number;
}

const HIT_TEMPLATES: Record<HitType, Omit<HitSpec, 'label'>> = {
  light:    { type: 'light',    baseDuration: 0.40, baseDamage: 20, rootMotion: 30,  hasMotionWarp: false, hitWindowStart: 0.20, hitWindowWidth: 0.20, comboWindowStart: 0.55, comboWindowWidth: 0.30, vfxWindowStart: 0.20, vfxWindowWidth: 0.12 },
  medium:   { type: 'medium',   baseDuration: 0.50, baseDamage: 35, rootMotion: 50,  hasMotionWarp: false, hitWindowStart: 0.18, hitWindowWidth: 0.25, comboWindowStart: 0.50, comboWindowWidth: 0.35, vfxWindowStart: 0.18, vfxWindowWidth: 0.15 },
  heavy:    { type: 'heavy',    baseDuration: 0.70, baseDamage: 60, rootMotion: 85,  hasMotionWarp: true,  hitWindowStart: 0.15, hitWindowWidth: 0.30, comboWindowStart: 0.55, comboWindowWidth: 0.25, vfxWindowStart: 0.15, vfxWindowWidth: 0.20 },
  sweep:    { type: 'sweep',    baseDuration: 0.55, baseDamage: 30, rootMotion: 40,  hasMotionWarp: false, hitWindowStart: 0.15, hitWindowWidth: 0.35, comboWindowStart: 0.55, comboWindowWidth: 0.30, vfxWindowStart: 0.15, vfxWindowWidth: 0.25 },
  thrust:   { type: 'thrust',   baseDuration: 0.45, baseDamage: 40, rootMotion: 100, hasMotionWarp: true,  hitWindowStart: 0.22, hitWindowWidth: 0.18, comboWindowStart: 0.50, comboWindowWidth: 0.30, vfxWindowStart: 0.22, vfxWindowWidth: 0.10 },
  slam:     { type: 'slam',     baseDuration: 0.80, baseDamage: 75, rootMotion: 60,  hasMotionWarp: true,  hitWindowStart: 0.30, hitWindowWidth: 0.25, comboWindowStart: 0.65, comboWindowWidth: 0.20, vfxWindowStart: 0.30, vfxWindowWidth: 0.30 },
  uppercut: { type: 'uppercut', baseDuration: 0.50, baseDamage: 45, rootMotion: 35,  hasMotionWarp: true,  hitWindowStart: 0.25, hitWindowWidth: 0.20, comboWindowStart: 0.55, comboWindowWidth: 0.30, vfxWindowStart: 0.25, vfxWindowWidth: 0.15 },
  spin:     { type: 'spin',     baseDuration: 0.60, baseDamage: 40, rootMotion: 20,  hasMotionWarp: false, hitWindowStart: 0.10, hitWindowWidth: 0.40, comboWindowStart: 0.55, comboWindowWidth: 0.30, vfxWindowStart: 0.10, vfxWindowWidth: 0.30 },
};

const HIT_LABELS: Record<HitType, string[]> = {
  light:    ['Quick Slash', 'Jab', 'Light Cut', 'Flick Strike'],
  medium:   ['Cross Cut', 'Diagonal Slash', 'Side Swipe', 'Mid Strike'],
  heavy:    ['Heavy Overhead', 'Crushing Blow', 'Power Strike', 'Execution Swing'],
  sweep:    ['Wide Sweep', 'Arc Slash', 'Cleaving Swing', 'Reaping Cut'],
  thrust:   ['Piercing Thrust', 'Lunge', 'Stab', 'Impale'],
  slam:     ['Ground Slam', 'Earthshatter', 'Crater Smash', 'Seismic Strike'],
  uppercut: ['Rising Slash', 'Uppercut', 'Skyward Cut', 'Launcher'],
  spin:     ['Whirlwind', 'Spinning Slash', 'Cyclone Cut', 'Tornado Strike'],
};

const KEYWORD_MAP: Record<string, HitType> = {
  light: 'light', quick: 'light', fast: 'light', jab: 'light', flick: 'light', tap: 'light',
  medium: 'medium', cross: 'medium', diagonal: 'medium', mid: 'medium', standard: 'medium',
  heavy: 'heavy', overhead: 'heavy', power: 'heavy', crushing: 'heavy', strong: 'heavy',
  sweep: 'sweep', wide: 'sweep', arc: 'sweep', cleave: 'sweep', sweeping: 'sweep',
  thrust: 'thrust', lunge: 'thrust', stab: 'thrust', pierce: 'thrust', piercing: 'thrust',
  slam: 'slam', ground: 'slam', smash: 'slam', crater: 'slam', pound: 'slam',
  uppercut: 'uppercut', rising: 'uppercut', launch: 'uppercut', launcher: 'uppercut', skyward: 'uppercut',
  spin: 'spin', whirlwind: 'spin', spinning: 'spin', cyclone: 'spin', tornado: 'spin',
  finisher: 'heavy', finish: 'heavy', followup: 'medium', 'follow-up': 'medium',
};

function parseHitCount(prompt: string): number {
  const numMatch = prompt.match(/(\d+)[- ]?hit/i);
  if (numMatch) return Math.min(Math.max(parseInt(numMatch[1], 10), 1), 8);
  const wordNums: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };
  for (const [word, num] of Object.entries(wordNums)) {
    if (prompt.toLowerCase().includes(`${word}-hit`) || prompt.toLowerCase().includes(`${word} hit`)) return num;
  }
  return 3; // default
}

function parseHitTypes(prompt: string, count: number): HitType[] {
  const words = prompt.toLowerCase().split(/[\s,;.!?]+/);
  const found: HitType[] = [];
  for (const word of words) {
    const type = KEYWORD_MAP[word];
    if (type && !found.includes(type)) found.push(type);
  }
  if (found.length === 0) found.push('light', 'medium', 'heavy');
  while (found.length < count) {
    found.push(found[found.length - 1]);
  }
  return found.slice(0, count);
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateCombo(prompt: string): GeneratedCombo {
  const count = parseHitCount(prompt);
  const hitTypes = parseHitTypes(prompt, count);
  const seed = Array.from(prompt).reduce((s, c) => s + c.charCodeAt(0), 0);
  const rand = seededRandom(seed);

  const sections: ComboSection[] = hitTypes.map((type, i) => {
    const template = HIT_TEMPLATES[type];
    const labels = HIT_LABELS[type];
    const label = labels[Math.floor(rand() * labels.length)];
    const isLast = i === count - 1;

    const durationJitter = 1 + (rand() - 0.5) * 0.15;
    const damageJitter = 1 + (rand() - 0.5) * 0.2;
    const duration = Math.round(template.baseDuration * durationJitter * 100) / 100;
    const damage = Math.round(template.baseDamage * damageJitter);

    const windows: NotifyWindow[] = [
      { name: 'HitDetection', color: STATUS_ERROR, start: template.hitWindowStart, width: template.hitWindowWidth },
      { name: 'SpawnVFX', color: STATUS_WARNING, start: template.vfxWindowStart, width: template.vfxWindowWidth },
    ];

    if (!isLast) {
      windows.unshift({ name: 'ComboWindow', color: ACCENT_CYAN, start: template.comboWindowStart, width: template.comboWindowWidth });
    }

    if (template.hasMotionWarp) {
      windows.push({ name: 'MotionWarp', color: ACCENT_EMERALD, start: template.hitWindowStart - 0.05, width: template.hitWindowWidth + 0.1 });
    }

    const descParts = [];
    if (type === 'sweep' || type === 'spin') descParts.push('AoE');
    if (template.hasMotionWarp) descParts.push('Motion Warped');
    if (isLast) descParts.push('Finisher');
    if (type === 'light') descParts.push('Quick startup');
    if (type === 'slam') descParts.push('Ground impact');

    return {
      label,
      duration,
      damage,
      windows,
      rootMotionDistance: Math.round(template.rootMotion * (1 + (rand() - 0.5) * 0.3)),
      motionWarpTarget: template.hasMotionWarp,
      description: descParts.join(' | ') || type,
    };
  });

  const edges: ComboChainEdge[] = [];
  for (let i = 0; i < sections.length - 1; i++) {
    const sec = sections[i];
    const comboWin = sec.windows.find(w => w.name === 'ComboWindow');
    if (comboWin) {
      edges.push({
        from: i,
        to: i + 1,
        windowStart: Math.round(sec.duration * comboWin.start * 100) / 100,
        windowEnd: Math.round(sec.duration * (comboWin.start + comboWin.width) * 100) / 100,
      });
    }
  }

  const totalDuration = sections.reduce((s, sec) => s + sec.duration, 0);
  const totalDamage = sections.reduce((s, sec) => s + sec.damage, 0);

  return {
    name: `AI Combo (${count}-Hit)`,
    description: prompt,
    sections,
    edges,
    totalDuration: Math.round(totalDuration * 100) / 100,
    totalDamage,
    avgDPS: Math.round(totalDamage / totalDuration),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   UE5 CODE GENERATION
   ══════════════════════════════════════════════════════════════════════════ */

function generateMontageCode(combo: GeneratedCombo): string {
  const lines: string[] = [
    `// Auto-generated Combo Montage Definition`,
    `// "${combo.description}"`,
    `// ${combo.sections.length} hits | ${combo.totalDuration}s | ${combo.totalDamage} total damage | ${combo.avgDPS} DPS`,
    ``,
    `#pragma once`,
    ``,
    `#include "CoreMinimal.h"`,
    `#include "ComboDefinition.generated.h"`,
    ``,
    `USTRUCT(BlueprintType)`,
    `struct FComboSectionDef`,
    `{`,
    `\tGENERATED_BODY()`,
    ``,
    `\tUPROPERTY(EditAnywhere) FName SectionName;`,
    `\tUPROPERTY(EditAnywhere) float Duration;`,
    `\tUPROPERTY(EditAnywhere) float Damage;`,
    `\tUPROPERTY(EditAnywhere) float RootMotionDistance;`,
    `\tUPROPERTY(EditAnywhere) bool bUseMotionWarping;`,
    `\tUPROPERTY(EditAnywhere) float HitDetectionStart;`,
    `\tUPROPERTY(EditAnywhere) float HitDetectionEnd;`,
    `\tUPROPERTY(EditAnywhere) float ComboWindowStart;`,
    `\tUPROPERTY(EditAnywhere) float ComboWindowEnd;`,
    `};`,
    ``,
    `// ── Section Definitions ──`,
    ``,
  ];

  combo.sections.forEach((sec, i) => {
    const hitWin = sec.windows.find(w => w.name === 'HitDetection');
    const comboWin = sec.windows.find(w => w.name === 'ComboWindow');
    lines.push(`// Section ${i + 1}: ${sec.label} (${sec.description})`);
    lines.push(`FComboSectionDef Section${i + 1};`);
    lines.push(`Section${i + 1}.SectionName = TEXT("${sec.label.replace(/\s+/g, '_')}");`);
    lines.push(`Section${i + 1}.Duration = ${sec.duration}f;`);
    lines.push(`Section${i + 1}.Damage = ${sec.damage}.f;`);
    lines.push(`Section${i + 1}.RootMotionDistance = ${sec.rootMotionDistance}.f;`);
    lines.push(`Section${i + 1}.bUseMotionWarping = ${sec.motionWarpTarget ? 'true' : 'false'};`);
    lines.push(`Section${i + 1}.HitDetectionStart = ${((hitWin?.start ?? 0) * sec.duration).toFixed(3)}f;`);
    lines.push(`Section${i + 1}.HitDetectionEnd = ${(((hitWin?.start ?? 0) + (hitWin?.width ?? 0)) * sec.duration).toFixed(3)}f;`);
    lines.push(`Section${i + 1}.ComboWindowStart = ${((comboWin?.start ?? 0) * sec.duration).toFixed(3)}f;`);
    lines.push(`Section${i + 1}.ComboWindowEnd = ${(((comboWin?.start ?? 0) + (comboWin?.width ?? 0)) * sec.duration).toFixed(3)}f;`);
    lines.push(``);
  });

  return lines.join('\n');
}

function generateJSON(combo: GeneratedCombo): string {
  return JSON.stringify({
    name: combo.name,
    description: combo.description,
    totalDuration: combo.totalDuration,
    totalDamage: combo.totalDamage,
    avgDPS: combo.avgDPS,
    sections: combo.sections.map(sec => ({
      label: sec.label,
      duration: sec.duration,
      damage: sec.damage,
      rootMotionDistance: sec.rootMotionDistance,
      motionWarpTarget: sec.motionWarpTarget,
      windows: sec.windows.map(w => ({
        name: w.name,
        startNorm: w.start,
        widthNorm: w.width,
        startSec: Math.round(w.start * sec.duration * 1000) / 1000,
        endSec: Math.round((w.start + w.width) * sec.duration * 1000) / 1000,
      })),
    })),
    edges: combo.edges,
  }, null, 2);
}

/* ══════════════════════════════════════════════════════════════════════════
   PRESETS
   ══════════════════════════════════════════════════════════════════════════ */

const COMBO_PRESETS = [
  { label: 'Basic 3-Hit', prompt: '3-hit combo with light slash, cross cut follow-up, and heavy overhead finisher' },
  { label: 'Sweep Finisher', prompt: '4-hit combo: quick jab, jab, diagonal slash, wide sweeping finisher' },
  { label: 'Thrust Combo', prompt: '3-hit combo with piercing thrust opener, spinning follow-up, heavy slam finisher with ground impact' },
  { label: 'Launcher', prompt: '2-hit combo: fast sweep into rising uppercut launcher' },
  { label: 'Whirlwind', prompt: '5-hit light spin spin spin spin heavy slam finisher' },
  { label: 'Boss Punish', prompt: '3-hit combo: quick thrust, thrust, ground slam with motion warp finisher' },
];

/* ══════════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ══════════════════════════════════════════════════════════════════════════ */

const ACCENT = ACCENT_VIOLET;

const WINDOW_ORDER = ['MotionWarp', 'ComboWindow', 'HitDetection', 'SpawnVFX'] as const;

function MontageTimeline({ sections }: { sections: ComboSection[] }) {
  const totalDuration = sections.reduce((s, sec) => s + sec.duration, 0);

  return (
    <div className="space-y-2">
      {sections.map((sec, i) => {
        const widthPct = (sec.duration / totalDuration) * 100;
        const sortedWindows = [...sec.windows].sort((a, b) =>
          WINDOW_ORDER.indexOf(a.name as typeof WINDOW_ORDER[number]) - WINDOW_ORDER.indexOf(b.name as typeof WINDOW_ORDER[number])
        );

        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-2xs font-mono font-bold text-text w-24 truncate">{sec.label}</span>
              <span className="text-2xs text-text-muted">{sec.duration}s</span>
              <span className="text-2xs font-mono" style={{ color: STATUS_ERROR }}>{sec.damage} dmg</span>
              {sec.motionWarpTarget && (
                <span className="text-2xs px-1 py-0.5 rounded" style={{ backgroundColor: `${ACCENT_EMERALD}${OPACITY_15}`, color: ACCENT_EMERALD }}>Warp</span>
              )}
              <span className="text-2xs text-text-muted ml-auto">{sec.rootMotionDistance}cm</span>
            </div>
            <div className="relative rounded-md overflow-hidden" style={{ width: `${widthPct}%`, minWidth: 120 }}>
              {/* Background track */}
              <div className="h-6 bg-surface-deep rounded-md relative overflow-hidden">
                {/* Notify windows */}
                {sortedWindows.map((win, wi) => (
                  <div
                    key={wi}
                    className="absolute top-0 h-full rounded-sm opacity-60 hover:opacity-90 transition-opacity cursor-default"
                    style={{
                      left: `${win.start * 100}%`,
                      width: `${win.width * 100}%`,
                      backgroundColor: win.color,
                    }}
                    title={`${win.name}: ${(win.start * sec.duration).toFixed(3)}s – ${((win.start + win.width) * sec.duration).toFixed(3)}s`}
                  >
                    <span className="text-[11px] font-mono font-bold text-white px-0.5 truncate block leading-6">
                      {win.name.replace('Detection', '').replace('Spawn', '')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        );
      })}
      {/* Legend */}
      <div className="flex gap-3 pt-1">
        {[
          { name: 'ComboWindow', color: ACCENT_CYAN },
          { name: 'HitDetection', color: STATUS_ERROR },
          { name: 'VFX', color: STATUS_WARNING },
          { name: 'MotionWarp', color: ACCENT_EMERALD },
        ].map(l => (
          <div key={l.name} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: l.color, opacity: 0.6 }} />
            <span className="text-2xs text-text-muted">{l.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ComboChainGraph({ combo }: { combo: GeneratedCombo }) {
  const nodeWidth = 100;
  const nodeHeight = 48;
  const gap = 32;
  const svgWidth = combo.sections.length * (nodeWidth + gap) - gap + 40;
  const svgHeight = nodeHeight + 56;

  return (
    <svg width={svgWidth} height={svgHeight} className="overflow-visible">
      {/* Edges */}
      {combo.edges.map((edge, i) => {
        const x1 = 20 + edge.from * (nodeWidth + gap) + nodeWidth;
        const x2 = 20 + edge.to * (nodeWidth + gap);
        const y = nodeHeight / 2 + 8;
        return (
          <g key={i}>
            <line x1={x1} y1={y} x2={x2} y2={y} stroke={ACCENT_CYAN} strokeWidth={2} markerEnd="url(#arrow)" />
            <text x={(x1 + x2) / 2} y={y - 6} textAnchor="middle" className="text-[11px] font-mono" fill={ACCENT_CYAN}>
              {edge.windowStart.toFixed(2)}–{edge.windowEnd.toFixed(2)}s
            </text>
          </g>
        );
      })}
      {/* Arrow marker */}
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6" fill={ACCENT_CYAN} />
        </marker>
      </defs>
      {/* Nodes */}
      {combo.sections.map((sec, i) => {
        const x = 20 + i * (nodeWidth + gap);
        const y = 8;
        return (
          <g key={i}>
            <rect
              x={x} y={y} width={nodeWidth} height={nodeHeight}
              rx={6} fill={`${ACCENT}15`} stroke={ACCENT} strokeWidth={1.5}
            />
            <text x={x + nodeWidth / 2} y={y + 16} textAnchor="middle" className="text-xs font-bold" fill="var(--text)">
              {sec.label}
            </text>
            <text x={x + nodeWidth / 2} y={y + 28} textAnchor="middle" className="text-[11px] font-mono" fill={STATUS_ERROR}>
              {sec.damage} dmg
            </text>
            <text x={x + nodeWidth / 2} y={y + 40} textAnchor="middle" className="text-[11px] font-mono" fill="var(--text-muted)">
              {sec.duration}s | {sec.rootMotionDistance}cm
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function RootMotionPreview({ sections }: { sections: ComboSection[] }) {
  const svgW = 200;
  const svgH = 80;
  const totalDist = sections.reduce((s, sec) => s + sec.rootMotionDistance, 0);
  let cumDist = 0;

  return (
    <svg width={svgW} height={svgH} className="overflow-visible">
      {/* Ground line */}
      <line x1={10} y1={svgH - 10} x2={svgW - 10} y2={svgH - 10} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
      {/* Character path */}
      {sections.map((sec, i) => {
        const startX = 15 + (cumDist / totalDist) * (svgW - 30);
        cumDist += sec.rootMotionDistance;
        const endX = 15 + (cumDist / totalDist) * (svgW - 30);
        const y = svgH - 16;
        const color = sec.motionWarpTarget ? ACCENT_EMERALD : STATUS_INFO;
        return (
          <g key={i}>
            <line x1={startX} y1={y} x2={endX} y2={y} stroke={color} strokeWidth={3} strokeLinecap="round" />
            <circle cx={endX} cy={y} r={3} fill={color} />
            <text x={(startX + endX) / 2} y={y - 8} textAnchor="middle" className="text-[11px] font-mono" fill={color}>
              {sec.rootMotionDistance}cm
            </text>
            <text x={(startX + endX) / 2} y={svgH - 2} textAnchor="middle" className="text-[11px] font-mono" fill="var(--text-muted)">
              {sec.label.split(' ')[0]}
            </text>
          </g>
        );
      })}
      {/* Start marker */}
      <circle cx={15} cy={svgH - 16} r={4} fill={ACCENT} />
      <text x={15} y={svgH - 24} textAnchor="middle" className="text-[11px] font-mono" fill={ACCENT}>Start</text>
      {/* Total distance */}
      <text x={svgW - 10} y={12} textAnchor="end" className="text-[11px] font-mono font-bold" fill="var(--text-muted)">
        Total: {totalDist}cm
      </text>
    </svg>
  );
}

function StatBadge({ icon: Icon, label, value, color }: { icon: typeof Zap; label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center px-2 py-1.5 rounded-md" style={{ backgroundColor: `${color}${OPACITY_15}` }}>
      <div className="flex items-center gap-1">
        <Icon className="w-3 h-3" style={{ color }} />
        <span className="text-xs font-bold font-mono" style={{ color }}>{value}</span>
      </div>
      <span className="text-2xs text-text-muted mt-0.5">{label}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════════════ */

export function AIComboChoreographer() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCombo, setGeneratedCombo] = useState<GeneratedCombo | null>(null);
  const [codePreview, setCodePreview] = useState<{ code: string; title: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = useCallback(() => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    // Simulate AI processing delay
    setTimeout(() => {
      const combo = generateCombo(prompt.trim());
      setGeneratedCombo(combo);
      setIsGenerating(false);
    }, 600);
  }, [prompt]);

  const handlePreset = useCallback((presetPrompt: string) => {
    setPrompt(presetPrompt);
    setIsGenerating(true);
    setTimeout(() => {
      const combo = generateCombo(presetPrompt);
      setGeneratedCombo(combo);
      setIsGenerating(false);
    }, 600);
  }, []);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, []);

  const comboStats = useMemo(() => {
    if (!generatedCombo) return null;
    return {
      hits: generatedCombo.sections.length,
      duration: generatedCombo.totalDuration,
      damage: generatedCombo.totalDamage,
      dps: generatedCombo.avgDPS,
      warpCount: generatedCombo.sections.filter(s => s.motionWarpTarget).length,
      totalRootMotion: generatedCombo.sections.reduce((s, sec) => s + sec.rootMotionDistance, 0),
    };
  }, [generatedCombo]);

  return (
    <div className="space-y-2.5">
      {/* Header */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-40 h-40 blur-3xl rounded-full pointer-events-none" style={{ backgroundColor: `${ACCENT}10` }} />
        <SectionLabel icon={Sparkles} label="AI Combo Choreographer" color={ACCENT} />
        <p className="text-2xs text-text-muted mt-1">
          Describe your combo in natural language and generate complete montage section timings, notify window placement,
          damage values, root motion distances, and motion warping parameters.
        </p>

        {/* Prompt input */}
        <div className="flex gap-2 mt-2.5">
          <input
            type="text"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleGenerate(); }}
            placeholder="e.g. 3-hit combo with wide sweeping first hit, quick follow-up, and heavy overhead finisher with ground slam"
            className="flex-1 px-3 py-2 bg-surface-deep border border-border/40 rounded-lg text-xs text-text placeholder:text-text-muted/40 focus:outline-none focus:border-violet-500/50 transition-colors"
          />
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
            style={{ backgroundColor: `${ACCENT}${OPACITY_20}`, color: ACCENT, border: `1px solid ${ACCENT}40` }}
          >
            {isGenerating ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                <RotateCcw className="w-3.5 h-3.5" />
              </motion.div>
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {isGenerating ? 'Generating...' : 'Generate'}
          </button>
        </div>

        {/* Presets */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span className="text-2xs text-text-muted">Presets:</span>
          {COMBO_PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => handlePreset(p.prompt)}
              disabled={isGenerating}
              className="text-2xs px-2 py-0.5 rounded-md border border-border/40 hover:border-border text-text-muted hover:text-text transition-colors disabled:opacity-50"
            >
              {p.label}
            </button>
          ))}
        </div>
      </SurfaceCard>

      {/* Results */}
      <AnimatePresence mode="wait">
        {generatedCombo && comboStats && (
          <motion.div
            key={generatedCombo.name + generatedCombo.description}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-2.5"
          >
            {/* Summary stats */}
            <SurfaceCard level={2} className="p-3">
              <SectionLabel icon={Swords} label="Combo Summary" color={ACCENT_ORANGE} />
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-2">
                <StatBadge icon={Swords} label="Hits" value={String(comboStats.hits)} color={ACCENT} />
                <StatBadge icon={Clock} label="Duration" value={`${comboStats.duration}s`} color={ACCENT_CYAN} />
                <StatBadge icon={Zap} label="Damage" value={String(comboStats.damage)} color={STATUS_ERROR} />
                <StatBadge icon={Play} label="DPS" value={String(comboStats.dps)} color={ACCENT_ORANGE} />
                <StatBadge icon={Wind} label="Root Motion" value={`${comboStats.totalRootMotion}cm`} color={STATUS_INFO} />
                <StatBadge icon={Shield} label="Warps" value={String(comboStats.warpCount)} color={ACCENT_EMERALD} />
              </div>
            </SurfaceCard>

            {/* Montage Timeline */}
            <SurfaceCard level={2} className="p-3">
              <SectionLabel icon={Play} label="Montage Timeline" color={ACCENT_CYAN} />
              <p className="text-2xs text-text-muted mt-0.5 mb-2">
                Each bar represents a montage section. Colored regions are AnimNotify windows.
              </p>
              <MontageTimeline sections={generatedCombo.sections} />
            </SurfaceCard>

            {/* Combo Chain Graph */}
            <SurfaceCard level={2} className="p-3">
              <SectionLabel icon={ChevronRight} label="Combo Chain Graph" color={ACCENT} />
              <p className="text-2xs text-text-muted mt-0.5 mb-2">
                Node connections show combo window timings for input buffering.
              </p>
              <div className="overflow-x-auto custom-scrollbar pb-1">
                <ComboChainGraph combo={generatedCombo} />
              </div>
            </SurfaceCard>

            {/* Root Motion Preview */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
              <SurfaceCard level={2} className="p-3">
                <SectionLabel icon={Wind} label="Root Motion Trajectory" color={STATUS_INFO} />
                <p className="text-2xs text-text-muted mt-0.5 mb-2">
                  Forward displacement per section. Green = motion warped.
                </p>
                <RootMotionPreview sections={generatedCombo.sections} />
              </SurfaceCard>

              {/* Per-section detail table */}
              <SurfaceCard level={2} className="p-3">
                <SectionLabel icon={Clock} label="Section Details" color={ACCENT_ORANGE} />
                <div className="overflow-x-auto custom-scrollbar mt-2">
                  <table className="w-full text-2xs border-collapse">
                    <thead>
                      <tr className="border-b border-border/40 text-text-muted font-bold uppercase">
                        <th className="text-left py-1 pr-2">#</th>
                        <th className="text-left py-1 pr-2">Name</th>
                        <th className="text-right py-1 pr-2">Dur</th>
                        <th className="text-right py-1 pr-2">Dmg</th>
                        <th className="text-right py-1 pr-2">Root</th>
                        <th className="text-center py-1">Warp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generatedCombo.sections.map((sec, i) => (
                        <tr key={i} className="border-b border-border/20 hover:bg-surface/30 transition-colors">
                          <td className="py-1 pr-2 font-mono text-text-muted">{i + 1}</td>
                          <td className="py-1 pr-2 font-bold text-text">{sec.label}</td>
                          <td className="py-1 pr-2 text-right font-mono" style={{ color: ACCENT_CYAN }}>{sec.duration}s</td>
                          <td className="py-1 pr-2 text-right font-mono" style={{ color: STATUS_ERROR }}>{sec.damage}</td>
                          <td className="py-1 pr-2 text-right font-mono text-text-muted">{sec.rootMotionDistance}cm</td>
                          <td className="py-1 text-center">
                            {sec.motionWarpTarget && <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: ACCENT_EMERALD }} />}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SurfaceCard>
            </div>

            {/* Export */}
            <SurfaceCard level={2} className="p-3">
              <SectionLabel icon={Download} label="Export" color={ACCENT_EMERALD} />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setCodePreview({ code: generateMontageCode(generatedCombo), title: 'UE5 Combo Struct (.h)' })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors hover:brightness-110"
                  style={{ borderColor: `${ACCENT}30`, backgroundColor: `${ACCENT}08`, color: ACCENT }}
                >
                  <Swords className="w-3 h-3" /> UE5 Header
                </button>
                <button
                  onClick={() => setCodePreview({ code: generateJSON(generatedCombo), title: 'Combo Definition (JSON)' })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors hover:brightness-110"
                  style={{ borderColor: `${ACCENT_EMERALD}30`, backgroundColor: `${ACCENT_EMERALD}08`, color: ACCENT_EMERALD }}
                >
                  <Download className="w-3 h-3" /> Export JSON
                </button>
              </div>
            </SurfaceCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Code Preview Modal */}
      <AnimatePresence>
        {codePreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setCodePreview(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-surface-deep border border-border/60 rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" style={{ color: ACCENT }} />
                  <span className="text-sm font-bold text-text">{codePreview.title}</span>
                </div>
                <button
                  onClick={() => handleCopy(codePreview.code)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors"
                  style={{
                    borderColor: copied ? `${STATUS_SUCCESS}50` : `${ACCENT}40`,
                    backgroundColor: copied ? `${STATUS_SUCCESS}15` : `${ACCENT}10`,
                    color: copied ? STATUS_SUCCESS : ACCENT,
                  }}
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-text-muted leading-relaxed custom-scrollbar whitespace-pre">
                {codePreview.code}
              </pre>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
