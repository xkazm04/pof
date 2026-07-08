import {
  STATUS_WARNING, STATUS_ERROR,
  ACCENT_CYAN, ACCENT_EMERALD,
} from '@/lib/chart-colors';
import { safeDivide } from '@/lib/math-utils';
import type {
  NotifyWindow, ComboSection, ComboChainEdge,
  MatchedComboKeyword, ComboParse, GeneratedCombo, HitType,
} from './types';
import { HIT_TEMPLATES, HIT_LABELS, KEYWORD_MAP } from './constants';

function parseHitCount(prompt: string): { count: number; explicit: boolean } {
  const numMatch = prompt.match(/(\d+)[- ]?hit/i);
  if (numMatch) return { count: Math.min(Math.max(parseInt(numMatch[1], 10), 1), 8), explicit: true };
  const wordNums: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };
  for (const [word, num] of Object.entries(wordNums)) {
    if (prompt.toLowerCase().includes(`${word}-hit`) || prompt.toLowerCase().includes(`${word} hit`)) {
      return { count: num, explicit: true };
    }
  }
  return { count: 3, explicit: false }; // default
}

/**
 * Parse a free-text combo description into a hit sequence plus diagnostics.
 * When no hit-type keyword is recognized, falls back to a default light/medium/heavy
 * combo but reports `typesRecognized: false` so the UI can say so honestly.
 * Pure & exported for testing.
 */
export function parseComboInput(prompt: string): ComboParse {
  const { count, explicit } = parseHitCount(prompt);

  const words = prompt.toLowerCase().split(/[\s,;.!?]+/);
  const foundTypes: HitType[] = [];
  const matchedKeywords: MatchedComboKeyword[] = [];
  const seenWords = new Set<string>();
  for (const word of words) {
    const type = KEYWORD_MAP[word];
    if (!type) continue;
    if (!seenWords.has(word)) {
      seenWords.add(word);
      matchedKeywords.push({ word, type });
    }
    if (!foundTypes.includes(type)) foundTypes.push(type);
  }

  const typesRecognized = foundTypes.length > 0;
  const hitTypes: HitType[] = typesRecognized ? [...foundTypes] : ['light', 'medium', 'heavy'];
  while (hitTypes.length < count) {
    hitTypes.push(hitTypes[hitTypes.length - 1]);
  }

  return {
    count,
    countExplicit: explicit,
    hitTypes: hitTypes.slice(0, count),
    matchedKeywords,
    typesRecognized,
  };
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function generateCombo(prompt: string): GeneratedCombo {
  const parseInfo = parseComboInput(prompt);
  const { count, hitTypes } = parseInfo;
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
    // Guard against a 0s combo (empty/degenerate input) → avoid NaN DPS.
    avgDPS: Math.round(safeDivide(totalDamage, totalDuration)),
    parseInfo,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   UE5 CODE GENERATION
   ══════════════════════════════════════════════════════════════════════════ */

export function generateMontageCode(combo: GeneratedCombo): string {
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

export function generateJSON(combo: GeneratedCombo): string {
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
