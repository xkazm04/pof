/**
 * Acceptance: the designer-authored squad (SquadChoreographyEditor's DirectorConfig)
 * reaches UE5 through the ai-5 checklist prompt with its numbers intact.
 *
 * Card eqs-squad-combat-spatial/B (scan-sweep --challenge run challenge-2026-09-28b),
 * cases 1-4 (builder half). Case 3 is the coordinator-revised guard: the ai-5 base text
 * is kept verbatim and the appended formation block names no class of its own.
 */
import { describe, it, expect } from 'vitest';
import { buildSquadBuildPrompt } from '@/lib/ai-director/squad-build-prompt';
import { DEFAULT_DIRECTOR_CONFIG, PRESET_FORMATIONS } from '@/lib/ai-director/squad-engine';
import { getModuleChecklist } from '@/lib/module-registry';
import type { DirectorConfig } from '@/types/squad-tactics';

const ai5 = getModuleChecklist('ai-behavior').find((c) => c.id === 'ai-5');
if (!ai5) throw new Error('ai-behavior checklist has no ai-5 item');
const AI5_PROMPT = ai5.prompt;

const ambush = PRESET_FORMATIONS.find((f) => f.id === 'ambush');
if (!ambush) throw new Error('no ambush preset');
const AMBUSH: DirectorConfig = { ...DEFAULT_DIRECTOR_CONFIG, formation: ambush };

function build(config: DirectorConfig): string {
  const r = buildSquadBuildPrompt(config, AI5_PROMPT);
  if (!r.ok) throw new Error(`expected ok, got ${r.error.code}`);
  return r.data;
}

/** The part of the prompt the builder appended after the ai-5 base text. */
function appendedBlock(text: string): string {
  const at = text.indexOf(AI5_PROMPT);
  expect(at).toBeGreaterThanOrEqual(0);
  return text.slice(0, at) + text.slice(at + AI5_PROMPT.length);
}

describe('buildSquadBuildPrompt', () => {
  it('case 1: lists roles in allocation-priority order with counts, and the authored numbers', () => {
    const text = build(AMBUSH);
    expect(text).toContain('Aggressor x1 → Flanker x1 → Ambusher x2');
    expect(text).toContain('AttackDistance 200');
    expect(text).toContain('MinSeparation 80');
    expect(text).toContain('FlankWeight 0.40');
    expect(text).toContain('SeparationWeight 0.35');
    expect(text).toContain('RangeWeight 0.25');

    // The numbers are read from the config, not typed into the template.
    const tuned = build({ ...AMBUSH, attackDistance: 425, minSeparation: 120, flankWeight: 0.6, separationWeight: 0.1, rangeWeight: 0.3 });
    expect(tuned).toContain('AttackDistance 425');
    expect(tuned).toContain('MinSeparation 120');
    expect(tuned).toContain('FlankWeight 0.60');
    expect(tuned).toContain('SeparationWeight 0.10');
    expect(tuned).toContain('RangeWeight 0.30');
    expect(tuned).not.toContain('FlankWeight 0.40');
  });

  it('case 1b: each role carries its slot preferences (preferred flank angle + engagement range)', () => {
    const block = appendedBlock(build(AMBUSH));
    // ambusher: preferredFlankAngle 160, engagementRange [250, 500]
    expect(block).toMatch(/Ambusher x2[^\n]*160°[^\n]*250[–-]500 UU/);
    // aggressor: 10°, [150, 250]
    expect(block).toMatch(/Aggressor x1[^\n]*10°[^\n]*150[–-]250 UU/);
  });

  it('case 2: carries the EQS generator defaults the app holds in eqs-defaults', () => {
    const text = build(AMBUSH);
    expect(text).toContain('AttackPositions AttackDistance 200.0');
    expect(text).toContain('NumberOfPoints 12');
    expect(text).toContain('ClampMin = 4, ClampMax = 36');
    expect(text).toContain('bGenerateInnerRing false');
  });

  it('[guard] case 3: keeps the ai-5 base text verbatim; the formation block names no class of its own', () => {
    const text = build(AMBUSH);
    expect(text).toContain(AI5_PROMPT);
    expect(text).toContain('UAISquadManager');
    expect(text).toContain('RESERVATION system owned by each target');

    const block = appendedBlock(text);
    expect(block).not.toContain('UARPGSquadDirector');
    expect(block).not.toContain('UWorldSubsystem');
    expect(block).not.toMatch(/\bclass\s+U/);
    expect(block).not.toContain('UCLASS');
    // Roles / slot preferences are framed as inputs to ai-5's role assignment and
    // the target-owned slot ring, not as a commander of their own.
    expect(block).toMatch(/role assignment/i);
    expect(block).toMatch(/target-owned (?:reservation|slot) ring/i);
  });

  it('case 4: an empty formation is rejected with a typed empty-formation error', () => {
    const r = buildSquadBuildPrompt(
      { ...AMBUSH, formation: { ...ambush, roles: [], size: 0 } },
      AI5_PROMPT,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('empty-formation');
  });
});
