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
  RawStringUnit,
} from '@/types/localization-pipeline';
import { CONTEXT_NAMESPACES, LOW_CONFIDENCE } from './definitions';
import { hashString } from './hash';
import { getSampleStrings } from './fixtures';

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

/** Rules read a unit's real source line (`snippet`) and its resolved context — never a fixture record. */
interface HazardRule {
  type: HazardType;
  severity: HazardSeverity;
  detect: (s: RawStringUnit, context: StringContext) => { match: boolean; evidence: string; suggestion: string } | null;
}

const HAZARD_RULES: HazardRule[] = [
  {
    type: 'text_concatenation',
    severity: 'critical',
    detect: (s) => {
      if (s.snippet.includes('+') && (s.snippet.includes('FString') || s.snippet.includes('TEXT('))) {
        return {
          match: true,
          evidence: s.snippet,
          suggestion: `Use FText::Format with ordered arguments instead of string concatenation. Example: FText::Format(LOCTEXT("Key", "{0} over {1}"), Amount, Duration)`,
        };
      }
      return null;
    },
  },
  {
    type: 'text_expansion',
    severity: 'warning',
    detect: (s, context) => {
      if (s.text.length > 20 && (context === 'ui_button' || context === 'ui_label' || context === 'stat_label')) {
        return {
          match: true,
          evidence: `"${s.text}" (${s.text.length} chars) in ${context} context — German translation could be ~${Math.ceil(s.text.length * 1.35)} chars`,
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
    detect: (s, context) => {
      if (s.text.length > 40 && context === 'item_tooltip') {
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
/*  Demo corpus as units                                               */
/* ------------------------------------------------------------------ */

/**
 * The demo corpus adapted to the scanner's one input shape. Each sample sits on its own
 * line of its demo file, in corpus order, so its location is a position in the (labelled)
 * demo corpus rather than a number derived from a hash.
 */
export function fixtureUnits(): RawStringUnit[] {
  const nextLine: Record<string, number> = {};
  return getSampleStrings().map((sample) => {
    const snippet = sample.codeTemplate.replace('{0}', sample.text);
    const quote = snippet.indexOf('"');
    nextLine[sample.fileHint] = (nextLine[sample.fileHint] ?? 0) + 1;
    return {
      text: sample.text,
      usage: sample.usage,
      filePath: sample.fileHint,
      line: nextLine[sample.fileHint],
      column: quote + 1,
      snippet,
      identifierHint: snippet.slice(0, Math.max(quote, 0)).trim(),
      declaredContext: sample.contextHint,
    };
  });
}

/* ------------------------------------------------------------------ */
/*  Main Scan Function                                                 */
/* ------------------------------------------------------------------ */

/** Scan the demo corpus (no UE project configured). */
export function scanForLocalizableStrings(moduleFilter?: string[]): ScanResult {
  return scanFromUnits(fixtureUnits(), moduleFilter);
}

/** Classify, context-tag and hazard-check extracted units; locations are the units' own. */
export function scanFromUnits(units: RawStringUnit[], moduleFilter?: string[]): ScanResult {
  const strings: LocalizableString[] = [];
  const hazards: LocalizationHazard[] = [];
  const moduleBreakdown: Record<string, { total: number; hardcoded: number; localized: number }> = {};
  const seenIds = new Set<string>();

  let hardcodedCount = 0;
  let ftextFromStringCount = 0;
  let alreadyLocalizedCount = 0;

  const filteredUnits = moduleFilter
    ? units.filter((u) => {
        const mod = detectModule(u.filePath);
        return moduleFilter.includes(mod) || mod === 'unknown';
      })
    : units;

  for (const unit of filteredUnits) {
    const mod = detectModule(unit.filePath);
    if (!moduleBreakdown[mod]) {
      moduleBreakdown[mod] = { total: 0, hardcoded: 0, localized: 0 };
    }
    moduleBreakdown[mod].total++;

    const { context, confidence } = detectContext(unit.snippet, `${unit.identifierHint} ${unit.filePath}`);
    const finalContext = confidence > 0.5 ? context : unit.declaredContext ?? context;
    const namespace = CONTEXT_NAMESPACES[finalContext];
    const locKey = unit.key ?? generateLocKey(unit.text, finalContext);
    let id = `str_${hashString(unit.text + unit.filePath).toString(36)}`;
    if (seenIds.has(id)) id = `${id}_${unit.line}_${unit.column}`;
    seenIds.add(id);

    const location: StringLocation = {
      filePath: unit.filePath,
      lineNumber: unit.line,
      columnStart: unit.column,
      columnEnd: unit.column + unit.text.length + 2,
      codeSnippet: unit.snippet,
    };

    if (unit.usage === 'nsloctext' || unit.usage === 'loctext') {
      alreadyLocalizedCount++;
      moduleBreakdown[mod].localized++;
    } else if (unit.usage === 'hardcoded') {
      hardcodedCount++;
      moduleBreakdown[mod].hardcoded++;
    } else {
      ftextFromStringCount++;
      moduleBreakdown[mod].hardcoded++;
    }

    strings.push({
      id,
      sourceText: unit.text,
      context: finalContext,
      currentUsage: unit.usage,
      locNamespace: namespace,
      locKey,
      locations: [location],
      sourceModule: mod,
      detectionConfidence: Math.max(confidence, LOW_CONFIDENCE),
    });

    for (const rule of HAZARD_RULES) {
      const result = rule.detect(unit, finalContext);
      if (result) {
        hazards.push({
          id: `haz_${hashString(`${result.evidence}@${unit.filePath}:${unit.line}`).toString(36)}`,
          type: rule.type,
          severity: rule.severity,
          description: result.evidence,
          evidence: result.evidence,
          location,
          suggestion: result.suggestion,
          fixPrompt: `Fix the ${rule.type.replace(/_/g, ' ')} issue in ${unit.filePath}:${unit.line} — ${result.suggestion}`,
        });
      }
    }
  }

  const filesSet = new Set(filteredUnits.map((u) => u.filePath));

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
/*  Translatable predicate (single source of truth)                    */
/* ------------------------------------------------------------------ */

/**
 * A string is "translatable" when it is not already wrapped in a LOCTEXT /
 * NSLOCTEXT macro. This predicate is the single source of truth for the filter
 * that was previously copy-pasted across the route, translation engine and the
 * replacement generator — share it so the definition can never drift.
 */
export function isTranslatable(s: LocalizableString): boolean {
  return s.currentUsage !== 'nsloctext' && s.currentUsage !== 'loctext';
}

/* ------------------------------------------------------------------ */
/*  LOCTEXT Replacement Generator                                      */
/* ------------------------------------------------------------------ */

export function generateLOCTEXTReplacements(
  strings: LocalizableString[],
  rootNamespace: string,
): LOCTEXTReplacementSuggestion[] {
  return strings
    .filter(isTranslatable)
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
