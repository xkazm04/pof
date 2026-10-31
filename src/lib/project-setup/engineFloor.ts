/**
 * Engine floors: how a project's recorded engine (`.uproject` EngineAssociation) relates
 * to the engine the user selected. The recorded version is what the project was BUILT ON,
 * so it is a floor, not a pin: a newer engine opens the project (UE converts it), an older
 * one may not. So:
 *
 * - recorded == selected (major.minor)  -> `match`, listed first, no note
 * - recorded <  selected                -> `older`, listed, silent (the expected upgrade)
 * - recorded >  selected                -> `newer`, listed with a warning naming both
 *                                          versions, and saying "major" across a major gap
 * - recorded not a release version      -> `unknown` (no association, a source-build GUID):
 *                                          listed and labelled, never treated as satisfied
 *
 * Comparison is over PARSED components, never strings: "5.10" sorts below "5.9" as text,
 * and "5.10".startsWith("5.1") is true. Client-safe (no Node imports).
 */

export type EngineFitKind = 'match' | 'older' | 'newer' | 'unknown';

export interface EngineFit {
  kind: EngineFitKind;
  /** True when recorded and selected differ in the major component. */
  majorGap: boolean;
}

/** The release part of a version string (`5.8`, `5.8.3`, `5.8.3-custom+cl123`), else null. */
export function parseRelease(v: string | null | undefined): number[] | null {
  const m = typeof v === 'string' ? v.trim().match(/^(\d+)\.(\d+)(?:\.(\d+))?/) : null;
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)];
}

/** Numeric component compare over parsed releases; unparsable versions sort last. */
export function compareReleases(a: string | null | undefined, b: string | null | undefined): number {
  const [x, y] = [parseRelease(a), parseRelease(b)];
  if (!x || !y) return x ? -1 : y ? 1 : 0;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

/** How a project recorded on `recorded` fits the selected engine, at major.minor. */
export function engineFit(recorded: string | null | undefined, selected: string): EngineFit {
  const [r, s] = [parseRelease(recorded), parseRelease(selected)];
  if (!r || !s) return { kind: 'unknown', majorGap: false };
  const majorGap = r[0] !== s[0];
  const d = r[0] - s[0] || r[1] - s[1];
  return { kind: d === 0 ? 'match' : d < 0 ? 'older' : 'newer', majorGap };
}

const RANK: Record<EngineFitKind, number> = { match: 0, older: 1, newer: 2, unknown: 3 };

/**
 * Every detected project, none hidden by version: matches first (in their detected order),
 * then older, then newer, then unknown, each later band newest-recorded first.
 */
export function orderByEngineFit<T extends { engineVersion: string | null }>(
  projects: readonly T[],
  selected: string,
): Array<T & { fit: EngineFit }> {
  return projects
    .map((p, i) => ({ p: { ...p, fit: engineFit(p.engineVersion, selected) }, i }))
    .sort((a, b) =>
      RANK[a.p.fit.kind] - RANK[b.p.fit.kind]
      || (a.p.fit.kind === 'match' ? 0 : compareReleases(b.p.engineVersion, a.p.engineVersion))
      || a.i - b.i)
    .map(({ p }) => p);
}

/** The one warning a project row carries, or null (match and older are silent). */
export function engineFitNote(fit: EngineFit, recorded: string | null, selected: string): string | null {
  const sel = parseRelease(selected)?.slice(0, 2).join('.') ?? selected;
  if (fit.kind === 'newer') {
    return `Built on UE ${recorded}, ${fit.majorGap ? 'a major version ' : ''}newer than the selected UE ${sel}`;
  }
  if (fit.kind === 'unknown') {
    return recorded ? `Engine "${recorded}" is not a release version (source build?)` : 'No engine version recorded';
  }
  return null;
}
