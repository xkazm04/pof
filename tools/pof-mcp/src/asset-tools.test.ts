import test from 'node:test';
import assert from 'node:assert/strict';
import { ASSET_TOOLS } from './tools/assets.js';
import { TOOL_GROUPS, resolveEnabledGroups } from './tools/groups.js';
import { TOOLS, advertisedTools } from './tools/index.js';
import type { PofClient } from './pofClient.js';

/**
 * The assets family exists because pof-mcp could inspect everything and PRODUCE nothing.
 *
 * The registry-wide guards (`schema.test.ts`, `project-scope-guard.test.ts`,
 * `annotations.test.ts`) already cover naming, reachability and blast-radius claims. What
 * they cannot see is the shape of the body each tool sends — and that is exactly where a
 * generation family goes wrong quietly, by forwarding a flag the caller never set.
 */

interface Call { method: string; path: string; body?: unknown }

function recorder(): { client: PofClient; calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    client: {
      async get<T>(path: string): Promise<T> {
        calls.push({ method: 'GET', path });
        return {} as T;
      },
      async post<T>(path: string, body: unknown): Promise<T> {
        calls.push({ method: 'POST', path, body });
        return {} as T;
      },
    },
  };
}

const tool = (name: string) => {
  const t = ASSET_TOOLS.find((x) => x.name === name);
  assert.ok(t, `${name} is not registered`);
  return t;
};

test('the family is registered and gateable as its own group', () => {
  const group = TOOL_GROUPS.find((g) => g.name === 'assets');
  assert.ok(group, 'assets is not a tool group');
  assert.equal(group.tools.length, ASSET_TOOLS.length);
  for (const t of ASSET_TOOLS) assert.ok(TOOLS.some((x) => x.name === t.name), `${t.name} missing from TOOLS`);
  // An operator can trim to it, and trimming to another family hides it.
  assert.ok(resolveEnabledGroups('assets').enabled.includes('assets'));
  const names = advertisedTools('pipeline').map((t) => t.name);
  assert.ok(!names.includes('pof_asset_generate'), 'a trimmed session still advertised the asset tools');
});

test('every generating tool declares that it spends', () => {
  // Three of the four run a paid provider, a GPU, a Blender process or a vision quota.
  // A host that auto-approves them because they claimed read-only would burn credits.
  for (const name of ['pof_asset_generate', 'pof_asset_view_gate', 'pof_asset_icon']) {
    assert.equal(tool(name).annotations.readOnlyHint, false, `${name} claims to be read-only`);
  }
  assert.equal(tool('pof_asset_library').annotations.readOnlyHint, true);
  // Reaching a third-party API is its own axis — generation and the vision gate do, the
  // local Blender icon render does not.
  assert.equal(tool('pof_asset_generate').annotations.openWorldHint, true);
  assert.equal(tool('pof_asset_icon').annotations.openWorldHint, false);
});

test('pof_asset_generate does NOT send a gate flag the caller never stated', async () => {
  // The route defaults `gateInput` to "the gate runs" — the credit-saving default.
  // Forwarding an absent flag as `false` would silently disable the Tier-0 input gate
  // for every agent that never heard of it, and nothing downstream would say so.
  const { client, calls } = recorder();
  await tool('pof_asset_generate').handler({ mode: 'text-to-3d', prompt: 'a stone crate' }, client);
  const body = calls[0].body as Record<string, unknown>;
  assert.equal('gateInput' in body, false, 'sent gateInput without being asked to');
  assert.equal('overrideInputGate' in body, false);
  assert.equal(body.mode, 'text-to-3d');
  assert.equal(body.prompt, 'a stone crate');
});

test('pof_asset_generate forwards an explicit false, which is the whole point of the flag', async () => {
  const { client, calls } = recorder();
  await tool('pof_asset_generate').handler({ mode: 'image-to-3d', gateInput: false }, client);
  assert.equal((calls[0].body as Record<string, unknown>).gateInput, false);
});

test('pof_asset_generate refuses a call with no mode instead of guessing one', async () => {
  const { client } = recorder();
  await assert.rejects(() => tool('pof_asset_generate').handler({ prompt: 'a crate' }, client), /mode/);
});

test('pof_asset_view_gate asks the conformance question only when given a reference', async () => {
  const { client, calls } = recorder();
  await tool('pof_asset_view_gate').handler({ meshPath: '/gen/crate.glb' }, client);
  assert.equal('referencePath' in (calls[0].body as Record<string, unknown>), false);

  await tool('pof_asset_view_gate').handler(
    { meshPath: '/gen/crate.glb', referencePath: '/ref/crate.png', subject: 'a crate' },
    client,
  );
  const body = calls[1].body as Record<string, unknown>;
  assert.equal(body.referencePath, '/ref/crate.png');
  assert.equal(body.subject, 'a crate');
});

test('pof_asset_icon requires the identity an icon is matched on', async () => {
  const { client } = recorder();
  // catalogId + step ARE the filename every consumer re-encodes to find the art. A call
  // missing either would write a file nothing can ever match — the `_unaddressable/` bug.
  await assert.rejects(
    () => tool('pof_asset_icon').handler({ meshPath: '/gen/crate.glb', step: 'Item icon' }, client),
    /catalogId/,
  );
  await assert.rejects(
    () => tool('pof_asset_icon').handler({ meshPath: '/gen/crate.glb', catalogId: 'loot' }, client),
    /step/,
  );
});

test('pof_asset_icon forwards the entity dimension only when there is one', async () => {
  const { client, calls } = recorder();
  await tool('pof_asset_icon').handler({ meshPath: '/m.glb', catalogId: 'loot', step: 'Item icon' }, client);
  assert.equal('entityId' in (calls[0].body as Record<string, unknown>), false);

  await tool('pof_asset_icon').handler(
    { meshPath: '/m.glb', catalogId: 'loot', step: 'Item icon', entityId: 'crate' },
    client,
  );
  assert.equal((calls[1].body as Record<string, unknown>).entityId, 'crate');
});

test('the status tools are GETs carrying the job id', async () => {
  const { client, calls } = recorder();
  await tool('pof_asset_generate_status').handler({ jobId: 'job-1' }, client);
  await tool('pof_asset_view_gate_status').handler({ jobId: 'job-2' }, client);
  assert.equal(calls[0].method, 'GET');
  assert.match(calls[0].path, /jobId=job-1/);
  assert.match(calls[1].path, /view-gate\/status\?jobId=job-2/);
});

test('every job-starting tool has a status tool to read it back', () => {
  // A tool that returns a jobId and no way to poll it teaches an agent that the 202 was
  // the result.
  for (const starter of ['pof_asset_generate', 'pof_asset_view_gate']) {
    assert.ok(
      ASSET_TOOLS.some((t) => t.name === `${starter}_status`),
      `${starter} returns a job with no status tool`,
    );
  }
});
