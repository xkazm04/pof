#!/usr/bin/env node
/**
 * pof-mcp — a stdio MCP server that exposes PoF's catalog pipelines + autonomous
 * harness so the Claude Code CLI can drive UE5 game-dev tasks headlessly.
 *
 * It is a THIN adapter over the running PoF Next.js backend (POF_APP_ORIGIN); the
 * backend + its shared SQLite + harness orchestrator remain the source of truth.
 * Raw Unreal ops stay with the separate `mcp-unreal` server.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createPofClient, PofApiError, originFromEnv } from './pofClient.js';
import { TOOLS } from './tools/index.js';

const pof = createPofClient();

const server = new Server({ name: 'pof-mcp', version: '0.1.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = TOOLS.find((t) => t.name === req.params.name);
  if (!tool) {
    return { content: [{ type: 'text', text: `Unknown tool: ${req.params.name}` }], isError: true };
  }
  try {
    const args = (req.params.arguments ?? {}) as Record<string, unknown>;
    const result = await tool.handler(args, pof);
    const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
    return { content: [{ type: 'text', text }] };
  } catch (e) {
    const msg = e instanceof PofApiError || e instanceof Error ? e.message : String(e);
    return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
  }
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdout is the JSON-RPC channel — only ever log to stderr.
  console.error(`pof-mcp connected · backend ${originFromEnv()} · ${TOOLS.length} tools`);
}

main().catch((e) => {
  console.error('pof-mcp fatal:', e);
  process.exit(1);
});
