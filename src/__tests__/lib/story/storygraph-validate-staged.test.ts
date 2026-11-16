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

    // (3) GATE_WITHOUT_CONDITION, one per act (wave 5 rule: a gate NODE none of whose outgoing
    // traversal edges carries a `when` branches on nothing). Each ACTn.gate (n = 1..7) is kind
    // `gate` whose ONLY way on is an unguarded `then` to the next act's hub: no guarded edge, so
    // the `then` is not a default branch beside anything. Mis-kinded (an `event`) or missing its
    // guard: true per the standard, the producer's defect. Every other gate node guards at least
    // one outgoing edge, so its unguarded `then` edges (if any) are its default branch.
    const gates = extras.filter((f) => f.code === 'GATE_WITHOUT_CONDITION');
    expect(gates.map((f) => f.nodes)).toEqual(['ACT1.gate', 'ACT2.gate', 'ACT3.gate', 'ACT4.gate', 'ACT5.gate', 'ACT6.gate', 'ACT7.gate'].map((g) => [g]));
    for (const f of gates) {
      const out = graph.edges.filter((e) => e.from === f.nodes[0]);
      expect(out.map((e) => [e.kind, e.when ?? null])).toEqual([['then', null]]);
      expect(f.severity).toBe('error');
    }
    // Independently: exactly the gate nodes with >= 1 traversal edge out and none guarded.
    const traversal = new Set(['then', 'option', 'gate']);
    const bareGates = graph.nodes.filter((n) => n.kind === 'gate').map((n) => n.id).filter((id) => {
      const out = graph.edges.filter((e) => e.from === id && traversal.has(e.kind));
      return out.length > 0 && out.every((e) => e.when === undefined);
    });
    expect(bareGates.sort()).toEqual(gates.map((f) => f.nodes[0]).sort());

    // (4) INFLUENCES_UNSUPPORTED, all 96 declared `influences` edges (wave 5, §5). Every one is
    // ACTa.Qb.D1.l1 -> ACTa.Qb.r ("the opening sets the terms"): the opening line of a quest's
    // first conversation and the quest's resolution beat. Both are plain events (no children);
    // the line's only traversal edge (-> l2) writes nothing, and the resolution's only edge (-> the
    // act gate) carries no `when`. The edge asserts a data dependency the document does not carry:
    // true per the standard (the edges are decorative); the producer's defect. Proven
    // independently below from the raw edges, not from the validator's own sets.
    const influences = extras.filter((f) => f.code === 'INFLUENCES_UNSUPPORTED');
    const declaredInf = graph.edges.filter((e) => e.kind === 'influences');
    expect(declaredInf).toHaveLength(96);
    expect(influences).toHaveLength(96);
    expect(influences.map((f) => f.nodes.join('>')).sort()).toEqual(declaredInf.map((e) => `${e.from}>${e.to}`).sort());
    for (const e of declaredInf) {
      expect(e.from).toMatch(/^ACT\d\.Q\d+\.D1\.l1$/);
      expect(e.to).toBe(e.from.replace(/\.D1\.l1$/, '.r'));
      expect(graph.nodes.some((n) => n.parent === e.from || n.parent === e.to)).toBe(false);
      expect(graph.edges.filter((d) => d.from === e.from && (d.writes?.length ?? 0) > 0)).toEqual([]);
      expect(graph.edges.filter((d) => d.from === e.to && d.when !== undefined)).toEqual([]);
      expect(graph.endings.some((x) => x.node === e.to)).toBe(false);
    }
    for (const f of influences) expect(f.severity).toBe('warn');

    // Nothing else (UNKNOWN_KIND included: every profile coreKind is one of the seven).
    expect(extras.filter((f) => !['ENDING_UNREACHABLE', 'VAR_WRITER_NOT_OWNER', 'GATE_WITHOUT_CONDITION', 'INFLUENCES_UNSUPPORTED'].includes(f.code))).toEqual([]);
    expect(extras).toHaveLength(1 + 16 + 7 + 96);
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

/**
 * Wave 4 + 5: the structural codes added by the amendment passes on the two hand-transcribed staged
 * documents, asserted exactly. Only these codes are pinned here (the older codes are the Orrery's).
 */
