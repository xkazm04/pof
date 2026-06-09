import { describe, it, expect } from 'vitest';
import {
  classifyConnectionError,
  nextRetryDelay,
  BLENDER_ADDON_REPO_URL,
  BLENDER_RETRY_MAX_ATTEMPTS,
} from '@/lib/blender-mcp/diagnostics';
import { DEFAULT_BLENDER_PORT } from '@/lib/blender-mcp/types';

const DEFAULT_CTX = { host: 'localhost', port: DEFAULT_BLENDER_PORT };

describe('classifyConnectionError — failure modes', () => {
  it('classifies a refused connection on the default port as Blender-not-running', () => {
    const d = classifyConnectionError(
      'Connection failed: connect ECONNREFUSED 127.0.0.1:9876',
      DEFAULT_CTX,
    );
    expect(d.mode).toBe('not-running');
    expect(d.title).toMatch(/not running|not started|isn't running/i);
    expect(d.steps.length).toBeGreaterThan(0);
  });

  it('classifies a refused connection on a non-default port as a wrong-port mismatch', () => {
    const d = classifyConnectionError(
      'Connection failed: connect ECONNREFUSED 127.0.0.1:5000',
      { host: 'localhost', port: 5000 },
    );
    expect(d.mode).toBe('wrong-port');
    expect(d.summary).toMatch(/port/i);
    // Mentions the default port so the user knows the canonical value
    expect(d.steps.join(' ')).toContain(String(DEFAULT_BLENDER_PORT));
  });

  it('classifies a connected-but-unresponsive socket as addon-not-installed', () => {
    const d = classifyConnectionError(
      'Connected but addon not responding: Command timed out',
      DEFAULT_CTX,
    );
    expect(d.mode).toBe('addon-not-installed');
    expect(d.addonInstallUrl).toBe(BLENDER_ADDON_REPO_URL);
    expect(d.steps.join(' ')).toMatch(/addon|add-on/i);
  });

  it('classifies a timeout error as timeout', () => {
    const d = classifyConnectionError(
      'Connection to localhost:9876 timed out',
      DEFAULT_CTX,
    );
    expect(d.mode).toBe('timeout');
    expect(d.steps.join(' ')).toMatch(/firewall|host|running/i);
  });

  it('classifies DNS / host resolution failures as unreachable-host', () => {
    const d = classifyConnectionError(
      'Connection failed: getaddrinfo ENOTFOUND not-a-real-host',
      { host: 'not-a-real-host', port: DEFAULT_BLENDER_PORT },
    );
    expect(d.mode).toBe('unreachable-host');
    expect(d.steps.join(' ')).toMatch(/host/i);
  });

  it('falls back to unknown for an unrecognized error and still gives actionable steps', () => {
    const d = classifyConnectionError('Something exploded', DEFAULT_CTX);
    expect(d.mode).toBe('unknown');
    expect(d.steps.length).toBeGreaterThan(0);
    expect(d.summary).toContain('Something exploded');
  });

  it('returns a generic disconnected diagnosis when there is no error string', () => {
    const d = classifyConnectionError(null, DEFAULT_CTX);
    expect(d.mode).toBe('unknown');
    expect(d.steps.length).toBeGreaterThan(0);
  });

  it('always exposes the addon repo link for not-running and wrong-port modes', () => {
    const notRunning = classifyConnectionError(
      'Connection failed: connect ECONNREFUSED 127.0.0.1:9876',
      DEFAULT_CTX,
    );
    const wrongPort = classifyConnectionError(
      'Connection failed: connect ECONNREFUSED 127.0.0.1:5000',
      { host: 'localhost', port: 5000 },
    );
    expect(notRunning.addonInstallUrl).toBe(BLENDER_ADDON_REPO_URL);
    expect(wrongPort.addonInstallUrl).toBe(BLENDER_ADDON_REPO_URL);
  });
});

describe('nextRetryDelay — exponential backoff', () => {
  it('starts at the base delay on the first attempt', () => {
    expect(nextRetryDelay(0, 2000, 30000)).toBe(2000);
  });

  it('doubles each attempt', () => {
    expect(nextRetryDelay(1, 2000, 30000)).toBe(4000);
    expect(nextRetryDelay(2, 2000, 30000)).toBe(8000);
    expect(nextRetryDelay(3, 2000, 30000)).toBe(16000);
  });

  it('caps at the maximum delay', () => {
    expect(nextRetryDelay(10, 2000, 30000)).toBe(30000);
  });

  it('exposes a sane max-attempt ceiling', () => {
    expect(BLENDER_RETRY_MAX_ATTEMPTS).toBeGreaterThanOrEqual(3);
  });
});
