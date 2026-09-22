// codex-cli orchestration core. The argv tests pin the three traps found by live probing on
// 2026-09-22 (stdin hang, variadic -i eating the prompt, --approve-for-me vs -s); the event
// test runs on a stream CAPTURED from a real `codex exec --approve-for-me` run, not an
// invented one.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { routeTask, CODEX_MODELS } from '@/lib/codex-exec/routing';
import { buildCodexExecArgs, buildCodexResumeArgs, CODEX_SPAWN_STDIO, PROMPT_FROM_STDIN } from '@/lib/codex-exec/args';
import { parseCodexEvents } from '@/lib/codex-exec/events';
import { renderBrief, CODEX_REPORT_SCHEMA, REPO_LAWS, type CodexTask } from '@/lib/codex-exec/brief';
import { summarizeLedger, type LedgerEntry } from '@/lib/codex-exec/ledger';

describe('routeTask — the operator policy', () => {
  it('bulk → Sol at low/medium; complex → Sol at high/xhigh; visual → Astra', () => {
    expect(routeTask('bulk')).toMatchObject({ model: CODEX_MODELS.sol, effort: 'medium' });
    expect(routeTask('bulk', { trivial: true })).toMatchObject({ model: 'gpt-5.6-sol', effort: 'low' });
    expect(routeTask('complex')).toMatchObject({ model: 'gpt-5.6-sol', effort: 'high' });
    expect(routeTask('complex', { hardest: true }).effort).toBe('xhigh');
    expect(routeTask('visual')).toMatchObject({ model: 'gpt-6-astra', effort: 'medium' });
    expect(routeTask('visual', { design: true })).toMatchObject({ model: 'gpt-6-astra', effort: 'high' });
  });
});

describe('buildCodexExecArgs — the probed traps', () => {
  const base = { route: routeTask('bulk'), prompt: 'do it', cwd: '/wt', lastMessagePath: '/r/last.json' };

  it('stdin must be ignored by the spawner (trap 1: exec waits for EOF on a piped stdin)', () => {
    expect(CODEX_SPAWN_STDIO[0]).toBe('ignore');
  });

  it('the prompt is always last and fenced by `--`, even after variadic -i (trap 2)', () => {
    const a = buildCodexExecArgs({ ...base, access: 'read-only', images: ['a.png', 'b.png'] });
    expect(a.slice(-2)).toEqual(['--', 'do it']);
    expect(a.indexOf('-i')).toBeLessThan(a.indexOf('--'));
    expect(a.filter((x) => x === '-i')).toHaveLength(2);
  });

  it('read-only uses the sandbox flag; write-verified uses --approve-for-me and NEVER -s (trap 3)', () => {
    const ro = buildCodexExecArgs({ ...base, access: 'read-only' });
    expect(ro).toContain('read-only');
    expect(ro).not.toContain('--approve-for-me');
    const rw = buildCodexExecArgs({ ...base, access: 'write-verified' });
    expect(rw).toContain('--approve-for-me');
    expect(rw).not.toContain('-s');
  });

  it('passes model + effort as TOML, JSON events, output file, working root and schema', () => {
    const a = buildCodexExecArgs({ ...base, access: 'read-only', outputSchemaPath: '/r/schema.json' });
    expect(a.slice(0, 5)).toEqual(['exec', '-m', 'gpt-5.6-sol', '-c', 'model_reasoning_effort="medium"']);
    expect(a).toEqual(expect.arrayContaining(['--json', '-o', '/r/last.json', '-C', '/wt', '--output-schema', '/r/schema.json']));
  });

  it('a stdin prompt is still fenced, so `-` cannot be read as a flag value', () => {
    const a = buildCodexExecArgs({ ...base, access: 'write-verified', prompt: PROMPT_FROM_STDIN, images: ['x.png'] });
    expect(a.slice(-2)).toEqual(['--', '-']);
  });

  it('never disables the sandbox wholesale', () => {
    for (const access of ['read-only', 'write-verified'] as const) {
      expect(buildCodexExecArgs({ ...base, access }).join(' ')).not.toMatch(/dangerously/);
    }
  });

  it('resume carries no sandbox flag (it inherits the session’s) and still fences the prompt', () => {
    const r = buildCodexResumeArgs({ threadId: 'T1', prompt: 'follow up', lastMessagePath: '/r/2.json' });
    expect(r.slice(0, 3)).toEqual(['exec', 'resume', 'T1']);
    expect(r).not.toContain('-s');
    expect(r.slice(-2)).toEqual(['--', 'follow up']);
  });

  it('resume keeps the report schema-enforced when given one', () => {
    const r = buildCodexResumeArgs({ threadId: 'T1', prompt: '-', lastMessagePath: '/r/2.json', outputSchemaPath: '/r/schema.json' });
    expect(r).toEqual(expect.arrayContaining(['--output-schema', '/r/schema.json']));
  });
});

