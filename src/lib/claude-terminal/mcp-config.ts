/**
 * Resolves the `--mcp-config` CLI args for AUTONOMOUS Claude Code spawns
 * (the one-shot orchestrator, feature-matrix batch review, and the harness).
 *
 * Gate + source are a single env var, POF_CLI_MCP_CONFIG: an absolute path to an
 * MCP config JSON (e.g. the repo `.mcp.json`, which declares pof-mcp + the official
 * UE 5.8 MCP `unreal-official` at :8000). The bespoke `mcp-unreal` (Go/:8090) was
 * retired 2026-06-19 — see docs/concepts/UE/mcp-bakeoff-verdict.md. This resolver is
 * config-agnostic: it just passes whatever config the env var points at.
 *   - unset           → [] (feature OFF — the default; spawn args are unchanged)
 *   - set, missing    → [] (+ a warning; never break a spawn over a bad path)
 *   - set, exists     → ['--mcp-config', <path>, '--strict-mcp-config']
 *
 * `--strict-mcp-config` makes the spawned session load ONLY those servers,
 * ignoring ambient project/user MCP configs — deterministic, no surprise servers.
 *
 * The interactive terminal does NOT call this (it never opts in via `enableMcp`).
 */
import * as fs from 'fs';
import { logger } from '@/lib/logger';

export const MCP_CONFIG_ENV = 'POF_CLI_MCP_CONFIG';

export function resolveAutonomousMcpArgs(): string[] {
  const configPath = process.env[MCP_CONFIG_ENV];
  if (!configPath) return [];
  if (!fs.existsSync(configPath)) {
    logger.warn(`[cli-mcp] ${MCP_CONFIG_ENV}="${configPath}" but no such file — spawning without --mcp-config`);
    return [];
  }
  return ['--mcp-config', configPath, '--strict-mcp-config'];
}
