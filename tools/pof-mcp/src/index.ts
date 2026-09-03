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
import {
  TOOLS, advertisedTools, toolVisibility, GROUPS_ENV,
  resolveSessionTopology, topologyHolds, type SessionSource,
} from './tools/index.js';

const pof = createPofClient();

const server = new Server({ name: 'pof-mcp', version: '0.1.0' }, { capabilities: { tools: {} } });

/**
 * Which client is on the other end, resolved from THIS session's `initialize` handshake
 * every time it is asked — never memoised into a module-level slot. One process can serve
 * more than one session, and a per-session answer cached process-wide is right for at most
 * one of them. The env is consulted only inside the resolver, and only as a fallback.
 */
const sessionTopology = () => resolveSessionTopology(server.getClientVersion() as SessionSource | undefined);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  // Groups gate WHICH tools are advertised; annotations describe the blast radius of each
  // one that is. Both survive: a host tiers consent per tool (tools/shared.ts) over the
  // surface an operator left enabled (tools/groups.ts).
  tools: advertisedTools(undefined, sessionTopology()).map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
    annotations: t.annotations,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const session = sessionTopology();
  const vis = toolVisibility(req.params.name, undefined, session);
  if (!vis.known) {
    return { content: [{ type: 'text', text: `Unknown tool: ${req.params.name}` }], isError: true };
  }
  if (vis.known && !topologyHolds(session.topology, req.params.name)) {
    return {
      content: [{
        type: 'text',
        text: `Tool "${req.params.name}" needs a live UE editor on the other end of this connection, and this session declared topology "${session.topology}" (${session.note}). It was never advertised this session. Reconnect from an editor session, or use the disk-based UE tools (pof_ue_scan_project, pof_ue_source_parse) which need no editor.`,
      }],
      isError: true,
    };
  }
  if (!vis.visible) {
    // Refused, not silently run: the advertised list must stay the truth about what is callable.
    return {
      content: [{
        type: 'text',
        text: `Tool "${req.params.name}" is in the "${vis.group}" group, which is not enabled this session (${GROUPS_ENV}). Call pof_tool_groups to see every group and what it holds; enabling it needs a change to this server's MCP client config and a reconnect.`,
      }],
      isError: true,
    };
  }
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
  // The roster is only knowable once the client has said who it is, so report it then —
  // naming the SOURCE that decided, so a surprising tool count is traceable to the
  // handshake, the env fallback, or neither.
  server.oninitialized = () => {
    const session = sessionTopology();
    const shown = advertisedTools(undefined, session).length;
    const trim = shown < TOOLS.length ? ` (${TOOLS.length - shown} hidden by topology/${GROUPS_ENV})` : '';
    // stdout is the JSON-RPC channel — only ever log to stderr.
    console.error(
      `pof-mcp connected · backend ${originFromEnv()} · topology ${session.topology} ` +
      `[source: ${session.source} — ${session.note}] · ${shown} tools${trim}`,
    );
  };
  await server.connect(transport);
}

main().catch((e) => {
  console.error('pof-mcp fatal:', e);
  process.exit(1);
});
