import test from 'node:test';
import assert from 'node:assert/strict';
import { TOOLS } from './tools/index.js';
import { EXAMPLE_SKIP } from './coverage.js';
import { connectMcp } from './harness.js';

test('every tool: unique pof_-prefixed name, real description, valid object schema', () => {
  const seen = new Set<string>();
  for (const t of TOOLS) {
    assert.match(t.name, /^pof_[a-z0-9_]+$/, `bad tool name: ${t.name}`);
    assert.ok(!seen.has(t.name), `duplicate tool name: ${t.name}`);
    seen.add(t.name);
    assert.ok(t.description && t.description.length > 15, `${t.name}: weak/missing description`);
    const s: any = t.inputSchema;
    assert.equal(s.type, 'object', `${t.name}: inputSchema.type must be "object"`);
    assert.ok(s.properties && typeof s.properties === 'object', `${t.name}: missing properties`);
    for (const req of s.required ?? []) {
      assert.ok(req in s.properties, `${t.name}: required "${req}" absent from properties`);
    }
  }
});

test('example-coverage guard: every tool has a static example or a documented EXAMPLE_SKIP reason', () => {
  const offenders: string[] = [];
  for (const t of TOOLS) {
    const covered = !!t.example || typeof EXAMPLE_SKIP[t.name] === 'string';
    if (!covered) offenders.push(t.name);
  }
  assert.deepEqual(offenders, [], `tools missing an example or EXAMPLE_SKIP reason: ${offenders.join(', ')}`);
  // And EXAMPLE_SKIP must not list unknown tools (keeps the map honest as tools change).
  const names = new Set(TOOLS.map((t) => t.name));
  const stale = Object.keys(EXAMPLE_SKIP).filter((n) => !names.has(n));
  assert.deepEqual(stale, [], `EXAMPLE_SKIP references unknown tools: ${stale.join(', ')}`);
});

test('tools/list over stdio exactly matches the registry (names + schemas advertised)', async () => {
  const mcp = await connectMcp();
  try {
    const listed = await mcp.listTools();
    assert.deepEqual(
      listed.map((t) => t.name).sort(),
      TOOLS.map((t) => t.name).sort(),
      'advertised tools differ from the registry',
    );
    for (const t of listed) {
      assert.ok(t.inputSchema && t.inputSchema.type === 'object', `${t.name}: no object inputSchema advertised`);
    }
  } finally {
    await mcp.close();
  }
});
