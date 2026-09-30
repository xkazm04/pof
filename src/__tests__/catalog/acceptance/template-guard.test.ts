/**
 * TEMPLATE guard — a stub produce body written for an entity other than its catalog's exemplar is
 * that exemplar's content with the name swapped in, so its would-be `pass` is held at `pending`
 * (the SOURCED pattern, one seam over). A `fail` stays `fail`; an unstamped artifact is untouched.
 */
import { describe, expect, it } from 'vitest';
import { templateGuard, TEMPLATE_FIELD, templateStampOf } from '@/lib/catalog/acceptance/template';
import { TEMPLATE_MARKER } from '@/lib/catalog/acceptance/markers';
import { SOURCED_FIELD } from '@/lib/catalog/acceptance/sourced';
import { registerCatalogPipeline, getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import type { AcceptanceResult, Checker } from '@/lib/catalog/acceptance/types';

const PASS: AcceptanceResult = { tier: 'L1', status: 'pass', label: 'Shape', detail: 'ok' };
const pass: Checker = () => PASS;
const STAMP = { exemplar: 'char-captain-vael', entity: 'char-other' };

describe('templateGuard', () => {
  it('holds a stamped would-be pass at pending with a TEMPLATE: reason naming the exemplar', () => {
    const r = templateGuard(pass)({ brief: 'x', [TEMPLATE_FIELD]: STAMP });
    expect(r.status).toBe('pending');
    expect(r.reason?.startsWith(`${TEMPLATE_MARKER}:`)).toBe(true);
    expect(r.reason?.startsWith('TEMPLATE:')).toBe(true);
    expect(r.reason).toContain('char-captain-vael');
  });

  it('[guard] leaves an unstamped pass exactly as the checker returned it', () => {
    const r = templateGuard(pass)({ brief: 'x' });
    expect(r).toBe(PASS);
  });

  it('keeps a stamped fail as fail with the checker\'s own reason', () => {
    const fail: Checker = () => ({ tier: 'L1', status: 'fail', label: 'Shape', detail: 'bad', reason: 'R' });
    const r = templateGuard(fail)({ brief: 'x', [TEMPLATE_FIELD]: STAMP });
    expect(r.status).toBe('fail');
    expect(r.reason).toBe('R');
  });

  it('ignores a malformed stamp (no exemplar string)', () => {
    expect(templateStampOf({ [TEMPLATE_FIELD]: { entity: 'x' } })).toBeNull();
    expect(templateGuard(pass)({ [TEMPLATE_FIELD]: 'char-captain-vael' }).status).toBe('pass');
  });

  it('carries the checker\'s symbol tags through the wrap', () => {
    const tag = Symbol('tag');
    const tagged: Checker = () => PASS;
    Object.defineProperty(tagged, tag, { value: 'kept', enumerable: false });
    expect((templateGuard(tagged) as unknown as Record<symbol, unknown>)[tag]).toBe('kept');
  });

  it('is composed at registration: a registered step holds a stamped pass, SOURCED still wins first', () => {
    registerCatalogPipeline({
      catalogId: 'template-guard-probe',
      steps: [{
        archetype: 'brief', label: 'Probe',
        view: { kind: 'prose', field: 'brief', emptyText: '' },
        produce: () => ({ data: { brief: 'x' } }),
        accept: pass,
      }],
    } as unknown as Parameters<typeof registerCatalogPipeline>[0]);
    const accept = getCatalogPipeline('template-guard-probe')!.steps[0].accept;
    expect(accept({ brief: 'x' }).status).toBe('pass');
    const held = accept({ brief: 'x', [TEMPLATE_FIELD]: STAMP });
    expect(held.status).toBe('pending');
    expect(held.reason?.startsWith('TEMPLATE:')).toBe(true);
    const both = accept({
      brief: 'x', [TEMPLATE_FIELD]: STAMP,
      [SOURCED_FIELD]: { sourceGame: 'G', sourceFile: 'f', sourceRow: 'r', columns: [] },
    });
    expect(both.status).toBe('pending');
    expect(both.reason?.startsWith('SOURCED:')).toBe(true);
  });
});
