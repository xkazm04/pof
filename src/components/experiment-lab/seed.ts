/** Seed an experiment from a research finding (a gotcha): a starter probe that
 * carries the concept as context + a runnable template, plus a verify prompt.
 * The user edits the probe to actually observe the concept, then runs it. */
export function seedFromGotcha(g: { summary: string; detail: string }): { python: string; verifyPrompt: string } {
  const python = [
    `# ${g.summary}`,
    `# ${g.detail}`,
    '# Edit below to apply/observe this concept on the project, then Run on UE 5.8.',
    "unreal.log('RESULT=' + unreal.SystemLibrary.get_engine_version())",
  ].join('\n');
  return { python, verifyPrompt: g.summary };
}
