/* ------------------------------------------------------------------ */
/*  Localization Pipeline — String Scanner & Hazard Detector          */
/* ------------------------------------------------------------------ */

import type {
  LocalizableString,
  LocalizationHazard,
  LOCTEXTReplacementSuggestion,
  ScanResult,
  StringContext,
  StringLocation,
  HazardType,
  HazardSeverity,
} from '@/types/localization-pipeline';
import { CONTEXT_NAMESPACES, LOW_CONFIDENCE } from './definitions';
import { hashString } from './hash';
import { getSampleStrings, type SampleString } from './fixtures';

/* ------------------------------------------------------------------ */
/*  Context Detection                                                  */
/* ------------------------------------------------------------------ */

const CONTEXT_HINTS: { pattern: RegExp; context: StringContext; confidence: number }[] = [
  { pattern: /AbilityName|AbilityLabel|Ability.*Display/i, context: 'ability_name', confidence: 0.95 },
  { pattern: /AbilityDesc|AbilityTooltip|Ability.*Description/i, context: 'ability_description', confidence: 0.9 },
  { pattern: /ItemName|Item.*Display|DisplayName/i, context: 'item_name', confidence: 0.9 },
  { pattern: /Tooltip|ItemDesc|Item.*Description/i, context: 'item_tooltip', confidence: 0.85 },
  { pattern: /ButtonText|Button.*Label|Btn/i, context: 'ui_button', confidence: 0.9 },
  { pattern: /MenuTitle|Menu.*Header|MenuName/i, context: 'menu_title', confidence: 0.9 },
  { pattern: /QuestName|Quest.*Title|QuestLabel/i, context: 'quest_title', confidence: 0.9 },
  { pattern: /QuestDesc|Quest.*Description|Objective/i, context: 'quest_description', confidence: 0.85 },
  { pattern: /Dialogue|Speech|SayLine|NPCText/i, context: 'dialogue_line', confidence: 0.9 },
  { pattern: /StatName|Stat.*Label|AttributeLabel/i, context: 'stat_label', confidence: 0.85 },
  { pattern: /Notification|Alert|Toast|Message/i, context: 'notification', confidence: 0.8 },
  { pattern: /Tutorial|Hint|Help.*Text/i, context: 'tutorial', confidence: 0.8 },
  { pattern: /SetText|Label|Header|Title|Caption/i, context: 'ui_label', confidence: 0.6 },
];

function detectContext(codeSnippet: string, surroundingCode: string): { context: StringContext; confidence: number } {
  const combined = `${surroundingCode} ${codeSnippet}`;
  for (const hint of CONTEXT_HINTS) {
    if (hint.pattern.test(combined)) {
      return { context: hint.context, confidence: hint.confidence };
    }
  }
  return { context: 'unknown', confidence: 0.3 };
}

/* ------------------------------------------------------------------ */
/*  Module Detection from file path                                    */
/* ------------------------------------------------------------------ */

const MODULE_HINTS: { pattern: RegExp; module: string }[] = [
  { pattern: /character|player|movement/i, module: 'arpg-character' },
  { pattern: /abilit|spell|skill|gas/i, module: 'arpg-abilities' },
  { pattern: /inventor|item|equip|slot/i, module: 'arpg-inventory' },
  { pattern: /menu|hud|widget|ui/i, module: 'arpg-menu-flow' },
  { pattern: /dialog|quest|npc|conversation/i, module: 'arpg-dialogue-quests' },
  { pattern: /combat|damage|hit|attack/i, module: 'arpg-combat' },
  { pattern: /loot|drop|reward|treasure/i, module: 'arpg-loot' },
  { pattern: /ai|behavior|bt|blackboard/i, module: 'arpg-ai' },
  { pattern: /save|load|serial|persist/i, module: 'arpg-save-load' },
  { pattern: /audio|sound|music/i, module: 'arpg-audio' },
];

function detectModule(filePath: string): string {
  for (const hint of MODULE_HINTS) {
    if (hint.pattern.test(filePath)) return hint.module;
  }
  return 'unknown';
}

/* ------------------------------------------------------------------ */
/*  LOCTEXT Key Generation                                             */
/* ------------------------------------------------------------------ */

function generateLocKey(text: string, context: StringContext): string {
  const sanitized = text
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
  return `${sanitized}_${hashString(text).toString(36).slice(0, 4)}`;
}

