import { describe, it, expect, afterEach } from 'vitest';
import { createElement } from 'react';
import { render, cleanup } from '@testing-library/react';
import '@/lib/catalog/pipelines/registry.generated';
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import { swimlaneCtxFromReads, readNotices, assembleLanes, stepsFor } from '@/lib/status/statusReads';
import { sortLanes, judgedContentOfRow } from '@/lib/status/statusModel';
import { craftForCell, type CraftVerdictView } from '@/lib/craft/craftCell';
import { ReadNotices } from '@/components/status/MiniSwimlane';
import type { CatalogArtifacts } from '@/components/status/statusArtifactSource';
import type { StatusVerdictRead } from '@/components/status/statusVerdictSource';

afterEach(cleanup);

const [A, B, C] = allCatalogPipelines().map((p) => p.catalogId);
const ok = (catalogId: string): CatalogArtifacts => ({ catalogId, rows: [], loaded: true, error: null });
const bad = (catalogId: string, error: string): CatalogArtifacts => ({ catalogId, rows: [], loaded: false, error });
const verdictsOk: StatusVerdictRead = { ok: true, all: [], byCatalog: new Map() };
const isUnknown = (r: unknown, error: string) =>
  !Array.isArray(r) && (r as { unknown?: boolean }).unknown === true && (r as { error: string }).error === error;

describe('swimlaneCtxFromReads', () => {
  it('is UNKNOWN (not []) while catalogs have not settled', () => {
    const ctx = swimlaneCtxFromReads({ catalogs: null, verdicts: verdictsOk });
    expect(isUnknown(ctx.artifactsFor(A), 'evidence still loading')).toBe(true);
  });

  it('is UNKNOWN while verdicts have not settled, even with catalogs loaded', () => {
    const ctx = swimlaneCtxFromReads({ catalogs: [ok(A)], verdicts: null });
    expect(isUnknown(ctx.artifactsFor(A), 'evidence still loading')).toBe(true);
  });

  it("a catalog absent from the read set is 'not read'; a failed one carries its error, never []", () => {
    const ctx = swimlaneCtxFromReads({ catalogs: [ok(A), bad(B, 'HTTP 500')], verdicts: verdictsOk });
    expect(isUnknown(ctx.artifactsFor(C), 'not read')).toBe(true);
    expect(isUnknown(ctx.artifactsFor(B), 'HTTP 500')).toBe(true);
    expect(ctx.artifactsFor(A)).toEqual([]);
  });

  it('a failed verdict read makes verdictsFor UNKNOWN while artifacts still return their rows', () => {
    const ctx = swimlaneCtxFromReads({ catalogs: [ok(A)], verdicts: { ok: false, error: 'x' } });
    expect(isUnknown(ctx.verdictsFor(A), 'x')).toBe(true);
    expect(Array.isArray(ctx.artifactsFor(A))).toBe(true);
  });

  it('stepsFor lists the registered steps', () => {
    expect(stepsFor(A).length).toBeGreaterThan(0);
    expect(stepsFor('no-such-catalog')).toEqual([]);
  });
});

describe('readNotices', () => {
  it('lists failed catalogs in read order, then the verdict failure', () => {
    const n = readNotices({
      catalogs: [ok(A), bad(B, 'E1'), bad(C, 'E2')],
      verdicts: { ok: false, error: 'V' },
    });
    expect(n).toEqual([
      { kind: 'artifacts', subject: B, error: 'E1' },
      { kind: 'artifacts', subject: C, error: 'E2' },
      { kind: 'verdicts', error: 'V' },
    ]);
  });

  it('is empty when fully loaded and while still loading', () => {
    expect(readNotices({ catalogs: [ok(A)], verdicts: verdictsOk })).toEqual([]);
    expect(readNotices({ catalogs: null, verdicts: null })).toEqual([]);
  });
});

describe('assembleLanes', () => {
  it('holds a failed catalog out of lanes and reports it unknown; lanes are sortLanes order', () => {
    const r = assembleLanes({ catalogs: [ok(A), bad(B, 'E'), ok(C)], byCatalog: new Map(), craftByCatalog: null });
    expect(r.unknown).toEqual([{ catalogId: B, error: 'E' }]);
    expect(r.lanes.map((l) => l.catalogId)).not.toContain(B);
    expect(r.lanes.map((l) => l.catalogId)).toEqual(sortLanes([...r.lanes]).map((l) => l.catalogId));
    expect(r.lanes.length).toBe(2);
  });

  it('craft is null (absent, never A0) when the craft read is null', () => {
    expect(assembleLanes({ catalogs: [ok(A)], byCatalog: new Map(), craftByCatalog: null }).craft).toBeNull();
  });

  it('craft map is keyed `${catalogId} ${step}` and equals craftForCell', () => {
    const views = new Map<string, CraftVerdictView[]>();
    const r = assembleLanes({ catalogs: [ok(A)], byCatalog: new Map(), craftByCatalog: views });
    expect(r.craft).toBeInstanceOf(Map);
    const spec = allCatalogPipelines().find((p) => p.catalogId === A)!;
    for (const s of spec.steps) {
      const expected = craftForCell(A, s.label, [], new Map());
      expect(r.craft!.get(`${A} ${s.label}`)).toEqual(expected ?? undefined);
    }
    void judgedContentOfRow;
  });
});

describe('ReadNotices', () => {
  it('renders the same PARTIAL wording for the same notice descriptors', () => {
    const notices = readNotices({ catalogs: [bad(B, 'E1')], verdicts: { ok: false, error: 'V' } });
    const { container } = render(createElement(ReadNotices, { notices, onRetryCatalog: () => {}, onRetryVerdicts: () => {} }));
    const text = [...container.querySelectorAll('[role="status"]')].map((e) => e.textContent ?? '');
    expect(text).toHaveLength(2);
    expect(text[0]).toContain('PARTIAL');
    expect(text[0]).toContain(B);
    expect(text[0]).toContain('E1');
    expect(text[1]).toContain('judge verdicts did not load');
  });
});
