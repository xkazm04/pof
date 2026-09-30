import { describe, it, expect } from 'vitest';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { parseHeader, checkExpectations } from '@/lib/cpp-semantic-parser';
import { getExpectationsForItem } from '@/lib/checklist-expectations';
import { ARPG_CHECKLISTS } from '@/lib/module-registry';
import fixture from './save-points-produce.fixture.json';

/**
 * One save-field vocabulary (scan-sweep --challenge save-system/A).
 *
 * `@/lib/save-schema/fields` is the single authority for the UARPGSaveGame field
 * set. The save-points pipeline, the as-1 semantic verifier, the as-1 CLI prompt
 * and the Save tab all derive from it. The produce guard pins the pipeline's
 * output to a fixture captured before the refactor, so no stored
 * pipeline_artifacts row or judge verdict is invalidated.
 */

const loadFields = () => import('@/lib/save-schema/fields');

const EXPECTED_KEYS = [
  'playerLevel', 'playerAttributes', 'inventoryItems', 'walletGold', 'walletOrbs',
  'defeatedEnemyTags', 'completedQuestStages', 'unlockedZoneIds', 'checkpointActorTag',
  'repStandings', 'passivePoints', 'passiveAllocations', 'activeSaveSlot', 'saveTimestamp',
];

const pascal = (s: string) => s[0].toUpperCase() + s.slice(1);

async function savePointsPipeline() {
  await import('@/lib/catalog/pipelines/save-points');
  const p = getCatalogPipeline('save-points');
  if (!p) throw new Error('save-points pipeline not registered');
  return p;
}

describe('save-schema fields — the single UARPGSaveGame vocabulary', () => {
  it('SAVE_PERSISTED_FIELDS lists the 14 canon fields in order, ueName = PascalCase(key), version 1', async () => {
    const { SAVE_PERSISTED_FIELDS, SAVE_SCHEMA_VERSION } = await loadFields();
    expect(SAVE_PERSISTED_FIELDS.map((f) => f.key)).toEqual(EXPECTED_KEYS);
    for (const f of SAVE_PERSISTED_FIELDS) expect(f.ueName).toBe(pascal(f.key));
    expect(SAVE_PERSISTED_FIELDS.map((f) => f.ueName)).toEqual(EXPECTED_KEYS.map(pascal));
    expect(SAVE_SCHEMA_VERSION).toBe(1);
  });

  it('[guard] save-points State Schema + Versioning produce output is byte-identical to the base fixture', async () => {
    const p = await savePointsPipeline();
    const entity = { id: 'x', name: 'Ember Shrine' } as never;
    const state = p.steps.find((s) => s.label === 'State Schema')!;
    const versioning = p.steps.find((s) => s.label === 'Versioning & Migration')!;
    // JSON round-trip: the fixture is JSON, so compare the JSON-visible shape exactly.
    expect(JSON.parse(JSON.stringify(state.produce(entity).data))).toEqual(fixture.stateSchema);
    expect(JSON.parse(JSON.stringify(versioning.produce(entity).data))).toEqual(fixture.versioning);
    expect(JSON.stringify(state.produce(entity).data)).toBe(JSON.stringify(fixture.stateSchema));
  });

  it('a canon-authored UARPGSaveGame header verifies "full" against as-1 with nothing missing', async () => {
    const { SAVE_PERSISTED_FIELDS } = await loadFields();
    const header = [
      '#pragma once',
      '#include "GameFramework/SaveGame.h"',
      '#include "ARPGSaveGame.generated.h"',
      'UCLASS()',
      'class DID_API UARPGSaveGame : public USaveGame',
      '{',
      '  GENERATED_BODY()',
      'public:',
      '  UPROPERTY(SaveGame) int32 SchemaVersion = 1;',
      ...SAVE_PERSISTED_FIELDS.map((f) => `  UPROPERTY(SaveGame) ${f.ueType} ${f.ueName};`),
      '};',
    ].join('\n');
    const result = checkExpectations(parseHeader(header, 'ARPGSaveGame.h'), getExpectationsForItem('as-1')!.primary);
    expect(result.missingProperties).toEqual([]);
    expect(result.status).toBe('full');
  });

  it('as-1 expectedProperties = SchemaVersion + every persisted ueName', async () => {
    const { SAVE_PERSISTED_FIELDS } = await loadFields();
    expect(getExpectationsForItem('as-1')!.primary.expectedProperties).toEqual([
      'SchemaVersion',
      ...SAVE_PERSISTED_FIELDS.map((f) => f.ueName),
    ]);
  });

  it('the arpg-save as-1 prompt names UARPGSaveGame, SchemaVersion and every persisted ueName', async () => {
    const { SAVE_PERSISTED_FIELDS } = await loadFields();
    const item = ARPG_CHECKLISTS['arpg-save'].find((i) => i.id === 'as-1')!;
    expect(item.prompt).toContain('UARPGSaveGame');
    expect(item.prompt).toContain('SchemaVersion');
    const missing = SAVE_PERSISTED_FIELDS.map((f) => f.ueName).filter((n) => !item.prompt.includes(n));
    expect(missing).toEqual([]);
  });

  it('Save tab SCHEMA_GROUPS is exactly SchemaVersion + the persisted ueNames (no fictional fields)', async () => {
    const { SAVE_PERSISTED_FIELDS } = await loadFields();
    const { SCHEMA_GROUPS } = await import('@/components/modules/core-engine/sub_save/_shared/data');
    const names = SCHEMA_GROUPS.flatMap((g) => g.fields.map((f) => f.name));
    expect(names).toHaveLength(new Set(names).size);
    expect(new Set(names)).toEqual(new Set(['SchemaVersion', ...SAVE_PERSISTED_FIELDS.map((f) => f.ueName)]));
    expect(names).not.toContain('ForceAlignment');
    expect(names).not.toContain('LightsaberCrystalColor');
  });

  it('Save tab version history and version check agree with SAVE_SCHEMA_VERSION and the tree', async () => {
    const { SAVE_SCHEMA_VERSION } = await loadFields();
    const { SCHEMA_GROUPS, SCHEMA_VERSIONS } = await import('@/components/modules/core-engine/sub_save/_shared/data');
    const { VALIDATION_CHECKS } = await import('@/components/modules/core-engine/sub_save/_shared/data-panels');
    const current = SCHEMA_VERSIONS.filter((v) => v.isCurrent);
    expect(current).toHaveLength(1);
    expect(current[0].version).toBe(`v${SAVE_SCHEMA_VERSION}.0.0`);
    const treeNames = new Set(SCHEMA_GROUPS.flatMap((g) => g.fields.map((f) => f.name)));
    const stray = SCHEMA_VERSIONS.flatMap((v) => v.changes.map((c) => c.field)).filter((f) => !treeNames.has(f));
    expect(stray).toEqual([]);
    const versionCheck = VALIDATION_CHECKS.find((c) => c.id === 'version')!;
    expect(versionCheck.detail).toContain(current[0].version);
    expect(versionCheck.detail).not.toContain('v1.2.5');
  });
});