describe('parseCodexEvents — a captured real run', () => {
  const jsonl = readFileSync(join(process.cwd(), 'src/__tests__/fixtures/codex/exec-approve-for-me.jsonl'), 'utf8');
  const s = parseCodexEvents(jsonl);

  it('yields the session id needed to resume', () => {
    expect(s.threadId).toBe('01a0c8c9-a904-7191-b883-ef2cdf1a768b');
  });

  it('lists the failed sandboxed attempt AND the passing escalated retry — failures are not hidden', () => {
    expect(s.commands.map((c) => c.exitCode)).toEqual([1, 0]);
    expect(s.failedCommands).toHaveLength(1);
    expect(s.messages.at(-1)).toContain('13 passed');
  });

  it('marks the run completed and reads usage', () => {
    expect(s.completed).toBe(true);
    expect(s.usage?.outputTokens).toBe(313);
  });

  it('a truncated stream still yields what it carried, and says it did not complete', () => {
    const cut = jsonl.split('\n').slice(0, 3).join('\n') + '\n{"type":"item.comp';
    const t = parseCodexEvents(cut);
    expect(t.threadId).not.toBeNull();
    expect(t.completed).toBe(false);
    expect(t.unparsedLines).toBe(1);
  });
});

describe('renderBrief', () => {
  const task: CodexTask = {
    id: 'T-1', tier: 'bulk', access: 'write-verified', title: 'Cap parse size',
    goal: 'Refuse oversized input.', context: ['src/lib/catalog/ingest/tsv.ts'],
    scope: ['src/lib/catalog/ingest/tsv.ts'], acceptance: ['npx vitest run src/__tests__/catalog/ingest'],
  };

  it('carries every repo law, the scope and the acceptance commands — Codex reads no CLAUDE.md', () => {
    const b = renderBrief(task);
    for (const law of REPO_LAWS) expect(b).toContain(law);
    expect(b).toContain('src/lib/catalog/ingest/tsv.ts');
    expect(b).toContain('npx vitest run src/__tests__/catalog/ingest');
    expect(b).toMatch(/never report a test as passed that you did not see pass/);
  });

  it('a read-only brief forbids modification', () => {
    expect(renderBrief({ ...task, access: 'read-only' })).toContain('READ-ONLY');
  });

  it('the report schema requires deviations and open questions', () => {
    expect(CODEX_REPORT_SCHEMA.required).toEqual(expect.arrayContaining(['deviations', 'openQuestions', 'testsRun']));
  });
});

describe('summarizeLedger', () => {
  const e = (o: Partial<LedgerEntry>): LedgerEntry => ({
    id: 'x', at: 't', tier: 'bulk', taskClass: 'mapping', model: 'gpt-5.6-sol', effort: 'medium',
    verdict: 'accepted', rounds: 1, secs: 30, outputTokens: 100, notes: '', ...o,
  });

  it('separates independent (first-pass) acceptance from acceptance after instructions', () => {
    const [s] = summarizeLedger([e({}), e({ verdict: 'accepted-after-revision', rounds: 2 }), e({ verdict: 'rejected', rounds: 3 })]);
    expect(s.n).toBe(3);
    expect(s.firstPass).toBeCloseTo(1 / 3);
    expect(s.accepted).toBeCloseTo(2 / 3);
    expect(s.meanRounds).toBe(2);
  });
});
