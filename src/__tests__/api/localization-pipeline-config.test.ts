/**
 * POST /api/localization-pipeline — the `config` body field.
 *
 * The route used `(body.config as LocalizationConfig) ?? DEFAULT_CONFIG`: a PARTIAL config
 * (`{}` or `{ rootNamespace }`) replaced the whole default, so the translate stages
 * iterated an undefined `targetLocales` and answered 500 ("targetLocales is not iterable"),
 * and a wrongly-typed field (`targetLocales: "de"`) crashed the same way. Now absent keys
 * take their default, and a present key of the wrong type is the caller's error — a 400
 * naming the field.
 */
import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/localization-pipeline/route';
import { DEFAULT_CONFIG } from '@/lib/localization/definitions';

const post = (body: unknown) =>
  POST(new NextRequest('http://localhost/api/localization-pipeline', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));

describe('localization-pipeline config', () => {
  it.each(['translate', 'validate', 'full-pipeline'])('fills a partial config from the defaults (%s)', async (action) => {
    const res = await post({ action, config: { rootNamespace: 'MyGame' } });
    expect(res.status).toBe(200);
  });

  it('applies the fields a partial config does name', async () => {
    const res = await post({ action: 'translate', config: { targetLocales: ['de'] } });
    expect(res.status).toBe(200);
    const json = await res.json();
    const locales = new Set(json.data.translation.entries.map((e: { locale: string }) => e.locale));
    expect([...locales]).toEqual(['de']);
  });

  it.each([
    ['targetLocales', 'de'],
    ['targetLocales', [1, 2]],
    ['scanModules', 'arpg-combat'],
    ['glossary', 5],
    ['rootNamespace', 7],
    ['autoApplyThreshold', 'high'],
  ])('refuses a wrongly-typed %s with 400 naming it', async (key, value) => {
    const res = await post({ action: 'full-pipeline', config: { [key]: value } });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain(key);
  });

  it('refuses a non-object config with 400', async () => {
    const res = await post({ action: 'scan', config: 'all' });
    expect(res.status).toBe(400);
  });

  it('keeps the default when config is absent or null', async () => {
    for (const config of [undefined, null]) {
      const res = await post({ action: 'translate', config });
      expect(res.status).toBe(200);
      const json = await res.json();
      const locales = new Set(json.data.translation.entries.map((e: { locale: string }) => e.locale));
      expect(locales.size).toBeLessThanOrEqual(DEFAULT_CONFIG.targetLocales.length);
    }
  });
});