const AMENDED = new Set(['CHOICE_TOO_FEW_OPTIONS', 'GATE_WITHOUT_CONDITION', 'UNKNOWN_KIND', 'PARENT_CONTAINS_MISMATCH', 'STRING_VAR_NO_VALUES', 'PRECEDENCE_NOT_TOTAL', 'INFLUENCES_UNSUPPORTED']);
const MAGE = find('mage-arena-season.json');
const EXEMPLARS = find('pof-exemplars.json');

describe.skipIf(!MAGE || !EXEMPLARS)('the hand-transcribed staged documents: the amendment codes', () => {
  const amended = (file: string) => {
    const r = parseStoryGraph(fs.readFileSync(file, 'utf8'));
    if (!r.ok) throw new Error(r.error);
    return { graph: r.data, findings: validateStoryGraph(r.data).filter((f) => AMENDED.has(f.code)) };
  };

  it('mage-arena-season: G2 branches on nothing, and influences me20 is unsupported; both true', () => {
    const { graph, findings } = amended(MAGE!);
    expect(findings.map((f) => `${f.code}:${f.nodes.join(',')}`)).toEqual(['GATE_WITHOUT_CONDITION:G2', 'INFLUENCES_UNSUPPORTED:CP2.2,S-2']);

    // G1, G3, G4, G5 (and TR) each carry a guarded `gate` edge, so their unguarded `then` edges
    // are the default branch (wave 5) and are clean. G2's three edges (me21-me23) are ALL
    // unguarded `then`s: no guard anywhere, so it is an event (or a hub) kinded as a gate. True per
    // the standard; the transcription should make G2 an `event` (with `mode: 'all'` if its three
    // edges are parallel threads) or guard one of them.
    const out = (id: string) => graph.edges.filter((e) => e.from === id && ['then', 'option', 'gate'].includes(e.kind));
    expect(out('G2').map((e) => [e.id, e.kind, e.when ?? null])).toEqual([['me21', 'then', null], ['me22', 'then', null], ['me23', 'then', null]]);
    for (const g of ['G1', 'G3', 'G4', 'G5', 'TR']) expect(out(g).some((e) => e.when !== undefined)).toBe(true);
    expect(findings[0].detail).toContain('then me21 -> CP3.1, then me22 -> S-3, then me23 -> B3.3');

    // me20 (CP2.2 -> S-2, "slow Parley-ask route"): CP2.2's option edges write {gold, knows.player};
    // S-2's only edge (me26 -> G3) carries no `when` and S-2 is no ending, so its guards read
    // nothing. (S-2 is ENTERED through a guarded edge, me24, but that guard belongs to CP3.1.)
    // The declared dependency is not in the data: true per §5. The other influence, me38
    // (S-2 -> S-5), IS supported: S-2 pushes knows.player and S-5's `tell` guard reads it.
    expect(findings[1].detail).toContain("CP2.2 writes {gold, knows.player}, S-2's guards read {}");
    expect(findings[1].severity).toBe('warn');
    expect(graph.edges.filter((e) => e.from === 'S-2' && e.when !== undefined)).toEqual([]);
    expect(graph.endings.some((x) => x.node === 'S-2')).toBe(false);
  });

  it('pof-exemplars: influences pe10 (Q.start -> Q.choose) is unsupported; true', () => {
    const { graph, findings } = amended(EXEMPLARS!);
    // Q.start writes questStage (pe9); Q.choose's three option edges carry no `when` (they WRITE
    // questStage, they do not read it) and Q.choose is no ending. "The emissary's terms" shape the
    // prose, not a guard: the dependency the edge declares is not in the data. True per §5.
    expect(findings.map((f) => `${f.code}:${f.nodes.join(',')}`)).toEqual(['INFLUENCES_UNSUPPORTED:Q.start,Q.choose']);
    expect(findings[0].detail).toContain("Q.start writes {questStage}, Q.choose's guards read {}");
    expect(graph.edges.filter((e) => e.from === 'Q.choose' && e.when !== undefined)).toEqual([]);
  });
});
