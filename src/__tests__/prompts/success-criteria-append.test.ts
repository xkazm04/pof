/**
 * PromptBuilder.addSuccessCriteria must append, not re-parse.
 *
 * It recovered the existing criteria by splitting the RENDERED section on '\n' and
 * stripping a leading `N. ` — so a multi-line criterion became several numbered
 * criteria, and a criterion that itself began with a number lost it.
 */
import { describe, it, expect } from 'vitest';
import { PromptBuilder } from '@/lib/prompts/prompt-builder';

const criteriaOf = (prompt: string) => prompt.slice(prompt.indexOf('## Success Criteria'));

describe('PromptBuilder.addSuccessCriteria', () => {
  it('keeps a multi-line criterion as ONE numbered item when appending', () => {
    const p = new PromptBuilder()
      .withRawProjectContext('## Project Context')
      .withRawTask('## Task: t')
      .withSuccessCriteria(['Builds cleanly\n   (no warnings in Source/)'])
      .addSuccessCriteria(['Test passes'])
      .build();
    expect(criteriaOf(p)).toBe(
      '## Success Criteria\n1. Builds cleanly\n   (no warnings in Source/)\n2. Test passes',
    );
  });

  it('does not strip a criterion\'s own leading number', () => {
    const p = new PromptBuilder()
      .withRawProjectContext('## Project Context')
      .withRawTask('## Task: t')
      .withSuccessCriteria(['3. tiers exist'])
      .addSuccessCriteria(['Test passes'])
      .build();
    expect(criteriaOf(p)).toBe('## Success Criteria\n1. 3. tiers exist\n2. Test passes');
  });

  it('appends onto an empty section', () => {
    const p = new PromptBuilder()
      .withRawProjectContext('## Project Context')
      .withRawTask('## Task: t')
      .addSuccessCriteria(['Test passes'])
      .build();
    expect(criteriaOf(p)).toBe('## Success Criteria\n1. Test passes');
  });
});
