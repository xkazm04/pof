import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { TOOLS } from './tools/index.js';
import { connectMcp, backendReachable, ORIGIN, type McpHandle } from './harness.js';

/**
 * Layer 1 — contract. Every tool that ships a static `example` is invoked through the real
 * MCP server against the running backend; we assert it returns without error and yields a
 * structured payload. These are the documented, doc-backing examples (Goal 1) and they also
 * prove each route works end-to-end through the adapter. Skips cleanly if the backend is down.
 */
const UP = await backendReachable();
const skip = UP ? false : `PoF backend not reachable at ${ORIGIN} — start the dev server (npm run dev)`;

let mcp: McpHandle;
before(async () => {
  mcp = await connectMcp();
});
after(async () => {
  await mcp?.close();
});

for (const tool of TOOLS.filter((t) => t.example)) {
  test(`contract: ${tool.name}`, { skip }, async () => {
    const res = await mcp.call(tool.name, tool.example!.args);
    assert.equal(res.isError, false, `${tool.name} errored: ${res.text.slice(0, 300)}`);
    assert.notEqual(res.json, undefined, `${tool.name}: response was not JSON: ${res.text.slice(0, 200)}`);
    assert.ok(
      typeof res.json === 'object' || Array.isArray(res.json),
      `${tool.name}: expected an object/array payload`,
    );
  });
}
