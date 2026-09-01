import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOOLS } from './tools/index.js';
import type { ToolDef } from './tools/shared.js';
import type { PofClient } from './pofClient.js';
import { READ_ONLY_POST, WRITE_TOOL_SAFE_EXAMPLE } from './coverage.js';
import { connectMcp } from './harness.js';

/**
 * ── Tool annotations are claims; this guard pins them to behaviour ──
 *
 * `tools/list` now advertises MCP `ToolAnnotations` (readOnlyHint / destructiveHint /
 * idempotentHint / openWorldHint) so a host can tier consent — auto-approve the reads,
 * confirm the drains and harness starts. A hint is prose unless something checks it, and
 * the dangerous direction is a WRITE wearing `readOnlyHint: true`: a host that trusts this
 * server would then auto-approve a verdict flip or an editor boot.
 *
 * So, for every tool annotated read-only, this test drives its handler against a
 * recording client and asserts it never POSTs — unless the route is allow-listed in
 * `READ_ONLY_POST` with a reason, in which case the route's SOURCE is checked for the
 * write primitives a "pure compute" route must not have. The map cannot go stale either
 * way: an entry no read-only tool reaches fails, and so does a write tool that keeps a
 * static example without saying why in `WRITE_TOOL_SAFE_EXAMPLE`.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const API_DIR = path.join(REPO, 'src', 'app', 'api');

/**
 * What a route that only reads/computes must NOT contain. Mirrors the scope guard's static
 * cross-check. Process spawns are matched as bare calls or a child_process import — a
 * member call like `regex.exec(...)` is RegExp, not a shell (it was the first false positive).
 */
const WRITE_PRIMITIVES = new RegExp([
  String.raw`\b(writeFile|writeFileSync|appendFile|appendFileSync|mkdir|mkdirSync|rm|rmSync|unlink|unlinkSync|rename|renameSync|copyFile|copyFileSync)\s*\(`,
  String.raw`(?<![.\w])(spawn|spawnSync|exec|execSync|execFile|execFileSync)\s*\(`,
  String.raw`from '(node:)?child_process'`,
  String.raw`from '@\/lib\/[^']*\bdb\b[^']*'`,
  String.raw`from '@\/lib\/[^']*-db'`,
  String.raw`\bsaveRun\b`,
  String.raw`(?<![.\w])(insert|upsert)[A-Z]\w*\s*\(`,
].join('|'));

interface Call { method: 'GET' | 'POST'; path: string }

function probeArgs(t: ToolDef): Record<string, unknown> {
  const schema = t.inputSchema as { properties?: Record<string, any>; required?: string[] };
  const args: Record<string, unknown> = { ...(t.example?.args ?? {}) };
  for (const key of schema.required ?? []) {
    if (key in args) continue;
    const spec = schema.properties?.[key];
    switch (spec?.type) {
      case 'string': args[key] = spec.enum ? spec.enum[0] : 'probe'; break;
      case 'number': args[key] = 1; break;
      case 'object': args[key] = {}; break;
      case 'array': args[key] = []; break;
      case 'boolean': args[key] = false; break;
      default: args[key] = 'probe';
    }
  }
  return args;
}

function probeReply(routePath: string, args: Record<string, unknown>): unknown {
  if (routePath.startsWith('/api/catalog/pipelines')) return [{ catalogId: args.catalogId ?? 'items', steps: [] }];
  return Object.assign([] as unknown[], { ok: true, hydratable: false, steps: [], scope: {}, summary: {} });
}

async function probe(t: ToolDef): Promise<Call[]> {
  const args = probeArgs(t);
  const calls: Call[] = [];
  const pof = {
    get: async (p: string) => { calls.push({ method: 'GET', path: p }); return probeReply(p, args); },
    post: async (p: string) => { calls.push({ method: 'POST', path: p }); return probeReply(p, args); },
  } as unknown as PofClient;
  try {
    await t.handler(args, pof);
  } catch {
    /* a validation throw after the first call is fine — the calls made are what we judge */
  }
  return calls;
}

