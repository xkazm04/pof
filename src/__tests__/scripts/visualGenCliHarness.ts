/**
 * Runs an operator CLI from scripts/visual-gen in a real node child with `fetch` replaced
 * by a scripted stub, so its exit paths are exercised WITHOUT a network call or a credit.
 * Not a test file: the suites beside it import it.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export interface StubResponse {
  status?: number;
  /** JSON-encoded unless a string. */
  body?: unknown;
  /** Emit this process signal while the request is in flight. */
  emit?: string;
}

/** First matching rule wins; a rule's `responses` are consumed in order and the last repeats. */
export interface StubRule { method?: string; match: string; responses: StubResponse[] }

const PRELOAD = `
const rules = JSON.parse(process.env.POF_STUB_RULES);
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, _ms, ...a) => realSetTimeout(fn, 0, ...a);
globalThis.fetch = async (url, opts = {}) => {
  const method = opts.method || 'GET';
  console.error('STUB ' + method + ' ' + url);
  const rule = rules.find((r) => (!r.method || r.method === method) && String(url).includes(r.match));
  if (!rule) return new Response('no stub for ' + url, { status: 599 });
  const next = rule.responses.length > 1 ? rule.responses.shift() : rule.responses[0];
  if (next.emit) process.emit(next.emit, next.emit);
  const body = typeof next.body === 'string' ? next.body : JSON.stringify(next.body ?? {});
  return new Response(body, { status: next.status ?? 200 });
};
`;

export interface CliRun { stdout: string; calls: string[]; status: number | null; dir: string }

/** `script` is relative to scripts/visual-gen. `{dir}` in an arg expands to a fresh temp dir. */
export function runVisualGenCli(script: string, args: string[], rules: StubRule[], env: Record<string, string>): CliRun {
  const dir = mkdtempSync(join(tmpdir(), 'pof-cli-'));
  const preload = join(dir, 'preload.mjs');
  writeFileSync(preload, PRELOAD);
  const res = spawnSync(
    process.execPath,
    ['--import', pathToFileURL(preload).href, join(process.cwd(), 'scripts', 'visual-gen', script), ...args.map((a) => a.replace('{dir}', dir))],
    { encoding: 'utf8', env: { ...process.env, ...env, POF_STUB_RULES: JSON.stringify(rules) }, timeout: 30_000 },
  );
  const calls = res.stderr.split(/\r?\n/).filter((l) => l.startsWith('STUB ')).map((l) => l.slice(5));
  return { stdout: res.stdout, calls, status: res.status, dir };
}
