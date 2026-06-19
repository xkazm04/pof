import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolveAutonomousMcpArgs } from '@/lib/claude-terminal/mcp-config';

const ENV_KEY = 'POF_CLI_MCP_CONFIG';

describe('resolveAutonomousMcpArgs', () => {
  let original: string | undefined;
  const tempFiles: string[] = [];

  beforeEach(() => {
    original = process.env[ENV_KEY];
    delete process.env[ENV_KEY];
  });

  afterEach(() => {
    if (original === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = original;
    for (const f of tempFiles.splice(0)) {
      try { fs.unlinkSync(f); } catch { /* ignore */ }
    }
    vi.restoreAllMocks();
  });

  it('returns [] when POF_CLI_MCP_CONFIG is unset (default off)', () => {
    expect(resolveAutonomousMcpArgs()).toEqual([]);
  });

  it('returns [] (and warns) when the env var points at a missing file', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env[ENV_KEY] = path.join(os.tmpdir(), `pof-missing-${process.pid}-nope.json`);
    expect(resolveAutonomousMcpArgs()).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it('returns --mcp-config + --strict-mcp-config when the file exists', () => {
    const file = path.join(os.tmpdir(), `pof-mcp-${process.pid}-${Date.now()}.json`);
    fs.writeFileSync(file, '{"mcpServers":{}}');
    tempFiles.push(file);
    process.env[ENV_KEY] = file;
    expect(resolveAutonomousMcpArgs()).toEqual(['--mcp-config', file, '--strict-mcp-config']);
  });
});
