import { describe, it, expect, vi, afterEach } from 'vitest';
import { injectSkillsIntoPrompt } from '@/components/cli/skills';
import { logger } from '@/lib/logger';

describe('injectSkillsIntoPrompt — shared skill-injection path', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('prepends enabled packs on a first (non-resume) run', () => {
    const { prompt, injected } = injectSkillsIntoPrompt({
      basePrompt: 'Do the thing.',
      enabledSkills: ['souls-combat'],
      resumeSession: false,
    });
    expect(injected).toEqual(['souls-combat']);
    expect(prompt).toContain('Souls-like Combat');
    expect(prompt.endsWith('Do the thing.')).toBe(true);
    expect(prompt).not.toBe('Do the thing.');
  });

  it('does NOT inject on a resume run (first-run rule)', () => {
    const { prompt, injected } = injectSkillsIntoPrompt({
      basePrompt: 'Continue.',
      enabledSkills: ['souls-combat'],
      resumeSession: true,
    });
    expect(injected).toEqual([]);
    expect(prompt).toBe('Continue.');
  });

  it('is a no-op when no skills are enabled', () => {
    const { prompt, injected } = injectSkillsIntoPrompt({
      basePrompt: 'Bare prompt.',
      enabledSkills: [],
      resumeSession: false,
    });
    expect(injected).toEqual([]);
    expect(prompt).toBe('Bare prompt.');
  });

  it('does not double-inject when a task is dispatched then resumed (both paths touch it)', () => {
    // First dispatch (interactive or queued) injects once.
    const first = injectSkillsIntoPrompt({
      basePrompt: 'Task.',
      enabledSkills: ['souls-combat'],
      resumeSession: false,
    });
    expect(first.injected).toEqual(['souls-combat']);
    // A follow-up resume dispatch of the SAME run must not prepend again.
    const second = injectSkillsIntoPrompt({
      basePrompt: first.prompt,
      enabledSkills: ['souls-combat'],
      resumeSession: true,
    });
    expect(second.injected).toEqual([]);
    expect(second.prompt).toBe(first.prompt);
    // The skill block appears exactly once across the run.
    const occurrences = second.prompt.split('## Skill: Souls-like Combat Systems').length - 1;
    expect(occurrences).toBe(1);
  });

  it('logs which packs were injected for the run', () => {
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
    injectSkillsIntoPrompt({
      basePrompt: 'x',
      enabledSkills: ['souls-combat', 'loot-itemization'],
      resumeSession: false,
      runLabel: 'feature-fix',
    });
    expect(infoSpy).toHaveBeenCalledTimes(1);
    const msg = String(infoSpy.mock.calls[0][0]);
    expect(msg).toContain('feature-fix');
    expect(msg).toContain('souls-combat');
    expect(msg).toContain('loot-itemization');
  });

  it('drops unknown skill ids and does not log/inject when none are valid', () => {
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
    const { prompt, injected } = injectSkillsIntoPrompt({
      basePrompt: 'y',
      // @ts-expect-error — deliberately invalid id to prove filtering
      enabledSkills: ['not-a-real-skill'],
      resumeSession: false,
    });
    expect(injected).toEqual([]);
    expect(prompt).toBe('y');
    expect(infoSpy).not.toHaveBeenCalled();
  });
});