/* ------------------------------------------------------------------ */
/*  Hazard Detection                                                   */
/* ------------------------------------------------------------------ */

interface HazardRule {
  type: HazardType;
  severity: HazardSeverity;
  detect: (s: SampleString) => { match: boolean; evidence: string; suggestion: string } | null;
}

const HAZARD_RULES: HazardRule[] = [
  {
    type: 'text_concatenation',
    severity: 'critical',
    detect: (s) => {
      if (s.codeTemplate.includes('+') && (s.codeTemplate.includes('FString') || s.codeTemplate.includes('TEXT('))) {
        return {
          match: true,
          evidence: s.codeTemplate.replace('{0}', s.text),
          suggestion: `Use FText::Format with ordered arguments instead of string concatenation. Example: FText::Format(LOCTEXT("Key", "{0} over {1}"), Amount, Duration)`,
        };
      }
      return null;
    },
  },
  {
    type: 'text_expansion',
    severity: 'warning',
    detect: (s) => {
      if (s.text.length > 20 && (s.contextHint === 'ui_button' || s.contextHint === 'ui_label' || s.contextHint === 'stat_label')) {
        return {
          match: true,
          evidence: `"${s.text}" (${s.text.length} chars) in ${s.contextHint} context — German translation could be ~${Math.ceil(s.text.length * 1.35)} chars`,
          suggestion: `Ensure the UI widget for this text has flexible width or text wrapping enabled. Consider shorter source text.`,
        };
      }
      return null;
    },
  },
  {
    type: 'idiom',
    severity: 'warning',
    detect: (s) => {
      const idioms = ['second chance', 'forsaken land', 'at the drop of', 'piece of cake', 'break a leg'];
      const lower = s.text.toLowerCase();
      const found = idioms.find((id) => lower.includes(id));
      if (found) {
        return {
          match: true,
          evidence: `"${s.text}" contains idiomatic expression "${found}"`,
          suggestion: `Replace with a more literal description that translates naturally across languages.`,
        };
      }
      return null;
    },
  },
  {
    type: 'plural_form',
    severity: 'warning',
    detect: (s) => {
      if (/\d+\s+(second|minute|hour|day|item|point|enemy|enemies)s?/i.test(s.text)) {
        return {
          match: true,
          evidence: `"${s.text}" has embedded plural that won't work in Russian/Polish/Arabic`,
          suggestion: `Use FText::Format with FText::AsNumber and plural forms: {0}|plural(one=second,other=seconds)`,
        };
      }
      return null;
    },
  },
  {
    type: 'number_format',
    severity: 'info',
    detect: (s) => {
      if (/\d{1,3}(,\d{3})+(\.\d+)?/.test(s.text) || /\d+\.\d+/.test(s.text)) {
        return {
          match: true,
          evidence: `"${s.text}" has hardcoded number format`,
          suggestion: `Use FText::AsNumber() for locale-aware number formatting`,
        };
      }
      return null;
    },
  },
  {
    type: 'hardcoded_layout',
    severity: 'info',
    detect: (s) => {
      if (s.text.length > 40 && s.contextHint === 'item_tooltip') {
        return {
          match: true,
          evidence: `Long tooltip "${s.text.slice(0, 50)}..." may overflow in fixed-width tooltip widget`,
          suggestion: `Ensure tooltip widget uses auto-sized text block with MaxDesiredWidth, not fixed width.`,
        };
      }
      return null;
    },
  },
];

/* ------------------------------------------------------------------ */
/*  Main Scan Function                                                 */
/* ------------------------------------------------------------------ */

