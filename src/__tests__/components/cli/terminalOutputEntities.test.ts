/**
 * extractInlineEntities tags UE classes, project files and concepts under an
 * assistant message. Pinned here: an all-caps word is not a UE class (UE types
 * are prefix + PascalCase: AActor, UGameplayAbility, FHitResult).
 */
import { describe, it, expect } from 'vitest';
import { extractInlineEntities } from '@/components/cli/TerminalOutput/helpers';

const classes = (text: string) =>
  extractInlineEntities(text).filter((e) => e.type === 'class').map((e) => e.value);

const files = (text: string) =>
  extractInlineEntities(text).filter((e) => e.type === 'file').map((e) => e.value);

describe('extractInlineEntities — project files', () => {
  it('tags Windows backslash paths, not only forward-slash ones', () => {
    expect(files('I edited Source\\PoF\\Private\\Combat\\ARPGCombatComponent.cpp and its header.'))
      .toEqual(['Source\\PoF\\Private\\Combat\\ARPGCombatComponent.cpp']);
    expect(files('Then opened Content\\Maps\\Arena.umap to check the layout.'))
      .toEqual(['Content\\Maps\\Arena.umap']);
  });

  it('still tags forward-slash paths', () => {
    expect(files('I edited Source/PoF/Public/ARPGCharacter.h for the new UPROPERTY.'))
      .toEqual(['Source/PoF/Public/ARPGCharacter.h']);
  });
});

const concepts = (text: string) =>
  extractInlineEntities(text).filter((e) => e.type === 'concept').map((e) => e.value);

describe('extractInlineEntities — UE concepts', () => {
  it('matches a concept as a whole word, not inside another word', () => {
    expect(concepts('Swap the gasket on the Vegas build, then list the reqs and the frequencies.')).toEqual([]);
  });

  it('still matches whole-word concepts', () => {
    expect(concepts('Grant the ability through GAS, then drive the AI with a behavior tree and EQS.'))
      .toEqual(['GAS', 'Behavior Tree', 'EQS']);
  });
});

describe('extractInlineEntities — UE classes', () => {
  it('does not tag all-caps words as UE classes', () => {
    expect(classes('FATAL ERROR: the UPDATE step FAILED AFTER the build, ALSO check UNDER the hood.')).toEqual([]);
  });

  it('still tags real prefixed PascalCase UE classes', () => {
    expect(classes('Subclass AARPGCharacter and add a UARPGAbilitySystemComponent plus an FHitResult handler.'))
      .toEqual(['AARPGCharacter', 'UARPGAbilitySystemComponent', 'FHitResult']);
  });
});
