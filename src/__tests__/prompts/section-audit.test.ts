import { describe, it, expect } from 'vitest';
import { PromptBuilder, PROMPT_SECTIONS, auditPromptString } from '@/lib/prompts/prompt-builder';
import { qualityPack } from '@/lib/prompts/quality';

/** A builder with every optional section set, so build() emits everything it can. */
function fullBuilder(): PromptBuilder {
  return new PromptBuilder()
    .withRawProjectContext('## Project Context\nPoF')
    .withQualityPack(qualityPack('text-config', 'items'))
    .withDomainContext('You are an expert on loot.')
    .withTask('Do it', 'Body')
    .withAssetSpec({ id: 'a', name: 'A', categoryPath: ['X'], tags: [] })
    .withWiringRequirements([{
      artifact: 'GA_X', grantedBy: 'ASC', activatedBy: 'IA_X', dependencies: [], verification: 'log line',
    }])
    .withBestPractices(['one'])
    .withOutputSchema('Return ONLY a JSON object.')
    .withSuccessCriteria(['compiles']);
}

describe('prompt section audits derive from one list', () => {
  it('audit() reports every section build() can emit, in the same order as the string audit', () => {
    const b = fullBuilder();
    const rows = b.audit();
    expect(rows.map((r) => r.section)).toEqual(PROMPT_SECTIONS.map((s) => s.section));
    expect(rows.map((r) => r.section)).toEqual(auditPromptString(b.build()).map((r) => r.section));
    expect(rows.every((r) => r.present)).toBe(true);
  });

  it('the string audit finds the quality pack and asset spec build() rendered', () => {
    const present = auditPromptString(fullBuilder().build()).filter((r) => r.present).map((r) => r.section);
    expect(present).toContain('qualityPack');
    expect(present).toContain('assetSpec');
    expect(present).toHaveLength(PROMPT_SECTIONS.length);
  });

  it('a numbered Instructions list without a criteria section is not Success Criteria', () => {
    const rows = auditPromptString('## Task: x\n\n## Instructions\n1. do a\n2. do b\n');
    expect(rows.find((r) => r.section === 'successCriteria')!.present).toBe(false);
  });
});