export function scanForLocalizableStrings(moduleFilter?: string[]): ScanResult {
  const strings: LocalizableString[] = [];
  const hazards: LocalizationHazard[] = [];
  const moduleBreakdown: Record<string, { total: number; hardcoded: number; localized: number }> = {};

  let hardcodedCount = 0;
  let ftextFromStringCount = 0;
  let alreadyLocalizedCount = 0;

  const sampleStrings = getSampleStrings();
  const filteredSamples = moduleFilter
    ? sampleStrings.filter((s) => {
        const mod = detectModule(s.fileHint);
        return moduleFilter.includes(mod) || mod === 'unknown';
      })
    : sampleStrings;

  for (const sample of filteredSamples) {
    const mod = detectModule(sample.fileHint);
    if (!moduleBreakdown[mod]) {
      moduleBreakdown[mod] = { total: 0, hardcoded: 0, localized: 0 };
    }
    moduleBreakdown[mod].total++;

    const { context, confidence } = detectContext(sample.codeTemplate, sample.fileHint);
    const finalContext = confidence > 0.5 ? context : sample.contextHint;
    const namespace = CONTEXT_NAMESPACES[finalContext];
    const locKey = generateLocKey(sample.text, finalContext);
    const id = `str_${hashString(sample.text + sample.fileHint).toString(36)}`;

    const lineNum = 10 + Math.floor(hashString(sample.text) % 200);
    const location: StringLocation = {
      filePath: sample.fileHint,
      lineNumber: lineNum,
      columnStart: 4,
      columnEnd: 4 + sample.codeTemplate.length,
      codeSnippet: sample.codeTemplate.replace('{0}', sample.text),
    };

    if (sample.usage === 'nsloctext' || sample.usage === 'loctext') {
      alreadyLocalizedCount++;
      moduleBreakdown[mod].localized++;
    } else if (sample.usage === 'hardcoded') {
      hardcodedCount++;
      moduleBreakdown[mod].hardcoded++;
    } else {
      ftextFromStringCount++;
      moduleBreakdown[mod].hardcoded++;
    }

    strings.push({
      id,
      sourceText: sample.text,
      context: finalContext,
      currentUsage: sample.usage,
      locNamespace: namespace,
      locKey,
      locations: [location],
      sourceModule: mod,
      detectionConfidence: Math.max(confidence, LOW_CONFIDENCE),
    });

    // Check hazards
    for (const rule of HAZARD_RULES) {
      const result = rule.detect(sample);
      if (result) {
        hazards.push({
          id: `haz_${hashString(result.evidence).toString(36)}`,
          type: rule.type,
          severity: rule.severity,
          description: result.evidence,
          evidence: result.evidence,
          location,
          suggestion: result.suggestion,
          fixPrompt: `Fix the ${rule.type.replace(/_/g, ' ')} issue in ${sample.fileHint}:${lineNum} — ${result.suggestion}`,
        });
      }
    }
  }

  const filesSet = new Set(filteredSamples.map((s) => s.fileHint));

  return {
    totalFilesScanned: filesSet.size,
    totalStringsFound: strings.length,
    hardcodedCount,
    ftextFromStringCount,
    alreadyLocalizedCount,
    strings,
    hazards,
    moduleBreakdown,
  };
}

/* ------------------------------------------------------------------ */
/*  LOCTEXT Replacement Generator                                      */
/* ------------------------------------------------------------------ */

export function generateLOCTEXTReplacements(
  strings: LocalizableString[],
  rootNamespace: string,
): LOCTEXTReplacementSuggestion[] {
  return strings
    .filter((s) => s.currentUsage !== 'nsloctext' && s.currentUsage !== 'loctext')
    .map((s) => {
      const loc = s.locations[0];
      const original = loc?.codeSnippet ?? '';

      let suggested: string;
      if (original.includes('FText::FromString')) {
        suggested = original.replace(
          /FText::FromString\([^)]*\)/,
          `NSLOCTEXT("${rootNamespace}.${s.locNamespace}", "${s.locKey}", "${s.sourceText}")`,
        );
      } else {
        suggested = `NSLOCTEXT("${rootNamespace}.${s.locNamespace}", "${s.locKey}", "${s.sourceText}")`;
      }

      return {
        stringId: s.id,
        originalCode: original,
        suggestedCode: suggested,
      };
    });
}

/* ------------------------------------------------------------------ */
/*  String Table Generator                                             */
/* ------------------------------------------------------------------ */

export function generateStringTable(
  strings: LocalizableString[],
  rootNamespace: string,
): { tableId: string; namespace: string; rows: { key: string; sourceString: string; comment: string }[] }[] {
  const byNamespace: Record<string, LocalizableString[]> = {};
  for (const s of strings) {
    const ns = s.locNamespace;
    if (!byNamespace[ns]) byNamespace[ns] = [];
    byNamespace[ns].push(s);
  }

  return Object.entries(byNamespace).map(([ns, items]) => ({
    tableId: `ST_${rootNamespace}_${ns}`,
    namespace: `${rootNamespace}.${ns}`,
    rows: items.map((s) => ({
      key: s.locKey,
      sourceString: s.sourceText,
      comment: `[${s.context}] from ${s.sourceModule}`,
    })),
  }));
}
