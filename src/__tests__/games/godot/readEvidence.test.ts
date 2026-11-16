/**
 * `readGodotEvidence` (spark gtai-phase-2, WP2): one verdict per branch of the `pof.godot-evidence/1`
 * rules — absent, unparseable / schema mismatch, stale commit, status fail, pass — against real files
 * in a temp dir. The game HEAD is injected, so no real game repo is needed (one case runs real git).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readGodotEvidence, parseGodotEvidence, godotEvidencePath, gitHeadOf } from '@/lib/games/godot/readEvidence';
import { GODOT_EVIDENCE_SCHEMA, type GodotEvidence, type GodotEvidenceKind } from '@/lib/games/godot/evidenceTypes';

const HEAD = 'a'.repeat(40);
const OLD = 'b'.repeat(40);

function envelope(over: Partial<Record<keyof GodotEvidence, unknown>> = {}): Record<string, unknown> {
  return {
    schema: GODOT_EVIDENCE_SCHEMA, kind: 'lint', gameId: 'gtai', commit: HEAD,
    builtAt: '2026-11-02T10:00:00.000Z', godotVersion: '4.7.2', status: 'pass', summary: 'gdlint clean',
    ...over,
  };
}

let root: string;
const write = (kind: GodotEvidenceKind, body: string | Record<string, unknown>) => {
  mkdirSync(join(root, 'build', 'evidence'), { recursive: true });
  writeFileSync(godotEvidencePath(root, kind), typeof body === 'string' ? body : JSON.stringify(body));
};
const read = (kind: GodotEvidenceKind = 'lint', head: string | null = HEAD) => readGodotEvidence(root, kind, { headOf: () => head, gameId: 'gtai' });

beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'pof-godot-evidence-')); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

describe('readGodotEvidence verdicts', () => {
  it('file absent → deferred "no evidence yet"', () => {
    const v = read();
    expect(v.status).toBe('deferred');
    expect(v.reason).toMatch(/^no evidence yet/);
    expect(v.evidence).toBeUndefined();
  });

  it('unparseable → fail', () => {
    write('lint', '{ not json');
    const v = read();
    expect(v.status).toBe('fail');
    expect(v.reason).toMatch(/unparseable JSON/);
  });

  it('schema mismatch → fail', () => {
    write('lint', envelope({ schema: 'pof.godot-evidence/2' }));
    expect(read()).toMatchObject({ status: 'fail', reason: expect.stringMatching(/schema "pof.godot-evidence\/2"/) });
  });

  it('kind mismatch → fail (a unit-tests file under lint.json is not lint evidence)', () => {
    write('lint', envelope({ kind: 'unit-tests' }));
    expect(read()).toMatchObject({ status: 'fail', reason: expect.stringMatching(/kind "unit-tests", expected lint/) });
  });

  it('a null optional key → fail (absent values are omitted, never null)', () => {
    write('lint', envelope({ counts: null }));
    expect(read()).toMatchObject({ status: 'fail', reason: expect.stringMatching(/counts is null/) });
  });

  it('another game’s evidence → fail', () => {
    write('lint', envelope({ gameId: 'pof' }));
    expect(read()).toMatchObject({ status: 'fail', reason: expect.stringMatching(/gameId pof, expected gtai/) });
  });

  it('stale commit → deferred "stale: evidence from <sha7>, HEAD <sha7>"', () => {
    write('lint', envelope({ commit: OLD }));
    const v = read();
    expect(v.status).toBe('deferred');
    expect(v.reason).toBe(`stale: evidence from ${OLD.slice(0, 7)}, HEAD ${HEAD.slice(0, 7)}`);
    expect(v.evidence?.commit).toBe(OLD);
  });

  it('a stale FAIL is still deferred: staleness is judged before status', () => {
    write('lint', envelope({ commit: OLD, status: 'fail' }));
    expect(read().status).toBe('deferred');
  });

  it('HEAD unknown (git failed) → deferred with the reason, never pass', () => {
    write('lint', envelope());
    const v = read('lint', null);
    expect(v.status).toBe('deferred');
    expect(v.reason).toMatch(/cannot read the game HEAD/);
  });

  it('status fail at HEAD → fail', () => {
    write('unit-tests', envelope({ kind: 'unit-tests', status: 'fail', summary: '2 tests failed', counts: { passed: 10, failed: 2, skipped: 0 } }));
    const v = read('unit-tests');
    expect(v.status).toBe('fail');
    expect(v.detail).toBe('unit-tests: 2 tests failed (10 passed, 2 failed, 0 skipped)');
  });

  it('status pass at HEAD → pass, carrying the parsed evidence', () => {
    write('lint', envelope({ metrics: { warnings: 0 }, artifacts: ['lint.txt'] }));
    const v = read();
    expect(v.status).toBe('pass');
    expect(v.reason).toBeUndefined();
    expect(v.evidence?.artifacts).toEqual(['lint.txt']);
  });
});

describe('parseGodotEvidence', () => {
  it('rejects a missing required field and a bad counts shape', () => {
    const noCommit = envelope();
    delete noCommit.commit;
    expect(parseGodotEvidence(JSON.stringify(noCommit), 'lint')).toMatchObject({ ok: false, error: expect.stringMatching(/commit/) });
    expect(parseGodotEvidence(JSON.stringify(envelope({ counts: { passed: 1 } })), 'lint').ok).toBe(false);
    expect(parseGodotEvidence(JSON.stringify(envelope({ status: 'green' })), 'lint').ok).toBe(false);
  });
});

describe('gitHeadOf', () => {
  it('reads the full HEAD SHA of a real repo, and null outside one', () => {
    execFileSync('git', ['init', '-q', root]);
    execFileSync('git', ['-C', root, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'x']);
    expect(gitHeadOf(root)).toMatch(/^[0-9a-f]{40}$/);
    expect(gitHeadOf(join(root, 'no-such-dir'))).toBeNull();
  });
});
