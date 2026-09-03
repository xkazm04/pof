import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TOOLS,
  EDITOR_ONLY_TOOLS,
  TOPOLOGY_ENV,
  advertisedTools,
  toolVisibility,
  resolveSessionTopology,
} from './tools/index.js';
import { connectMcp } from './harness.js';

/** The env every session-sourced test runs with: the spawn markers explicitly absent. */
const NO_MARKERS = { [TOPOLOGY_ENV]: '', HARNESS_MODE: '', CI: '' };
const EDITOR_TOOL = EDITOR_ONLY_TOOLS[0];
const has = (ts: { name: string }[], n: string) => ts.some((t) => t.name === n);

test('the editor-only list names real tools that really need a live editor', () => {
  for (const name of EDITOR_ONLY_TOOLS) {
    const tool = TOOLS.find((t) => t.name === name);
    assert.ok(tool, `${name} is not a registered tool`);
    assert.match(tool!.description, /live editor/i, `${name}: not documented as needing a live editor`);
  }
});

// THE regression. A test that SETS the marker and asserts the tool is present passes under
// the env-derived design too and discriminates nothing. This one fails loudly the day
// someone reintroduces the environment read.
test('an editor-topology session gets the editor-only tool with the env var absent', () => {
  const session = resolveSessionTopology({ name: 'pof-editor', topology: 'editor' }, NO_MARKERS);
  assert.equal(session.topology, 'editor');
  assert.equal(session.source, 'session-declared');
  assert.ok(has(advertisedTools(undefined, session), EDITOR_TOOL));
  assert.equal(toolVisibility(EDITOR_TOOL, undefined, session).visible, true);
});

test('a headless session does not get an editor-only tool', () => {
  const session = resolveSessionTopology({ name: 'unrealeditor-cmd' }, NO_MARKERS);
  assert.equal(session.topology, 'headless');
  assert.equal(session.source, 'session-name');
  const advertised = advertisedTools(undefined, session);
  assert.ok(!has(advertised, EDITOR_TOOL), `${EDITOR_TOOL} must not be advertised to a headless session`);
  assert.equal(advertised.length, TOOLS.length - EDITOR_ONLY_TOOLS.length);
  // One policy, two enforcement points: what the list withheld, the executor refuses.
  assert.equal(toolVisibility(EDITOR_TOOL, undefined, session).visible, false);
  // ...and it keeps the editor-less UE tools, which are disk reads, not bridge calls.
  assert.ok(has(advertised, 'pof_ue_scan_project'));
});

test('the session wins over the env; the env is consulted only when the session is silent', () => {
  // A live editor connecting to a backend the CI runner spawned: env says headless, the
  // session says editor, and the session is the one that knows.
  const overridden = resolveSessionTopology({ name: 'pof-editor' }, { CI: 'true' });
  assert.equal(overridden.topology, 'editor');
  assert.equal(overridden.source, 'session-name');
  const fallback = resolveSessionTopology(undefined, { CI: 'true' });
  assert.deepEqual([fallback.topology, fallback.source], ['headless', 'env']);
  const explicit = resolveSessionTopology({}, { [TOPOLOGY_ENV]: 'web' });
  assert.deepEqual([explicit.topology, explicit.source], ['web', 'env']);
});

test('unknown is not a value — a silent session with no markers keeps the whole surface', () => {
  const session = resolveSessionTopology(undefined, NO_MARKERS);
  assert.deepEqual([session.topology, session.source], ['unknown', 'unknown']);
  assert.equal(advertisedTools(undefined, session).length, TOOLS.length);
  assert.equal(toolVisibility(EDITOR_TOOL, undefined, session).visible, true);
  // A junk declaration is silence, not a topology.
  assert.equal(resolveSessionTopology({ topology: 'ide' }, NO_MARKERS).topology, 'unknown');
});

test('over stdio: the editor session lists the editor tool with the env var absent', async () => {
  const mcp = await connectMcp(NO_MARKERS, { name: 'pof-editor', topology: 'editor' });
  try {
    assert.ok(has(await mcp.listTools(), EDITOR_TOOL), `${EDITOR_TOOL} missing from an editor session`);
  } finally {
    await mcp.close();
  }
});

test('over stdio: the headless session neither lists nor may call the editor tool', async () => {
  const mcp = await connectMcp(NO_MARKERS, { name: 'pof-headless-engine', topology: 'headless' });
  try {
    const listed = await mcp.listTools();
    assert.ok(!has(listed, EDITOR_TOOL), `${EDITOR_TOOL} must not be advertised headlessly`);
    assert.equal(listed.length, TOOLS.length - EDITOR_ONLY_TOOLS.length);
    const res = await mcp.call(EDITOR_TOOL, {});
    assert.equal(res.isError, true, 'a tool withheld from the list must not execute');
    assert.match(res.text, /live UE editor/);
    assert.match(res.text, /"headless"/);
  } finally {
    await mcp.close();
  }
});
