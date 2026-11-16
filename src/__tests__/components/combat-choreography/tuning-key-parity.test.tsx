import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { simulateEncounter } from '@/lib/combat/choreography-sim';
import { TuningPanel } from '@/components/modules/core-engine/sub_combat/choreography/panels';
import { generateUE5Export } from '@/components/modules/core-engine/sub_combat/choreography/ue5-export';
import { initialEncounterState } from '@/components/modules/core-engine/sub_combat/choreography/encounterDraftStore';
import { FEEDBACK_CHANNEL_COLORS } from '@/components/modules/core-engine/sub_combat/choreography/types';
import type { TuningOverrides } from '@/types/combat-simulator';

afterEach(cleanup);

const s = initialEncounterState();
const lcfirst = (k: string) => k.charAt(0).toLowerCase() + k.slice(1);

/** Keys the exported UPROPERTY Tuning block asserts. */
function exportKeys(): string[] {
  const src = generateUE5Export(s.enemies, s.waves, s.tuning);
  return [...src.matchAll(/Category = "Tuning"\) float (\w+) =/g)].map((m) => lcfirst(m[1])).sort();
}

/** Keys the Tuning Overrides panel lets a designer move. */
function sliderKeys(): string[] {
  const onUpdate = vi.fn();
  const { container } = render(<TuningPanel tuning={s.tuning} onUpdate={onUpdate} onReset={() => {}} />);
  for (const input of container.querySelectorAll('input[type=range]')) fireEvent.change(input, { target: { value: '1.5' } });
  return onUpdate.mock.calls.map((c) => c[0] as string).sort();
}

/** Keys whose value changes the simulation result. */
function simKeys(): string[] {
  const run = (t: TuningOverrides) => JSON.stringify(
    simulateEncounter(s.enemies, s.waves, t, s.playerLevel, FEEDBACK_CHANNEL_COLORS),
  );
  const base = run(s.tuning);
  return (Object.keys(s.tuning) as (keyof TuningOverrides)[])
    .filter((k) => run({ ...s.tuning, [k]: s.tuning[k] * 1.5 }) !== base)
    .map(String).sort();
}

describe('Encounter tuning keys: export == panel == simulation', () => {
  it('the export asserts exactly the keys the panel can tune', () => {
    expect(exportKeys()).toEqual(sliderKeys());
  });
  it('every exported key is one the simulation reads', () => {
    expect(exportKeys()).toEqual(simKeys());
  });
});
