/**
 * The Save tab's "Your save class" audit — pure half.
 *
 * `findSaveGameClasses` resolves every USaveGame-derived class across the project's parsed
 * headers (inheritance chain walked, base properties first); `auditSaveClass` checks one of
 * them against the design field set (`@/lib/save-schema/fields`) and the save canon
 * (canon-seed: in-flight GAS effects and combat targets are never saved; every field-set
 * change bumps the version); `buildSaveFixPrompt` turns an audit into the one CLI task the
 * Fix button dispatches — or null when there is nothing to fix.
 */
import { describe, it, expect } from 'vitest';
import { parseHeader } from '@/lib/cpp-semantic-parser';
import {
  findSaveGameClasses,
  auditSaveClass,
  buildSaveFixPrompt,
  type SaveClass,
} from '@/lib/save-schema/header-audit';
import { saveGamePropertyNames, SAVE_PERSISTED_FIELDS } from '@/lib/save-schema/fields';

/** One UCLASS header declaring `name : public base` with the given UPROPERTY lines. */
function header(name: string, base: string, props: string[]): string {
  return [
    '#pragma once',
    '#include "CoreMinimal.h"',
    'UCLASS(BlueprintType)',
    `class DID_API ${name} : public ${base}`,
    '{',
    '\tGENERATED_BODY()',
    'public:',
    ...props.map((p) => `\t${p};`),
    '};',
    '',
  ].join('\n');
}

/** The single save class declared by `props` on a USaveGame subclass. */
function saveClass(props: string[], name = 'UARPGSaveGame'): SaveClass {
  const found = findSaveGameClasses([parseHeader(header(name, 'USaveGame', props), `Source/Did/Public/${name.slice(1)}.h`)]);
  expect(found).toHaveLength(1);
  return found[0];
}

const VERSIONED = 'UPROPERTY() int32 SchemaVersion';

describe('findSaveGameClasses — the project\'s USaveGame subclasses', () => {
  it('case 1: resolves the inheritance chain, merges base properties first, excludes non-save classes', () => {
    const a = parseHeader(
      header('UARPGSaveGame', 'USaveGame', ['UPROPERTY() int32 SchemaVersion', 'UPROPERTY(SaveGame) int32 PlayerLevel']),
      'Source/Did/Public/ARPGSaveGame.h',
    );
    const b = parseHeader(
      header('UDidSave', 'UARPGSaveGame', ['UPROPERTY() FString Extra']) +
        header('UOther', 'UObject', ['UPROPERTY() int32 NotSaved']),
      'Source/Did/Public/DidSave.h',
    );
    const found = findSaveGameClasses([a, b]);
    expect(found.map((c) => c.name)).toEqual(['UARPGSaveGame', 'UDidSave']);
    const did = found.find((c) => c.name === 'UDidSave')!;
    expect(did.properties.map((p) => p.name)).toEqual(['SchemaVersion', 'PlayerLevel', 'Extra']);
    expect(did.chain).toEqual(['UDidSave', 'UARPGSaveGame', 'USaveGame']);
    expect(did.headerPath).toBe('Source/Did/Public/DidSave.h');
    expect(found.some((c) => c.name === 'UOther')).toBe(false);
  });
});

