/**
 * Plain-language explainer for Blueprint transpiler output and semantic diffs.
 *
 * Goal: take the structured TranspileResult / SemanticChange objects produced
 * by the transpiler pipeline and derive jargon-free, one-line narrations that
 * non-engineers (designers, producers) can read.
 *
 * The explanations are derived directly from the typed result structure (NOT
 * scraped from generated text), so they stay accurate whenever the transpiler
 * output changes — same source of truth as the code itself.
 */

import type {
  BlueprintAsset,
  SemanticChange,
  SemanticDiffResult,
  TranspileResult,
} from '@/types/blueprint';
import {
  CHANGE_TYPE_LABELS,
  CONFLICT_LEVEL_LABELS,
  lookupJargon,
} from './blueprint-jargon';

export interface PlainExplanation {
  /** What this thing does in one jargon-free sentence. */
  what: string;
  /** Why a non-engineer should care (one sentence). Optional. */
  whyItMatters?: string;
}

export interface TranspileExplanation {
  /** Top-level summary of the whole generated class. */
  summary: PlainExplanation;
  /** One explanation per logical section (class, properties, events, functions). */
  sections: Array<{
    id: string;
    title: string;
    explanation: PlainExplanation;
  }>;
}

// ─── SemanticChange explainer ───────────────────────────────────────────────

/**
 * Build a plain-language explanation for a single SemanticChange.
 * Uses the typed scope/type/conflict fields rather than parsing the raw
 * description string — so the explanation stays accurate to the actual diff.
 */
export function explainSemanticChange(change: SemanticChange): PlainExplanation {
  const subjectLabel = subjectFor(change);
  const changeLabel = CHANGE_TYPE_LABELS[change.type]?.term.toLowerCase() ?? change.type;

  // Special-case the most informative variants first.
  if (change.type === 'modify' && change.conflictLevel === 'conflict') {
    return {
      what: `The ${change.scope} ${subjectLabel} is defined differently in the Blueprint and the C++ class.`,
      whyItMatters: 'Auto-applying would overwrite one side — pick which version is correct before regenerating.',
    };
  }

  if (change.type === 'add' && change.scope === 'variable') {
    return {
      what: `A new value called ${subjectLabel} was added in the Blueprint and isn't on the C++ side yet.`,
      whyItMatters: 'Regenerating the C++ header will create the matching UPROPERTY automatically.',
    };
  }

  if (change.type === 'add' && change.scope === 'function') {
    return {
      what: `A new function ${subjectLabel} exists in the Blueprint but hasn't been transpiled to C++ yet.`,
      whyItMatters: 'Designers can already call it from other graphs; C++ won\'t see it until you regenerate.',
    };
  }

  if (change.type === 'add' && (change.scope === 'event' || change.scope === 'logic')) {
    return {
      what: `New runtime logic (${subjectLabel}) exists in the Blueprint that the C++ class doesn't handle.`,
      whyItMatters: 'The behavior runs from Blueprint today; promoting it to C++ usually improves performance.',
    };
  }

  if (change.type === 'remove' && change.scope === 'variable') {
    return {
      what: `The C++ has a ${subjectLabel} value that the Blueprint no longer uses.`,
      whyItMatters: 'Could be a C++-only property kept on purpose, or dead state worth cleaning up.',
    };
  }

  if (change.type === 'remove' && change.scope === 'function') {
    return {
      what: `The C++ has a function ${subjectLabel} that the Blueprint no longer references.`,
      whyItMatters: 'Safe to keep if other C++ uses it; remove if it was only there for the old Blueprint.',
    };
  }

  if (change.type === 'rename') {
    return {
      what: `The ${change.scope} ${subjectLabel} has a different name on each side.`,
      whyItMatters: 'Pick the new name everywhere, or save data and external references may break.',
    };
  }

  if (change.type === 'move') {
    return {
      what: `The ${change.scope} ${subjectLabel} lives in a different place on each side.`,
      whyItMatters: 'Behavior is the same — just organisation.',
    };
  }

  // Generic fallback.
  return {
    what: `The ${change.scope} ${subjectLabel} was ${changeLabel} between Blueprint and C++.`,
    whyItMatters: CONFLICT_LEVEL_LABELS[change.conflictLevel]?.whyItMatters,
  };
}

function subjectFor(change: SemanticChange): string {
  return change.name ? `"${change.name}"` : `(unnamed ${change.scope})`;
}

// ─── Diff overview explainer ────────────────────────────────────────────────

/**
 * One-line top-level explanation of the whole diff result.
 */
export function explainDiffOverview(result: SemanticDiffResult): PlainExplanation {
  const total = result.changes.length;
  const conflicts = result.changes.filter((c) => c.conflictLevel === 'conflict').length;
  const compatible = result.changes.filter((c) => c.conflictLevel === 'compatible').length;

  if (total === 0) {
    return {
      what: 'The Blueprint and the C++ class match — nothing has drifted.',
    };
  }

  if (conflicts > 0) {
    return {
      what: `${conflicts} thing${conflicts === 1 ? '' : 's'} disagree between Blueprint and C++ — pick which side wins before regenerating.`,
      whyItMatters: 'Auto-applying could silently overwrite gameplay logic or break save data.',
    };
  }

  return {
    what: `${compatible} difference${compatible === 1 ? '' : 's'} found, all safe to merge — Blueprint is ahead of the C++.`,
    whyItMatters: 'Regenerating the C++ will bring the two sides back in sync without manual edits.',
  };
}

