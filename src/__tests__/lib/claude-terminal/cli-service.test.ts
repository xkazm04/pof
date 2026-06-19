import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { buildCliArgs } from '@/lib/claude-terminal/cli-service';

const BASE = ['-p', '-', '--output-format', 'stream-json', '--verbose', '--dangerously-skip-permissions'];
const ENV_KEY = 'POF_CLI_MCP_CONFIG';

describe('buildCliArgs', () => {
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
  });

  it('returns exactly the base args with no opts (off-state unchanged)', () => {
    expect(buildCliArgs()).toEqual(BASE);
  });

  it('appends --resume when a resumeSessionId is given', () => {
    expect(buildCliArgs({ resumeSessionId: 'abc123' })).toEqual([...BASE, '--resume', 'abc123']);
  });

  it('does NOT add MCP args when enableMcp is false, even if the env var is set', () => {
    const file = path.join(os.tmpdir(), `pof-cli-${process.pid}-${Date.now()}.json`);
    fs.writeFileSync(file, '{"mcpServers":{}}');
    tempFiles.push(file);
    process.env[ENV_KEY] = file;
    expect(buildCliArgs({ enableMcp: false })).toEqual(BASE);
  });

  it('appends MCP args when enableMcp is true and the env var points at a file', () => {
    const file = path.join(os.tmpdir(), `pof-cli-${process.pid}-${Date.now()}-on.json`);
    fs.writeFileSync(file, '{"mcpServers":{}}');
    tempFiles.push(file);
    process.env[ENV_KEY] = file;
    expect(buildCliArgs({ enableMcp: true })).toEqual([...BASE, '--mcp-config', file, '--strict-mcp-config']);
  });

  it('omits MCP args when enableMcp is true but the env var is unset (default off)', () => {
    expect(buildCliArgs({ enableMcp: true })).toEqual(BASE);
  });
});