const stripQuery = (p: string) => p.split('?')[0];

test('every tool declares a complete, internally consistent annotation block', () => {
  for (const t of TOOLS) {
    const a = t.annotations;
    assert.ok(a && typeof a === 'object', `${t.name}: missing annotations`);
    assert.ok(typeof a.title === 'string' && a.title.length > 2, `${t.name}: annotations.title`);
    for (const k of ['readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint'] as const) {
      assert.equal(typeof a[k], 'boolean', `${t.name}: annotations.${k} must be a boolean verdict, not absent`);
    }
    if (a.readOnlyHint) {
      assert.equal(a.destructiveHint, false, `${t.name}: read-only cannot be destructive`);
      assert.equal(a.idempotentHint, true, `${t.name}: a read is idempotent by definition`);
    }
  }
});

test('a static example belongs to a read-only tool, or the write tool says why its example is safe', () => {
  const offenders: string[] = [];
  for (const t of TOOLS) {
    if (t.example && !t.annotations.readOnlyHint && typeof WRITE_TOOL_SAFE_EXAMPLE[t.name] !== 'string') offenders.push(t.name);
  }
  assert.deepEqual(offenders, [], `write tools with an unexplained static example: ${offenders.join(', ')}`);
  const names = new Map(TOOLS.map((t) => [t.name, t]));
  for (const n of Object.keys(WRITE_TOOL_SAFE_EXAMPLE)) {
    const t = names.get(n);
    assert.ok(t, `WRITE_TOOL_SAFE_EXAMPLE references unknown tool ${n}`);
    assert.ok(!t!.annotations.readOnlyHint, `${n}: listed as a write tool with a safe example but annotated read-only — drop the entry`);
    assert.ok(t!.example, `${n}: listed in WRITE_TOOL_SAFE_EXAMPLE but has no static example — drop the entry`);
  }
});

test('a read-only tool never POSTs, except to a route allow-listed with a reason', async () => {
  const reached = new Set<string>();
  const violations: string[] = [];
  for (const t of TOOLS) {
    if (!t.annotations.readOnlyHint) continue;
    const calls = await probe(t);
    assert.ok(calls.length > 0, `${t.name}: read-only tool reached no route — unprobeable, so its hint is unverified`);
    for (const c of calls) {
      if (c.method !== 'POST') continue;
      const route = stripQuery(c.path);
      if (typeof READ_ONLY_POST[route] === 'string') reached.add(route);
      else violations.push(`${t.name} → POST ${route}`);
    }
  }
  assert.deepEqual(violations, [], `read-only tools POSTing to a route not in READ_ONLY_POST:\n  ${violations.join('\n  ')}`);
  const stale = Object.keys(READ_ONLY_POST).filter((r) => !reached.has(r));
  assert.deepEqual(stale, [], `READ_ONLY_POST entries no read-only tool reaches: ${stale.join(', ')}`);
});

test('every READ_ONLY_POST route resolves to a real route.ts that carries no write primitive', () => {
  for (const route of Object.keys(READ_ONLY_POST)) {
    const file = path.join(API_DIR, route.replace(/^\/api\//, ''), 'route.ts');
    assert.ok(fs.existsSync(file), `${route}: no route.ts at ${file}`);
    const src = fs.readFileSync(file, 'utf8');
    const hit = src.match(WRITE_PRIMITIVES);
    assert.equal(hit, null, `${route}: allow-listed as read-only but its source contains a write primitive: ${hit?.[0]}`);
  }
});

test('tools/list over stdio advertises the same annotations the registry declares', async () => {
  const mcp = await connectMcp();
  try {
    const listed = await mcp.listTools();
    const byName = new Map(TOOLS.map((t) => [t.name, t.annotations]));
    for (const t of listed) {
      assert.deepEqual(t.annotations, byName.get(t.name), `${t.name}: advertised annotations differ from the registry`);
    }
  } finally {
    await mcp.close();
  }
});