describe('auditSaveClass — UE-semantic findings', () => {
  it('case 2: a Transient UPROPERTY is an error (declared on the save class, skipped by serialization)', () => {
    const audit = auditSaveClass(saveClass([VERSIONED, 'UPROPERTY(Transient) float CachedHealth']));
    expect(audit.findings).toContainEqual(
      expect.objectContaining({ kind: 'transient', field: 'CachedHealth', severity: 'error' }),
    );
  });

  it('case 3: actor/object refs and GAS/timer handles are flagged; a TSoftObjectPtr is clean', () => {
    const audit = auditSaveClass(saveClass([
      VERSIONED,
      'UPROPERTY() TWeakObjectPtr<AARPGEnemy> Target',
      'UPROPERTY() AActor* LastCheckpoint',
      'UPROPERTY() TSoftObjectPtr<UItemDefinition> Def',
      'UPROPERTY() TArray<FActiveGameplayEffectHandle> ActiveEffects',
      'UPROPERTY() FTimerHandle AutoSaveTimer',
    ]));
    const refs = audit.findings.filter((f) => f.kind === 'runtime-object-ref');
    expect(refs.map((f) => f.field).sort()).toEqual(['LastCheckpoint', 'Target']);
    expect(refs.every((f) => f.severity === 'warn')).toBe(true);
    const handles = audit.findings.filter((f) => f.kind === 'runtime-handle');
    expect(handles.map((f) => f.field).sort()).toEqual(['ActiveEffects', 'AutoSaveTimer']);
    expect(audit.findings.some((f) => f.field === 'Def')).toBe(false);
  });

  it('case 5: no integer version field -> exactly one unversioned finding; SchemaVersion clears it', () => {
    const bare = auditSaveClass(saveClass(['UPROPERTY() int32 PlayerLevel', 'UPROPERTY() FString VersionLabel']));
    expect(bare.findings.filter((f) => f.kind === 'unversioned')).toHaveLength(1);
    const versioned = auditSaveClass(saveClass(['UPROPERTY() int32 PlayerLevel', VERSIONED]));
    expect(versioned.findings.some((f) => f.kind === 'unversioned')).toBe(false);
  });
});

describe('auditSaveClass — design field coverage', () => {
  it('case 6: present / missing against the given design fields (case-insensitive exact name)', () => {
    const cls = saveClass([VERSIONED, 'UPROPERTY() int32 playerlevel', 'UPROPERTY() TArray<FARPGSavedItemEntry> InventoryItems', 'UPROPERTY() int32 PlayerLevelCap']);
    const audit = auditSaveClass(cls, ['PlayerLevel', 'InventoryItems', 'WalletGold']);
    expect(audit.present).toEqual(['PlayerLevel', 'InventoryItems']);
    expect(audit.missing).toEqual(['WalletGold']);
  });

  it('by default compares against the fields.ts authority, name AND C++ type', () => {
    const decls = SAVE_PERSISTED_FIELDS.map((f) => `UPROPERTY() ${f.ueType} ${f.ueName}`);
    const canon = auditSaveClass(saveClass([VERSIONED, ...decls]));
    expect(canon.present).toEqual(saveGamePropertyNames());
    expect(canon.missing).toEqual([]);
    expect(canon.mismatched).toEqual([]);

    const drifted = auditSaveClass(saveClass([VERSIONED, ...decls.map((d) => d.replace('int32 WalletGold', 'int64 WalletGold'))]));
    expect(drifted.mismatched).toEqual([{ field: 'WalletGold', expected: 'int32', actual: 'int64' }]);
  });
});

describe('buildSaveFixPrompt — the one CLI task the Fix button sends', () => {
  it('case 7: names class + header, one line per finding and per missing field, ends with the compile check; clean -> null', () => {
    const cls = saveClass(['UPROPERTY(Transient) float CachedHealth', 'UPROPERTY() FTimerHandle AutoSaveTimer', 'UPROPERTY() int32 PlayerLevel']);
    const audit = auditSaveClass(cls, ['PlayerLevel', 'WalletGold']);
    const prompt = buildSaveFixPrompt(audit)!;
    expect(prompt).toContain('UARPGSaveGame');
    expect(prompt).toContain('Source/Did/Public/ARPGSaveGame.h');
    for (const f of audit.findings) {
      const line = prompt.split('\n').find((l) => l.includes(`[${f.kind}]`) && (f.field === null || l.includes(f.field)));
      expect(line, `${f.kind} ${f.field}`).toBeTruthy();
      expect(line).toContain(f.rule);
    }
    expect(audit.findings.map((f) => f.kind).sort()).toEqual(['runtime-handle', 'transient', 'unversioned']);
    expect(prompt.split('\n').filter((l) => l.includes('WalletGold'))).toHaveLength(1);
    expect(prompt.trimEnd()).toMatch(/Verify the project compiles\.?$/);

    const clean = auditSaveClass(saveClass([VERSIONED, 'UPROPERTY() int32 PlayerLevel']), ['SchemaVersion', 'PlayerLevel']);
    expect(clean.findings).toEqual([]);
    expect(clean.missing).toEqual([]);
    expect(buildSaveFixPrompt(clean)).toBeNull();
  });
});
