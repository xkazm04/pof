/**
 * WP2 acceptance 1 and 5 against the staged `synthetic-scale` document (10,739 nodes): all 27
 * seeded defects found, matched by code AND node set; every finding outside the answer key named
 * and justified below; the full suite under 250 ms (median of 5 after warm-up, printed).
 *
 * Both files are gitignored contest data, looked up in the same places WP1's fixture test uses.
 * The block SKIPS LOUDLY when they are absent: a missing input is not a passing gate.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ARENA_DATA_DIR } from './orrery/_fixtures';
import { parseStoryGraph } from '@/lib/story/importer';
import { validateStoryGraph } from '@/lib/story/validate';
import type { StoryFinding, StoryGraph } from '@/lib/story/types';

const DIRS = [
  ARENA_DATA_DIR,
  path.resolve(process.cwd(), 'public', 'orrery-fixtures'),
  path.resolve(process.cwd(), '.contest', 'staging', 'storymap', 'data'),
];
const find = (file: string) => DIRS.map((d) => path.join(d, file)).find((p) => fs.existsSync(p));
const GRAPH = find('synthetic-scale.json');
const ANSWERS = find('seeded-defects.json');
if (!GRAPH || !ANSWERS) {
  console.error(`[storygraph-validate] synthetic-scale.json / seeded-defects.json not found in ${DIRS.join(' | ')} — the 27-defect and timing acceptance is SKIPPED, not passing.`);
}

interface Seeded { code: string; nodes: string[]; variables?: string[] }
const key = (f: Pick<StoryFinding, 'code' | 'nodes'> | Seeded) => `${f.code}|${[...f.nodes].sort().join(',')}`;

describe.skipIf(!GRAPH || !ANSWERS)('synthetic-scale: the seeded defects', () => {
  const load = (): { graph: StoryGraph; seeded: Seeded[] } => {
    const r = parseStoryGraph(fs.readFileSync(GRAPH!, 'utf8'));
    if (!r.ok) throw new Error(r.error);
    const answers = JSON.parse(fs.readFileSync(ANSWERS!, 'utf8')) as { total: number; defects: Seeded[] };
    expect(answers.defects).toHaveLength(answers.total);
    return { graph: r.data, seeded: answers.defects };
  };

  it('finds all 27, by code AND node set (and variables where the key names them)', () => {
    const { graph, seeded } = load();
    expect(graph.nodes).toHaveLength(10739);
    expect(seeded).toHaveLength(27);
    const findings = validateStoryGraph(graph);
    const byKey = new Map(findings.map((f) => [key(f), f]));
    const missed = seeded.filter((s) => !byKey.has(key(s)));
    expect(missed).toEqual([]);
    for (const s of seeded) {
      if (s.variables) expect([...(byKey.get(key(s))!.variables ?? [])].sort()).toEqual([...s.variables].sort());
    }
  });

  it('every finding outside the answer key is a real defect of the document, asserted exactly', () => {
    const { graph, seeded } = load();
    const answer = new Set(seeded.map(key));
    const extras = validateStoryGraph(graph).filter((f) => !answer.has(key(f)));

    // (1) E.sealed: the generator (build-data.mjs, "SEEDED DEFECT: E.sealed gets NO inbound
    // traversal edge -> ENDING_UNREACHABLE") planted it but never pushed it into the manifest. The
    // document promises an ending nothing leads to: a true ENDING_UNREACHABLE.
    const sealed = extras.filter((f) => f.code === 'ENDING_UNREACHABLE');
    expect(sealed.map((f) => f.nodes)).toEqual([['E.sealed']]);
    expect(graph.edges.some((e) => e.to === 'E.sealed' && ['then', 'option', 'gate'].includes(e.kind))).toBe(false);

    // (2) VAR_WRITER_NOT_OWNER, one per variable: the generator truncates every writers[] list to
    // 40 (`[...writerMap[vr.name]].slice(0, 40)`), so every writing node past the 40th is, in the
    // document as written, a write from a node absent from writers[] (§5). True per the standard;
    // the defect is the producer's. Proven independently here: the reported nodes are exactly the
    // edge sources writing each variable minus its declared writers (no ancestor is a writer).
    const owners = extras.filter((f) => f.code === 'VAR_WRITER_NOT_OWNER');
    const expected = new Map<string, Set<string>>();
    const declared = new Map(graph.variables.map((v) => [v.name, new Set(v.writers)]));
    for (const e of graph.edges) {
      for (const w of e.writes ?? []) {
        if (declared.get(w.var)?.has(e.from) === false) expected.set(w.var, (expected.get(w.var) ?? new Set()).add(e.from));
      }
    }
    expect(owners.map((f) => f.variables![0]).sort()).toEqual([...expected.keys()].sort());
    for (const f of owners) expect([...f.nodes].sort()).toEqual([...expected.get(f.variables![0])!].sort());
    expect(owners).toHaveLength(16);
    for (const name of expected.keys()) expect(graph.variables.find((v) => v.name === name)!.writers).toHaveLength(40);

    // Nothing else.
    expect(extras.filter((f) => f.code !== 'ENDING_UNREACHABLE' && f.code !== 'VAR_WRITER_NOT_OWNER')).toEqual([]);
    expect(extras).toHaveLength(17);
  });

  it('runs the full suite in under 250 ms (median of 5 after warm-up)', () => {
    const { graph } = load();
    validateStoryGraph(graph);
    validateStoryGraph(graph);
    const runs: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      validateStoryGraph(graph);
      runs.push(performance.now() - t0);
    }
    const median = [...runs].sort((a, b) => a - b)[2];
    console.error(`[storygraph-validate] synthetic-scale (10,739 nodes) runs ms: ${runs.map((r) => r.toFixed(1)).join(', ')}; median ${median.toFixed(1)}`);
    expect(median).toBeLessThan(250);
  });
});
