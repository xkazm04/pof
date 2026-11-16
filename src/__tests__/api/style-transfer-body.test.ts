import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/style-transfer/route';

const raw = (body: string) => POST(new NextRequest('http://localhost/api/style-transfer', { method: 'POST', body }));

describe('POST /api/style-transfer input', () => {
  it.each(['{nope', 'null', '[1]'])('answers 400 for %s', async (body) => {
    expect((await raw(body)).status).toBe(400);
  });

  it.each(['5', '{"a":1}', '["rusty"]'])('refuses description %s', async (value) => {
    expect((await raw(`{"action":"analyze","description":${value}}`)).status).toBe(400);
  });

  it('still analyzes a description, and an absent one', async () => {
    expect((await raw('{"action":"analyze","description":"rusty metal"}')).status).toBe(200);
    expect((await raw('{"action":"analyze"}')).status).toBe(200);
  });
});
