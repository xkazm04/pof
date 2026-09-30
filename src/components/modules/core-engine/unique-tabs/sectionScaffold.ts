import type { SubModuleId } from '@/types/modules';
import { getSections, type SectionId } from '@/components/modules/core-engine/unique-tabs/feature-map-config';
import { getFeatureInitPrompt } from '@/components/modules/core-engine/unique-tabs/feature-init-prompts';

/**
 * Does a Feature Map section exist in the UE project? — a pure grade.
 *
 * A section's scaffold TARGETS are the classes its init prompt creates: the direct
 * object(s) of a numbered "N. Create …" line (`Create AARPGFoo and AARPGBar …`), read
 * from `getFeatureInitPrompt` so there is no second hand-kept list. A class a line only
 * mentions ("… references in AARPGCharacterBase") or quantifies ("Create 3 UARPGFeelProfile
 * presets") is not a target. The grade compares targets with the project's scanned
 * UCLASS/USTRUCT/UENUM names (`projectStore.dynamicContext.classes`) — never with the
 * CLI's success flag. The Config/*.json exports the prompts ask for are not read by PoF,
 * so they are not evidence either.
 */

export type ScaffoldGrade =
  | { state: 'no-prompt' }
  | { state: 'unverifiable' }
  | { state: 'unscanned'; targets: string[] }
  | { state: 'absent' | 'partial' | 'scaffolded'; present: string[]; missing: string[] };

export type ScaffoldState = ScaffoldGrade['state'];

/** A scanned type name — the only field the grade reads. */
export interface ScannedName { name: string }

const TARGET = /^[AUFE]ARPG\w+$/;
// "N. Create [a|an|the] <T>[, <T>| and <T>]*" — the created type(s), nothing after them.
const CREATE_LINE = /^\s*\d+\.\s*Create\s+(?:(?:a|an|the)\s+)?([AUFE]ARPG\w+(?:\s*(?:,|and)\s*[AUFE]ARPG\w+)*)/;

/** UE's reflected identity drops the one-letter prefix (UHT forbids two types with one body
 *  name), so `UARPGLootBeacon struct` in a prompt is found as the scanned `FARPGLootBeacon`. */
const identity = (name: string) => (/^[AUFEI]ARPG/.test(name) ? name.slice(1) : name);

/** The classes `sectionId`'s init prompt creates, in prompt order, de-duplicated. */
export function scaffoldTargets(moduleId: SubModuleId, sectionId: string): string[] {
  const prompt = getFeatureInitPrompt(moduleId, sectionId)?.prompt;
  if (!prompt) return [];
  const out: string[] = [];
  for (const line of prompt.split('\n')) {
    const m = CREATE_LINE.exec(line);
    if (!m) continue;
    for (const name of m[1].split(/\s*(?:,|\band\b)\s*/)) {
      if (TARGET.test(name) && !out.includes(name)) out.push(name);
    }
  }
  return out;
}

/** Grade one section against the scanned names (`null` = the project was never scanned). */
export function sectionScaffoldState(
  moduleId: SubModuleId,
  sectionId: string,
  classes: readonly ScannedName[] | null,
): ScaffoldGrade {
  if (!getFeatureInitPrompt(moduleId, sectionId)) return { state: 'no-prompt' };
  const targets = scaffoldTargets(moduleId, sectionId);
  if (targets.length === 0) return { state: 'unverifiable' };
  if (!classes) return { state: 'unscanned', targets };
  const scanned = new Set(classes.map((c) => identity(c.name)));
  const present = targets.filter((t) => scanned.has(identity(t)));
  const missing = targets.filter((t) => !scanned.has(identity(t)));
  const state = missing.length === 0 ? 'scaffolded' : present.length === 0 ? 'absent' : 'partial';
  return { state, present, missing };
}

/** Sections still to scaffold (absent | partial), in Feature Map order. */
export function scaffoldQueue(moduleId: SubModuleId, classes: readonly ScannedName[] | null): SectionId[] {
  return getSections(moduleId)
    .map((s) => s.id)
    .filter((id) => {
      const { state } = sectionScaffoldState(moduleId, id, classes);
      return state === 'absent' || state === 'partial';
    });
}
