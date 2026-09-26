import { describe, expect, it } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { parseRuntimeDeferredTestName } from '@/types/observation';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import { automationNameDeclared } from '@/lib/catalog/acceptance/deferred';

const step = (catalogId: string, label: string) => {
  const found = getCatalogPipeline(catalogId)?.steps.find((candidate) => candidate.label === label);
  if (!found) throw new Error(`missing registered step ${catalogId} · ${label}`);
  return found;
};

const inventedEntity = (id: string, name: string): LabEntity => ({
  id,
  name,
  lifecycle: 'planned',
  data: {},
});

describe('world-neutral graders A', () => {
  it('automationNameDeclared rejects missing and mistyped runtime-test declarations', () => {
    const accept = automationNameDeclared();
    expect(accept({ automationName: 'PoF.Invented.EntityConfig' }).status).toBe('pass');
    for (const artifact of [{}, { automationName: '' }, { automationName: 42 }]) {
      const result = accept(artifact);
      expect(result.status).toBe('fail');
      expect(result.reason).toContain('automationName');
    }
  });

  it('dialog conditions/effects grade entry schema, not Gatekeeper path names', () => {
    const accept = step('dialog-trees', 'Conditions & Effects').accept;
    const artifact = {
      conditionsEffects: [{ node: 'moon_riddle', condition: 'Player carries the silver seal', effect: 'Open the observatory door' }],
    };
    expect(accept(artifact).status).toBe('pass');

    const incomplete = { conditionsEffects: [{ node: 'moon_riddle', condition: 'Player carries the silver seal' }] };
    const result = accept(incomplete);
    expect(result.status).toBe('fail');
    expect(result.reason).toContain('effect');
  });

  it('dialog camera grades phase entry schema, not Vael shot names', () => {
    const accept = step('dialog-trees', 'Camera').accept;
    const artifact = {
      camera: [{ phase: 'telescope_reveal', shot: 'Wide orbit around the brass telescope', anchor: 'Observatory balcony rail' }],
    };
    expect(accept(artifact).status).toBe('pass');

    const incomplete = { camera: [{ phase: 'telescope_reveal', shot: 'Wide orbit around the brass telescope' }] };
    const result = accept(incomplete);
    expect(result.status).toBe('fail');
    expect(result.reason).toContain('anchor');
  });

  it('character behavior requires dialogueBinding only for a declared dialogue interaction', () => {
    const accept = step('characters', 'Behavior (NPC)').accept;
    const artifact = {
      behavior: {
        role: 'Cartographer',
        npcId: 'MiraQuill',
        interactions: [{ type: 'dialogue', dialogueBinding: 'dialog-mira-star-chart' }],
      },
    };
    expect(accept(artifact).status).toBe('pass');
    expect(accept({ behavior: { role: 'Boss', npcId: 'IronWarden', interactions: [{ type: 'combat' }] } }).status).toBe('pass');

    const incomplete = {
      behavior: { role: 'Cartographer', npcId: 'MiraQuill', interactions: [{ type: 'dialogue' }] },
    };
    const result = accept(incomplete);
    expect(result.status).toBe('fail');
    expect(result.reason).toContain('dialogueBinding');
  });

  it('codex spoiler tagging grades spoiler gate entry schema, not Sundering revelations', () => {
    const accept = step('codex', 'Spoiler Tagging').accept;
    const artifact = {
      spoilerRules: [{ field: 'astronomerIdentity', spoilerTag: 'State.Codex.Spoiler.Starfall.Identity', gateCondition: 'Reveal after the lens is repaired' }],
    };
    expect(accept(artifact).status).toBe('pass');

    const incomplete = {
      spoilerRules: [{ field: 'astronomerIdentity', spoilerTag: 'State.Codex.Spoiler.Starfall.Identity' }],
    };
    const result = accept(incomplete);
    expect(result.status).toBe('fail');
    expect(result.reason).toContain('gateCondition');
  });

  it('state persistence grades decision entry schema, not enemy AI fields', () => {
    const accept = step('state-graph', 'Persistence').accept;
    const artifact = {
      persistence: [{ field: 'DoorUnlocked', saved: true, rationale: 'The opened shortcut remains available after reload' }],
    };
    expect(accept(artifact).status).toBe('pass');

    const incomplete = { persistence: [{ field: 'DoorUnlocked', saved: true }] };
    const result = accept(incomplete);
    expect(result.status).toBe('fail');
    expect(result.reason).toContain('rationale');
  });

  it.each([
    {
      catalogId: 'characters',
      entity: inventedEntity('char-iron-warden', 'Iron Warden'),
      expected: 'PoF.CharacterIronWarden.RoleConfig',
      forbiddenFallback: 'PoF.CharacterVael.NPCConfig',
    },
    {
      catalogId: 'bestiary',
      entity: inventedEntity('bestiary-glass-moth', 'Glass Moth'),
      expected: 'PoF.Bestiary.GlassMoth.ArchetypeConfig',
      forbiddenFallback: 'PoF.Bestiary.BruteArchetypeConfig',
    },
    {
      catalogId: 'zone-map',
      entity: inventedEntity('zone-z-moonfen', 'Moon Fen'),
      expected: 'PoF.Zone.MoonFen.Setup',
      forbiddenFallback: 'AshenForestSetupTest',
    },
  ])('$catalogId Test Gate uses the invented entity automation name', ({ catalogId, entity, expected, forbiddenFallback }) => {
    const gate = step(catalogId, 'Test Gate');
    const artifact = gate.produce(entity).data ?? {};
    const result = gate.accept(artifact);
    expect(result.status).toBe('deferred');
    expect(parseRuntimeDeferredTestName(result.reason)).toBe(expected);

    const withoutAutomationName = { ...artifact };
    delete withoutAutomationName.automationName;
    const missing = gate.accept(withoutAutomationName);
    expect(missing.status).toBe('fail');
    expect(missing.reason).toContain('automationName');
    expect(missing.reason).not.toContain(forbiddenFallback);
  });
});
