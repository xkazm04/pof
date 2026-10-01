/**
 * Change-class router - "can ANY configured gate return a verdict for THIS change?"
 *
 * Two existing pieces bracket a harness run and neither maps a change to a gate:
 *  - `checkSuccessReachable` (verifier.ts) is a LAUNCH preflight over REQUIRED gates
 *    that cannot verify at all; it skips `visual` / `ue-visual` on purpose because
 *    their verifiability is runtime-determined.
 *  - `formatGateCoverageLines` (orchestrator.ts) is a RUN-END report of gates that
 *    returned no verdict, after every area was already built on top of them.
 * This is the missing middle: from (the change class, the gate set, the environment)
 * it answers, per gate and overall, whether a verdict is POSSIBLE, with a named
 * reason. A vendor's verification agent states the same limit as prose ("changes with
 * no runtime signal can't be meaningfully verified"); the harness stores it as a
 * typed answer before the run spends money.
 *
 * ADVISORY ONLY. Nothing here schedules, flips a `required` flag, touches
 * `isDependencyResolved`, or changes the pass-rate basis. `can` means "no known
 * obstacle", never "will pass"; `cannot` is claimed only for a stated, repo-derived
 * cause; anything that depends on an input nobody supplied is `unknown`.
 *
 * Pure: no fs, no network, no process state. The orchestrator probes the environment
 * and passes the answers in (`RouterEnv`).
 *
 * The class table is the set of path classes the repo already distinguishes, and each
 * entry names its evidence:
 *  - ue-source   `Source/**` C++ and `*.uproject`: `isUeTree` (verifier.ts) keys on
 *                `Source/` or a `.uproject`; the UBT compile gate targets `<Project>Editor`
 *                (ue-gates.ts `deriveUeCompileCommand`).
 *  - ue-content  `Content/**` assets and editor Python: ue-gates.ts header - UBT compiles
 *                the C++ the harness edits, not Blueprints or assets; the automation-test
 *                and frame-capture gates are what run against content.
 *  - web-source  `src/**` code: the webapp gates (`WEBAPP_GATES`) are `tsc`, `eslint src/`,
 *                `vitest run`, `next build` and the Playwright page capture.
 *  - web-test    test files: judged by the same command gates, but a test-only change
 *                alters no rendered page, so the page-capture gate has nothing to look at.
 *  - docs        prose (`*.md`, `docs/`, `.ai/`, `.claude/`): no gate type reads prose.
 *  - unknown     anything else, or no path named: no claim is made.
 * A change class this repo does not distinguish is not invented here.
 */

import type { VerificationGate } from './types';

export type ChangeClass = 'ue-source' | 'ue-content' | 'web-source' | 'web-test' | 'docs' | 'unknown';

/** `can` = no known obstacle; `cannot` = a stated cause; `unknown` = an input was not supplied. */
export type RouteAnswer = 'can' | 'cannot' | 'unknown';

/** What the orchestrator knows about the environment when the run starts. */
export interface RouterEnv {
  /** `resolveUeEnv() !== null` - POF_UE_EDITOR_CMD and POF_UE_UPROJECT are both set. */
  hasUeEnv: boolean;
  /** A statePath exists to place captures / abslogs. Default true (the orchestrator always has one). */
  hasStatePath?: boolean;
  /** A dev server answers on :3000 right now. `undefined` = not probed. */
  devServer?: boolean;
  /**
   * The generated visual-gate spec sits under Playwright's `testDir`
   * (see {@link visualSpecDiscoverable}). `undefined` = not probed.
   */
  visualSpecDiscoverable?: boolean;
}

export interface GateRoute {
  gate: string;
  type: VerificationGate['type'];
  answer: RouteAnswer;
  /** Why. Always set; for `can` it names the residual runtime risk, if any. */
  reason: string;
  /** The classes of THIS change the gate can judge (empty unless answer is can/unknown-by-class). */
  judges: ChangeClass[];
  /** The gate-level preconditions alone (command, UE env, dev server...), before change classes. */
  precondition: RouteAnswer;
}

export interface ChangeRouting {
  classes: ChangeClass[];
  gates: GateRoute[];
  /** Can any configured gate return a verdict for any part of this change? */
  anyGate: RouteAnswer;
  reason: string;
  /** Classes of this change that EVERY configured gate answered `cannot` for. */
  uncovered: ChangeClass[];
}

// ── Path classes ─────────────────────────────────────────────────────────────

const CODE_EXT = /\.(tsx?|jsx?|[cm]js|css|scss|json)$/i;

