/**
 * Test harness: connect an MCP SDK Client to a freshly-spawned pof-mcp server over stdio,
 * and detect whether the PoF backend is reachable (so integration tests skip cleanly when
 * it isn't). Not a test file itself — imported by the *.test.ts / *.itest.ts suites.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
/** dist/index.js sits next to dist/harness.js (flat dist output). */
export const SERVER_ENTRY = join(here, 'index.js');

export const ORIGIN = (process.env.POF_APP_ORIGIN || 'http://127.0.0.1:3001').replace(/\/$/, '');

/** Best-effort: is the PoF backend serving the catalog API? */
export async function backendReachable(timeoutMs = 2500): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${ORIGIN}/api/catalog/pipelines`, { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

export interface ToolCallResult {
  isError: boolean;
  text: string;
  json: any;
}

export interface McpHandle {
  call(name: string, args?: Record<string, unknown>): Promise<ToolCallResult>;
  listTools(): Promise<Array<{ name: string; description?: string; inputSchema: any }>>;
  close(): Promise<void>;
}

/** Spawn the built server and return a connected client. POF_APP_ORIGIN is threaded through. */
export async function connectMcp(env: Record<string, string | undefined> = {}): Promise<McpHandle> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER_ENTRY],
    env: { ...process.env, POF_APP_ORIGIN: ORIGIN, ...env } as Record<string, string>,
    stderr: 'ignore',
  });
  const client = new Client({ name: 'pof-mcp-test', version: '0.1.0' }, { capabilities: {} });
  await client.connect(transport);

  return {
    async call(name, args = {}) {
      const res: any = await client.callTool({ name, arguments: args });
      const text: string = res?.content?.[0]?.text ?? '';
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        json = undefined;
      }
      return { isError: res?.isError === true, text, json };
    },
    async listTools() {
      const res: any = await client.listTools();
      return res.tools;
    },
    async close() {
      await client.close();
    },
  };
}
