import { afterEach, describe, expect, it, vi } from 'vitest';

// Own throwaway DB, like audio-gen-route.test.ts.
vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-vitest/audio-gen-not-configured-${process.pid}/pof.db`;
});

const generate = vi.hoisted(() => vi.fn());
vi.mock('@/lib/audio-gen/registry', () => ({
  getAudioProvider: (id: string) =>
    id === 'stub'
      ? { id: 'stub', label: 'Stub', capabilities: ['sfx'], commercial: 'yes', generate }
      : undefined,
}));

import { NextRequest } from 'next/server';
import { cleanup } from '@testing-library/react';
import { POST } from '@/app/api/audio-gen/route';
import { ProviderNotConfiguredError } from '@/lib/audio-gen/errors';

afterEach(() => { cleanup(); generate.mockReset(); });

function post(prompt: string): NextRequest {
  return new NextRequest('http://localhost/api/audio-gen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'stub', kind: 'sfx', prompt: `${prompt} ${Date.now()}-${Math.random()}`, setName: 'nc' }),
  });
}

/**
 * The 503-vs-502 split used to be `msg.includes('ELEVENLABS_API_KEY')`: a reworded provider
 * message flipped "not configured" into "provider failed", and an upstream message that
 * merely mentioned the env var became a 503. It now keys on a typed error.
 */
describe('POST /api/audio-gen provider failure classification', () => {
  it('503 for a typed not-configured error whose message names no env var', async () => {
    generate.mockRejectedValue(new ProviderNotConfiguredError('ElevenLabs key missing'));
    const res = await POST(post('a'));
    expect(res.status).toBe(503);
  });

  it('502 for a plain upstream error that merely mentions the env var', async () => {
    generate.mockRejectedValue(new Error('upstream 401: check ELEVENLABS_API_KEY'));
    const res = await POST(post('b'));
    expect(res.status).toBe(502);
  });
});
