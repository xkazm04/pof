/**
 * extractInlineEntities tags UE classes, project files and concepts under an
 * assistant message. Pinned here: an all-caps word is not a UE class (UE types
 * are prefix + PascalCase: AActor, UGameplayAbility, FHitResult).
 */
import { describe, it, expect } from 'vitest';
import { extractInlineEntities } from '@/components/cli/TerminalOutput/helpers';

const classes = (text: string) =>
  extractInlineEntities(text).filter((e) => e.type === 'class').map((e) => e.value);

describe('extractInlineEntities — UE classes', () => {
  it('does not tag all-caps words as UE classes', () => {
    expect(classes('FATAL ERROR: the UPDATE step FAILED AFTER the build, ALSO check UNDER the hood.')).toEqual([]);
  });

  it('still tags real prefixed PascalCase UE classes', () => {
    expect(classes('Subclass AARPGCharacter and add a UARPGAbilitySystemComponent plus an FHitResult handler.'))
      .toEqual(['AARPGCharacter', 'UARPGAbilitySystemComponent', 'FHitResult']);
  });
});
