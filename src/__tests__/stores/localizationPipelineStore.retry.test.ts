/**
 * When the defaults GET fails, the view shows the error with a Retry that calls
 * runFullPipeline. With no config loaded that action returned at once — no
 * request, error banner unchanged — so Retry was a dead button. It now loads the
 * defaults first and runs the pipeline on them.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useLocalizationPipelineStore } from '@/stores/localizationPipelineStore';

type Reply = { status?: number; body: unknown };
/** fetch stub keyed by HTTP method (the store GETs defaults and POSTs runs on one URL). */
function mockByMethod(replies: { GET?: Reply; POST?: Reply }) {
  const mock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
    const r = replies[(init?.method ?? 'GET') as 'GET' | 'POST'];
    const status = r?.status ?? (r ? 200 : 404);
    const body = r?.body ?? { success: false, error: 'Not found' };
    return Promise.resolve({ ok: status < 300, status, json: () => Promise.resolve(body) });
  });
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

const CONFIG = { targetLocales: ['de'], sourceLocale: 'en' };

beforeEach(() => {
  useLocalizationPipelineStore.setState({ config: null, error: 'defaults failed', isLoading: false, scanResult: null });
});

describe('localizationPipelineStore — Retry after a failed defaults load', () => {
  it('loads the defaults, then runs the full pipeline', async () => {
    const fetchMock = mockByMethod({
      GET: { body: { success: true, data: { config: CONFIG, supportedLocales: [] } } },
      POST: {
          body: {
            success: true,
            data: {
              scan: { strings: [], hazards: [], moduleBreakdown: {} },
              provenance: { kind: 'demo' },
              replacements: [],
              tables: [],
              translation: { entries: [], reviewRequired: [], expansionIssues: {} },
              progress: {},
              qa: { findings: [], byLocale: {} },
            },
          },
      },
    });

    await useLocalizationPipelineStore.getState().runFullPipeline();

    const s = useLocalizationPipelineStore.getState();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(s.config).toEqual(CONFIG);
    expect(s.scanResult).not.toBeNull();
    expect(s.error).toBeNull();
  });

  it('keeps the error and runs nothing when the defaults still fail', async () => {
    const fetchMock = mockByMethod({ GET: { status: 500, body: { success: false, error: 'still down' } } });

    await useLocalizationPipelineStore.getState().runFullPipeline();

    const s = useLocalizationPipelineStore.getState();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(s.error).toBe('still down');
    expect(s.isLoading).toBe(false);
  });
});
