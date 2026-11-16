/**
 * Every error string the bridge service itself produces must get a named diagnosis, not the
 * generic "Unexpected error" checklist. `source` is a fragment that must still appear in
 * service.ts, so the table cannot drift away from the strings the service really emits.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { classifyConnectionError, type ConnectionFailureMode } from '@/lib/blender-mcp/diagnostics';
import { DEFAULT_BLENDER_PORT } from '@/lib/blender-mcp/types';

const CTX = { host: 'localhost', port: DEFAULT_BLENDER_PORT };

const SERVICE_ERRORS: { source: string; error: string; mode: ConnectionFailureMode }[] = [
  { source: 'timed out`', error: 'Connection to localhost:9876 timed out', mode: 'timeout' },
  { source: 'Connected but addon not responding', error: 'Connected but addon not responding: x', mode: 'addon-not-installed' },
  { source: 'Connection failed: ', error: 'Connection failed: connect ECONNREFUSED 127.0.0.1:9876', mode: 'not-running' },
  { source: 'Connection was reset while this command was queued', error: 'Connection was reset while this command was queued — retry', mode: 'connection-lost' },
  { source: 'Not connected to Blender', error: 'Not connected to Blender', mode: 'not-connected' },
  { source: 'Command timed out', error: 'Command timed out — connection reset to avoid response desync; reconnect to continue', mode: 'timeout' },
  { source: 'Connection closed while command was in flight', error: 'Connection closed while command was in flight', mode: 'connection-lost' },
  { source: 'Socket error: ', error: 'Socket error: read ECONNRESET', mode: 'connection-lost' },
  { source: 'Response exceeded', error: 'Response exceeded 8388608 bytes without a complete value — connection reset to avoid a wedged buffer; reconnect to continue', mode: 'oversized-response' },
  { source: 'Write failed: ', error: 'Write failed: EPIPE', mode: 'connection-lost' },
];

describe('classifyConnectionError over the service error strings', () => {
  const service = readFileSync(path.resolve(process.cwd(), 'src/lib/blender-mcp/service.ts'), 'utf8');

  for (const row of SERVICE_ERRORS) {
    it(`names "${row.source}" as ${row.mode}`, () => {
      expect(service).toContain(row.source);
      const d = classifyConnectionError(row.error, CTX);
      expect(d.mode).toBe(row.mode);
      expect(d.steps.length).toBeGreaterThan(0);
    });
  }

  it('leaves no service-produced string classified unknown', () => {
    const unknown = SERVICE_ERRORS.filter((r) => classifyConnectionError(r.error, CTX).mode === 'unknown');
    expect(unknown.map((r) => r.source)).toEqual([]);
  });

  it('still reports a genuinely unknown error as unknown', () => {
    expect(classifyConnectionError('Something exploded', CTX).mode).toBe('unknown');
  });
});