// ─── Transpile explainer ────────────────────────────────────────────────────

/**
 * Build per-section explanations for a transpile result.
 * Sections are inferred from the asset + result, not parsed from the code,
 * so they stay aligned with what was actually generated.
 */
export function explainTranspileResult(
  result: TranspileResult,
  asset: BlueprintAsset | null,
): TranspileExplanation {
  const sections: TranspileExplanation['sections'] = [];

  // ── Class declaration
  sections.push({
    id: 'class',
    title: `class ${result.className}`,
    explanation: {
      what: `Declares ${result.className} as a C++ ${kindOfThing(result.parentClass)} that inherits from ${result.parentClass}.`,
      whyItMatters: 'This is the C++ home for everything the Blueprint used to own — properties, events, and functions.',
    },
  });

  // ── Properties
  const propCount = asset?.variables.length ?? 0;
  if (propCount > 0) {
    const replicated = asset?.variables.filter((v) => v.isReplicated).length ?? 0;
    const editable = asset?.variables.filter((v) => v.isExposedToEditor).length ?? 0;

    const matters = replicated > 0
      ? `${replicated} of them sync across the network so multiplayer clients stay consistent.`
      : editable > 0
        ? `${editable} are exposed to the editor so designers can tweak values without touching code.`
        : 'These are the data fields the Blueprint kept on the instance.';

    sections.push({
      id: 'properties',
      title: `${propCount} propert${propCount === 1 ? 'y' : 'ies'}`,
      explanation: {
        what: `Lists every value the Blueprint stored on this class (e.g. Health, MoveSpeed).`,
        whyItMatters: matters,
      },
    });
  }

  // ── Event overrides
  const eventNodes = asset?.eventGraph.nodes.filter(
    (n) => n.type.includes('Event') && !n.type.includes('Custom'),
  ) ?? [];
  if (eventNodes.length > 0) {
    const names = eventNodes
      .map((n) => n.memberName ?? n.name)
      .filter(Boolean)
      .slice(0, 3)
      .join(', ');
    sections.push({
      id: 'events',
      title: `${eventNodes.length} event override${eventNodes.length === 1 ? '' : 's'}`,
      explanation: {
        what: `Hooks into engine lifecycle events (${names}) — runs custom logic at fixed moments.`,
        whyItMatters: 'BeginPlay runs once when the actor spawns; Tick runs every frame — keep Tick work small.',
      },
    });
  }

  // ── Custom events / functions
  if (result.functionCount > 0) {
    sections.push({
      id: 'functions',
      title: `${result.functionCount} function${result.functionCount === 1 ? '' : 's'}`,
      explanation: {
        what: `Reusable pieces of logic the Blueprint defined — now callable from C++ AND Blueprint.`,
        whyItMatters: 'Marked BlueprintCallable so designers can keep using them from the visual scripting side.',
      },
    });
  }

  // ── Warnings
  if (result.warnings.length > 0) {
    const errors = result.warnings.filter((w) => w.severity === 'error').length;
    sections.push({
      id: 'warnings',
      title: `${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}`,
      explanation: {
        what: errors > 0
          ? `${errors} error${errors === 1 ? '' : 's'} need manual attention — the generated code won't compile until they're handled.`
          : `Some Blueprint nodes don't have an automatic C++ translation and were left as TODOs in the source.`,
        whyItMatters: 'Review each warning; the transpiler is conservative and refuses to guess on unsafe conversions.',
      },
    });
  }

  // ── Top-level summary
  const summary: PlainExplanation = {
    what: `A C++ ${kindOfThing(result.parentClass)} called ${result.className} that mirrors the ${asset?.className ?? 'Blueprint'} graph (${propCount} value${propCount === 1 ? '' : 's'}, ${eventNodes.length} event${eventNodes.length === 1 ? '' : 's'}, ${result.functionCount} function${result.functionCount === 1 ? '' : 's'}).`,
    whyItMatters: 'Once compiled, this code does what the Blueprint did — but faster and with proper version control.',
  };

  return { summary, sections };
}

function kindOfThing(parentClass: string): string {
  if (parentClass === 'ACharacter' || parentClass === 'Character') return 'character';
  if (parentClass === 'APawn' || parentClass === 'Pawn') return 'pawn';
  if (parentClass === 'AActor' || parentClass === 'Actor') return 'actor';
  if (parentClass.includes('Component')) return 'component';
  if (parentClass.startsWith('U')) return 'object';
  return 'class';
}

// ─── Re-export jargon lookup for UI tooltips ────────────────────────────────

export { lookupJargon };
