import { describe, it, expect } from 'vitest';
import { PromptBuilder } from '@/lib/prompts/prompt-builder';
import type { ProjectContext } from '@/lib/prompt-context';

const ctx: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:\\proj',
  ueVersion: '5.7.3',
};

const REQS = [
  {
    artifact: 'GA_MeleeAttack',
    grantedBy: 'ASC on character',
    activatedBy: 'IA_PrimaryAttack',
    dependencies: ['AM_MeleeCombo'],
    verification: 'attack plays on click',
  },
];

function buildUEPrompt() {
  return new PromptBuilder()
    .withProjectContext(ctx)
    .withTask('Add a melee ability', 'Create GA_MeleeAttack.')
    .withWiringRequirements(REQS)
    .withOutputSchema('Return JSON.');
}

describe('Wiring Requirements section', () => {
  it('emits the heading and the four sub-prompts when there is concrete content', () => {
    const out = buildUEPrompt().build();
    const lower = out.toLowerCase();
    expect(out).toContain('## Wiring Requirements');
    expect(lower).toContain('grant');
    expect(lower).toContain('activat');
    expect(lower).toContain('depend');
    expect(lower).toContain('verif');
  });

  it('skips the section entirely for an empty reqs array (no boilerplate)', () => {
    const out = new PromptBuilder()
      .withProjectContext(ctx)
      .withTask('t', 'b')
      .withWiringRequirements([])
      .build();
    expect(out).not.toContain('## Wiring Requirements');
  });

  it('includes a wiring output-schema field instruction', () => {
    expect(buildUEPrompt().build()).toContain('`wiring`');
  });

  it('renders known requirements as a table when provided', () => {
    const out = new PromptBuilder()
      .withProjectContext(ctx)
      .withTask('t', 'b')
      .withWiringRequirements([
        {
          artifact: 'GA_MeleeAttack',
          grantedBy: 'ASC on character',
          activatedBy: 'IA_PrimaryAttack',
          dependencies: ['AM_MeleeCombo'],
          verification: 'attack plays on click',
        },
      ])
      .build();
    expect(out).toContain('GA_MeleeAttack');
    expect(out).toContain('IA_PrimaryAttack');
  });

  it('inserts the section between task instructions and best practices', () => {
    const out = new PromptBuilder()
      .withProjectContext(ctx)
      .withTask('TASKTITLE', 'body')
      .withWiringRequirements(REQS)
      .withBestPractices(['BPPRACTICE'])
      .build();
    const taskIdx = out.indexOf('TASKTITLE');
    const wiringIdx = out.indexOf('## Wiring Requirements');
    const bpIdx = out.indexOf('BPPRACTICE');
    expect(taskIdx).toBeLessThan(wiringIdx);
    expect(wiringIdx).toBeLessThan(bpIdx);
  });

  it('audit() reports wiringRequirements present with reqs, absent when empty', () => {
    expect(buildUEPrompt().audit().find((a) => a.section === 'wiringRequirements')?.present).toBe(true);
    const empty = new PromptBuilder()
      .withProjectContext(ctx)
      .withTask('t', 'b')
      .withWiringRequirements([])
      .audit()
      .find((a) => a.section === 'wiringRequirements');
    expect(empty?.present).toBe(false);
  });
});
