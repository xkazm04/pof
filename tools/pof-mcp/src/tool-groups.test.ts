import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TOOLS,
  TOOL_GROUPS,
  GROUP_NAMES,
  GROUPS_ENV,
  advertisedTools,
  toolVisibility,
  resolveEnabledGroups,
  groupReport,
  groupOf,
} from './tools/index.js';
import { connectMcp } from './harness.js';

const names = (ts: { name: string }[]) => ts.map((t) => t.name).sort();

test('the group table partitions the registry exactly once — no tool orphaned, none double-counted', () => {
  const grouped = TOOL_GROUPS.flatMap((g) => g.tools.map((t) => t.name));
  assert.equal(new Set(grouped).size, grouped.length, 'a tool appears in two groups');
  // Every registry tool is either in a group or is the always-visible meta tool.
  const meta = TOOLS.filter((t) => groupOf(t.name) === 'meta').map((t) => t.name);
  assert.deepEqual(meta, ['pof_tool_groups'], 'exactly one always-visible meta tool');
  assert.deepEqual([...grouped, ...meta].sort(), names(TOOLS));
});

test('unset / blank / "all" advertise the whole surface — gating is opt-in', () => {
  for (const raw of [undefined, '', '   ', 'all', 'ALL']) {
    assert.equal(resolveEnabledGroups(raw).all, true, `${JSON.stringify(raw)} should enable every group`);
    assert.deepEqual(names(advertisedTools(raw)), names(TOOLS), `${JSON.stringify(raw)} should advertise every tool`);
  }
});

test('a subset advertises only those groups, plus the meta tool', () => {
  const advertised = names(advertisedTools('pipeline,ue'));
  const expected = names([
    ...TOOL_GROUPS.filter((g) => g.name === 'pipeline' || g.name === 'ue').flatMap((g) => g.tools),
    { name: 'pof_tool_groups' },
  ]);
  assert.deepEqual(advertised, expected);
  assert.ok(advertised.length < TOOLS.length, 'the subset must actually be smaller');
  assert.ok(advertised.includes('pof_tool_groups'), 'the group tool is always advertised');
});

test('an all-unknown spec falls back to the full surface rather than to nothing', () => {
  // A typo must never strip an autonomous run of its whole tool surface.
  const res = resolveEnabledGroups('pipelines,harnes');
  assert.deepEqual(res.enabled, GROUP_NAMES);
  assert.deepEqual(res.unknown, ['pipelines', 'harnes']);
  assert.deepEqual(names(advertisedTools('pipelines,harnes')), names(TOOLS));
});

test('unknown names beside known ones are reported, not silently dropped', () => {
  const res = resolveEnabledGroups('pipeline,nope');
  assert.deepEqual(res.enabled, ['pipeline']);
  assert.deepEqual(res.unknown, ['nope']);
  const report = groupReport('pipeline,nope');
  assert.deepEqual((report as { unknownGroupsInEnv?: string[] }).unknownGroupsInEnv, ['nope']);
});

test('a hidden tool is refused, not silently callable', () => {
  const hidden = TOOL_GROUPS.find((g) => g.name === 'sims')!.tools[0].name;
  const vis = toolVisibility(hidden, 'pipeline');
  assert.deepEqual(vis, { known: true, visible: false, group: 'sims' });
  assert.equal(toolVisibility(hidden, undefined).visible, true, 'visible when ungated');
  assert.equal(toolVisibility('pof_tool_groups', 'pipeline').visible, true, 'the meta tool is never gated');
  assert.equal(toolVisibility('pof_not_a_tool', undefined).known, false);
});

test('the report names what a trimmed session is missing, by tool', () => {
  const r = groupReport('pipeline') as {
    hiddenGroups: string[];
    hiddenToolCount: number;
    groups: { group: string; enabled: boolean; tools: string[] }[];
  };
  assert.deepEqual(r.hiddenGroups.sort(), GROUP_NAMES.filter((g) => g !== 'pipeline').sort());
  assert.ok(r.hiddenToolCount > 0);
  // Hidden groups still list their tools — the point is to be able to NAME the gap.
  for (const g of r.groups.filter((g) => !g.enabled)) assert.ok(g.tools.length > 0, `${g.group} lists no tools`);
});

test('every group carries a description an agent can route on', () => {
  for (const g of TOOL_GROUPS) {
    assert.ok(g.description.length > 30, `${g.name}: weak group description`);
    assert.ok(g.tools.length > 0, `${g.name}: empty group`);
  }
});

test('tools/list over stdio honours POF_MCP_TOOL_GROUPS', async () => {
  const mcp = await connectMcp({ [GROUPS_ENV]: 'pipeline' });
  try {
    const listed = await mcp.listTools();
    assert.deepEqual(listed.map((t) => t.name).sort(), names(advertisedTools('pipeline')));
    assert.ok(listed.length < TOOLS.length, 'the gated list must be smaller than the registry');
  } finally {
    await mcp.close();
  }
});

test('calling a gated-out tool over stdio errors and names its group', async () => {
  const hidden = TOOL_GROUPS.find((g) => g.name === 'sims')!.tools[0].name;
  const mcp = await connectMcp({ [GROUPS_ENV]: 'pipeline' });
  try {
    const res = await mcp.call(hidden, {});
    assert.equal(res.isError, true, 'a hidden tool must not execute');
    assert.match(res.text, /"sims" group/);
    assert.match(res.text, /pof_tool_groups/);
  } finally {
    await mcp.close();
  }
});

test('pof_tool_groups is reachable in a trimmed session and reports the truth', async () => {
  const mcp = await connectMcp({ [GROUPS_ENV]: 'pipeline' });
  try {
    const res = await mcp.call('pof_tool_groups', {});
    assert.equal(res.isError, false);
    assert.deepEqual(res.json.enabledGroups, ['pipeline']);
    assert.ok(res.json.hiddenToolCount > 0);
  } finally {
    await mcp.close();
  }
});