function normalize(p: string): string {
  return p.trim().replace(/\\/g, '/').replace(/^\.\//, '');
}

/** Classify one changed path. Case-sensitive on the UE directory names (`Source/`, `Content/`). */
export function classifyPath(rawPath: string): ChangeClass {
  const p = normalize(rawPath);
  if (!p) return 'unknown';

  // UE first: a C++ test under Source/ is still ue-source.
  if (/(^|\/)Source\//.test(p) || /\.(uproject|Build\.cs|Target\.cs)$/i.test(p) || /\.(cpp|cc|hpp|inl)$/.test(p) || /\.h$/.test(p)) {
    return 'ue-source';
  }
  if (/(^|\/)Content\//.test(p) || /\.(uasset|umap)$/i.test(p)) return 'ue-content';

  if (/(^|\/)__tests__\//.test(p) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(p) || /(^|\/)e2e\//.test(p)) return 'web-test';
  if (/\.(md|mdx|txt|rst)$/i.test(p) || /(^|\/)(docs|\.ai|\.claude)\//.test(p)) return 'docs';

  // Webapp source: under src/ (a file with a code extension, or a bare directory), or a
  // bare code filename quoted without its directory.
  if (/(^|\/)src\//.test(p)) {
    const leaf = p.slice(p.lastIndexOf('/') + 1);
    return CODE_EXT.test(p) || !leaf.includes('.') ? 'web-source' : 'unknown';
  }
  if (!p.includes('/') && /\.(tsx?|jsx?)$/i.test(p)) return 'web-source';
  return 'unknown';
}

/** The distinct classes of a changed-path list, in a stable order. Empty input -> []. */
export function classifyPaths(paths: ReadonlyArray<string>): ChangeClass[] {
  const seen = new Set<ChangeClass>();
  for (const p of paths) seen.add(classifyPath(p));
  // A path that is merely "unknown" does not dilute a change that has known classes
  // elsewhere, but a change whose every path is unknown stays unknown.
  if (seen.size > 1) seen.delete('unknown');
  return [...seen];
}

// Directory-anchored paths, plus bare filenames with an unambiguous extension. `.js`/`.jsx`
// and `.md` are deliberately not matched bare: "Next.js" and "README.md" are mentions, not files.
const PATH_TOKEN = /\b(?:src|e2e|Source|Content|docs|scripts|tools|Plugins|Config)\/[\w./@[\]-]*[\w/]|\b[\w-]+\.(?:tsx?|cpp|hpp|h|uasset|umap|uproject)\b/g;

/** Path-like tokens quoted in free text (an area's plan description). Best effort, deterministic. */
export function extractPathTokens(text: string): string[] {
  return [...new Set(text.match(PATH_TOKEN) ?? [])];
}

// ── Gate profiles ────────────────────────────────────────────────────────────

type GateType = VerificationGate['type'];

interface GateProfile {
  /** Classes the gate type can judge; `opaque` = the command is arbitrary, so nothing is derivable. */
  judges: ReadonlyArray<ChangeClass> | 'opaque';
  /** One line of what it reads, for the reason text. */
  reads: string;
}

const WEB_CODE: ReadonlyArray<ChangeClass> = ['web-source', 'web-test'];

/** Exhaustive over `VerificationGate['type']`: a new gate type fails the typecheck here. */
const GATE_PROFILES: Record<GateType, GateProfile> = {
  typecheck: { judges: WEB_CODE, reads: 'webapp TypeScript' },
  lint: { judges: WEB_CODE, reads: 'webapp source under src/' },
  test: { judges: WEB_CODE, reads: 'the vitest suite' },
  build: { judges: WEB_CODE, reads: 'the Next.js build (it also type-checks every included file)' },
  visual: { judges: ['web-source'], reads: 'rendered webapp pages' },
  playtest: { judges: 'opaque', reads: 'an arbitrary command' },
  custom: { judges: 'opaque', reads: 'an arbitrary command' },
  'ue-compile': { judges: ['ue-source'], reads: 'UE C++ through UnrealBuildTool' },
  'ue-test': { judges: ['ue-source', 'ue-content'], reads: 'registered UE automation tests' },
  'ue-visual': { judges: ['ue-source', 'ue-content'], reads: 'a frame from a headless game boot' },
};

/** Gate-level preconditions: can the gate return ANY verdict, whatever the change? */
function preconditionRoute(gate: VerificationGate, env: RouterEnv): { answer: RouteAnswer; reason: string } {
  const hasState = env.hasStatePath ?? true;
  switch (gate.type) {
    case 'ue-compile':
      // Mirrors verifier.ts `gateCannotVerify`: a commandless compile gate is unverifiable.
      if (!gate.command) {
        return {
          answer: 'cannot',
          reason: env.hasUeEnv
            ? 'no build command (the engine root could not be derived from POF_UE_EDITOR_CMD)'
            : 'no UE environment (POF_UE_EDITOR_CMD and POF_UE_UPROJECT are not both set)',
        };
      }
      return { answer: 'can', reason: 'build command present' };
    case 'ue-test':
    case 'ue-visual':
      if (!env.hasUeEnv) {
        return { answer: 'cannot', reason: 'no UE environment (POF_UE_EDITOR_CMD and POF_UE_UPROJECT are not both set)' };
      }
      if (!hasState) return { answer: 'cannot', reason: 'no statePath to place the abslog or captured frame' };
      return {
        answer: 'can',
        reason: gate.type === 'ue-test'
          ? 'a filter that matches no registered test reads unverifiable at run time'
          : 'a headless boot that yields no frame reads unverifiable at run time',
      };
    case 'visual':
      if (!hasState) return { answer: 'cannot', reason: 'no statePath to store the page captures' };
      if (env.visualSpecDiscoverable === false) {
        return {
          answer: 'cannot',
          reason: 'the generated spec is outside the Playwright testDir, so `playwright test <spec>` reports "No tests found"',
        };
      }
      if (env.devServer === false) return { answer: 'cannot', reason: 'no dev server answers on :3000' };
      if (env.devServer === undefined) return { answer: 'unknown', reason: 'dev server not probed' };
      if (env.visualSpecDiscoverable === undefined) return { answer: 'unknown', reason: 'Playwright testDir not probed' };
      return { answer: 'can', reason: 'dev server up and spec discoverable' };
    default:
      if (!gate.command) return { answer: 'cannot', reason: 'no command configured, so nothing would run' };
      return { answer: 'can', reason: 'command present' };
  }
}

function routeGateForClass(gate: VerificationGate, cls: ChangeClass, env: RouterEnv): GateRoute {
  const pre = preconditionRoute(gate, env);
  const base = { gate: gate.name, type: gate.type, precondition: pre.answer };
  // The gate cannot return a verdict at all: a stronger statement than any class mismatch.
  if (pre.answer === 'cannot') return { ...base, answer: 'cannot', reason: pre.reason, judges: [] };

  // An unprobed environment input is the more actionable reason when both apply.
  const whyUnknown = (why: string): string => (pre.answer === 'unknown' ? pre.reason : why);
  const profile = GATE_PROFILES[gate.type];
  if (profile.judges === 'opaque') {
    return {
      ...base,
      answer: 'unknown',
      reason: whyUnknown(`${gate.type} command is arbitrary; what it reads is not derivable from its type`),
      judges: [],
    };
  }
  if (cls === 'unknown') {
    return {
      ...base,
      answer: 'unknown',
      reason: whyUnknown('no changed path named, so the change class is unknown'),
      judges: [],
    };
  }
  if (!profile.judges.includes(cls)) {
    return {
      ...base,
      answer: 'cannot',
      reason: `${gate.type} reads ${profile.reads}; this change is ${cls}`,
      judges: [],
    };
  }
  return {
    ...base,
    answer: pre.answer, // 'can' or 'unknown' from the environment
    reason: pre.reason,
    judges: [cls],
  };
}

const RANK: Record<RouteAnswer, number> = { can: 2, unknown: 1, cannot: 0 };

/**
 * Route one change across the gate set. `classes` empty means no path evidence: every
 * gate then answers from its preconditions alone, and `unknown` where they pass.
 */
export function routeChange(
  classes: ReadonlyArray<ChangeClass>,
  gates: ReadonlyArray<VerificationGate>,
  env: RouterEnv,
): ChangeRouting {
  const cls: ChangeClass[] = classes.length > 0 ? [...classes] : ['unknown'];

  const routes: GateRoute[] = gates.map((g) => {
    const per = cls.map((c) => routeGateForClass(g, c, env));
    const best = per.reduce((a, b) => (RANK[b.answer] > RANK[a.answer] ? b : a));
    const judges = [...new Set(per.flatMap((r) => r.judges))];
    return { ...best, judges };
  });

  const uncovered = cls.filter((c) => c !== 'unknown'
    && gates.every((g) => routeGateForClass(g, c, env).answer === 'cannot'));

  const anyGate: RouteAnswer = routes.some((r) => r.answer === 'can')
    ? 'can'
    : routes.some((r) => r.answer === 'unknown') ? 'unknown' : 'cannot';

  const reason = gates.length === 0
    ? 'no gate is configured'
    : anyGate === 'cannot'
      ? routes.map((r) => `${r.gate}: ${r.reason}`).join('; ')
      : routes.filter((r) => r.answer === anyGate).map((r) => r.gate).join(', ');

  return { classes: cls, gates: routes, anyGate: gates.length === 0 ? 'cannot' : anyGate, reason, uncovered };
}

// ── Environment helpers ──────────────────────────────────────────────────────

/** The spec file the harness's visual gate writes under its statePath (visual-gate.ts `executeVisualGate`). */
export const VISUAL_SPEC_FILE = '_visual-gate.spec.ts';

function resolveFrom(base: string, rel: string): string {
  const parts = (/^([A-Za-z]:)?\//.test(normalize(rel)) ? normalize(rel) : `${normalize(base)}/${normalize(rel)}`).split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (part === '' && out.length > 0) continue;
    if (part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/').toLowerCase();
}

/**
 * Is the generated visual-gate spec inside Playwright's `testDir`?
 * `playwright test <file>` only finds files under `testDir`; a spec outside it reports
 * "No tests found". Reads a literal `testDir: '...'` from the config text; returns
 * `undefined` (no claim) when the config is absent or the value is not a string literal.
 */
export function visualSpecDiscoverable(
  configText: string | null,
  projectPath: string,
  statePath: string,
): boolean | undefined {
  if (!configText) return undefined;
  const m = /\btestDir\s*:\s*(['"])([^'"]+)\1/.exec(configText);
  if (!m) return undefined;
  const testDir = resolveFrom(projectPath, m[2]);
  const spec = resolveFrom(projectPath, `${normalize(statePath)}/${VISUAL_SPEC_FILE}`);
  return spec === testDir || spec.startsWith(`${testDir}/`);
}

// ── Preflight lines ──────────────────────────────────────────────────────────

export interface PlannedArea {
  id: string;
  label?: string;
  description?: string;
  featureNames?: string[];
  status?: string;
}

/**
 * The change classes an area's plan text names, from path-like tokens only.
 *
 * Plan text names files it READS as often as files it changes ("follow the pattern in
 * docs/x.md"), so `docs` is never taken from it: a docs-only verdict needs a real changed
 * path. The classes kept are the ones a gate-domain mismatch can be stated for.
 */
export function plannedChangeClasses(area: Pick<PlannedArea, 'label' | 'description' | 'featureNames'>): ChangeClass[] {
  const text = [area.label ?? '', area.description ?? '', ...(area.featureNames ?? [])].join('\n');
  return classifyPaths(extractPathTokens(text)).filter((c) => c !== 'unknown' && c !== 'docs');
}

const PREFIX = 'Change routing (advisory):';

/**
 * Advisory preflight lines for the plan's not-yet-completed areas. Silent (empty) when
 * there is nothing to say. `exclude` names gates `checkSuccessReachable` already warned
 * about, so this never restates that warning.
 */
export function formatChangeRoutingLines(
  areas: ReadonlyArray<PlannedArea>,
  gates: ReadonlyArray<VerificationGate>,
  env: RouterEnv,
  opts: { exclude?: ReadonlyArray<string> } = {},
): string[] {
  if (gates.length === 0) return [];
  const exclude = new Set(opts.exclude ?? []);
  const open = areas.filter((a) => a.status !== 'completed');
  const named = open
    .map((a) => ({ area: a, classes: plannedChangeClasses(a) }))
    .filter((x) => x.classes.length > 0);
  const planClasses = [...new Set(named.flatMap((x) => x.classes))];

  const lines: string[] = [];

  // 1. A gate that cannot return a verdict for ANY class the plan names.
  const wholePlan = routeChange(planClasses, gates, env);
  for (const r of wholePlan.gates) {
    if (exclude.has(r.gate)) continue;
    const g = gates.find((x) => x.name === r.gate);
    const kind = g?.required ? 'required' : 'advisory';
    if (r.answer === 'cannot') {
      lines.push(
        `${PREFIX} ${r.gate} (${kind}) cannot return a verdict for ${planClasses.length > 0 ? `any planned change (${planClasses.join(', ')})` : 'any change'}: ${r.reason}. `
        + 'Features it was meant to judge will finish without its verdict; review them by hand.',
      );
    } else if (r.precondition === 'unknown') {
      lines.push(`${PREFIX} ${r.gate} (${kind}) may return no verdict: ${r.reason}.`);
    }
  }

  // 2. Areas no configured gate can judge (every gate, including those excluded above).
  const uncovered = named
    .filter((x) => routeChange(x.classes, gates, env).anyGate === 'cannot')
    .map((x) => `${x.area.id} (${x.classes.join(', ')})`);
  if (uncovered.length > 0) {
    const shown = uncovered.slice(0, 5).join('; ');
    const more = uncovered.length > 5 ? `; +${uncovered.length - 5} more` : '';
    lines.push(
      `${PREFIX} no configured gate can judge ${uncovered.length} planned area(s): ${shown}${more}. `
      + 'Their features can only be self-reported.',
    );
  }

  const unnamed = open.length - named.length;
  if (lines.length > 0 && unnamed > 0) {
    lines.push(`${PREFIX} ${unnamed} of ${open.length} open area(s) name no changed path, so their change class is unknown and no claim is made for them.`);
  }
  return lines;
}
