import { describe, it, expect } from 'vitest';
import { summarizeInjectedKnowledge } from '@/lib/prompts/prompt-knowledge-summary';
import { STATIC_VARIANT_ID } from '@/lib/prompt-evolution/dispatch-resolve';

const PROMPT = [
  '## Project Context',
  'Project: PoF',
  '',
  '## Known UE Pitfalls',
  '- GAS meta attributes reset on respawn',
  '- Niagara user params need activation order',
  '',
  '## Known Project Assets (use these EXACT paths — do not invent paths)',
  '- /Game/Weapons/SM_Sword',
  '',
  '## Wiring Requirements',
  '- Wire the montage into the ability',
  '',
  '## Binary Content Wall',
  'These asset types CANNOT be authored from Python or text',
  '',
  'This will be reviewed against these exact craft dimensions — meet the professional bar on each:',
  '  - clarity: reads like a design doc',
  '',
  '## Task',
  'Do the thing. @@CALLBACK:abc123',
].join('\n');

describe('summarizeInjectedKnowledge', () => {
  it('derives every tag only from content actually present in the prompt', () => {
    const tags = summarizeInjectedKnowledge(PROMPT, STATIC_VARIANT_ID);
    expect(tags).toContain('static prompt');
    expect(tags).toContain('2 UE pitfalls');
    expect(tags).toContain('known assets');
    expect(tags).toContain('wiring');
    expect(tags).toContain('binary tripwire');
    expect(tags).toContain('quality pack');
    expect(tags).toContain('completion callback');
  });

  it('names the adopted variant when one resolved', () => {
    const tags = summarizeInjectedKnowledge(PROMPT, 'var-42');
    expect(tags).toContain('variant var-42');
    expect(tags).not.toContain('static prompt');
  });

  it('claims nothing on a bare prompt', () => {
    expect(summarizeInjectedKnowledge('Just do the task.')).toEqual([]);
  });

  it('pitfall count stops at the next section header', () => {
    const p = '## Known UE Pitfalls\n- one\n\n## Task\n- not a gotcha';
    expect(summarizeInjectedKnowledge(p)).toContain('1 UE pitfall');
  });
});
