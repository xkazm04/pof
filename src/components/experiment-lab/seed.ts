/** Seed an experiment from a research finding (a gotcha): a starter probe that carries the
 * concept as context + a runnable template. The user edits the probe to actually observe the
 * concept, then runs it.
 *
 * It used to also seed a free-text `verifyPrompt`. That text was POSTed to the verify route,
 * which never declared the field and always used its own server-owned prompt — so the seeded
 * words were discarded. The visual check is now chosen by MODE (see `VISUAL_CHECK_MODES`) and
 * this seeder no longer produces a value nothing reads. */
export function seedFromGotcha(g: { summary: string; detail: string }): { python: string } {
  const python = [
    `# ${g.summary}`,
    `# ${g.detail}`,
    '# Edit below to apply/observe this concept on the project, then Run on UE 5.8.',
    "unreal.log('RESULT=' + unreal.SystemLibrary.get_engine_version())",
  ].join('\n');
  return { python };
}
