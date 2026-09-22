// The wrapper store is the instrument the replication loop measures itself with. Its central
// promise: a MAPPING adjustment shows up as `reprojected`, an upstream change as `rawChanged`,
// and a re-run that changed nothing as `unchanged` — never "everything changed" because a
// timestamp moved.
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { wrapTable, mappingVersion } from '@/lib/catalog/reference/wrapper';
import { upsertWrappers, listWrappers, summarizeWrappers, listRuns } from '@/lib/catalog/reference/wrappers-db';
import { resolveLinks } from '@/lib/catalog/reference/links';
import { promoteWrappers, selectForPromotion } from '@/lib/catalog/reference/promote';
import { ingestSourceFromDir } from '@/lib/catalog/reference/ingestSource';
import { DIABLO1, type ReferenceSource } from '@/lib/catalog/reference/sources';
import { censusColumn } from '@/lib/catalog/reference/census';
import { contentHash, stableStringify } from '@/lib/catalog/reference/hash';
import { dropped, mapped } from '@/lib/catalog/ingest/fieldMap';
import { dropValues } from '@/lib/catalog/ingest/decode';
import { Skull } from 'lucide-react';

const spellSpec = DIABLO1.tables.find((t) => t.catalogId === 'spellbook')!;
const itemSpec = DIABLO1.tables.find((t) => t.catalogId === 'items')!;
const tsv = (cols: string[], rows: Record<string, string>[]) =>
  [cols.join('\t'), ...rows.map((r) => cols.map((c) => r[c] ?? '').join('\t'))].join('\n');
const SPELL_COLS = Object.keys(spellSpec.map);
const ITEM_COLS = Object.keys(itemSpec.map);
const SPELLS = tsv(SPELL_COLS, [{ id: 'Firebolt', name: 'Firebolt', manaCost: '6', flags: 'Fire,Targeted' }, { id: 'Fireball', name: 'Fireball', manaCost: '16' }]);
const ITEMS = tsv(ITEM_COLS, [{ id: 'IDI_SORC', name: 'Short Staff', spell: 'Firebolt' }, { name: 'Club', spell: 'Null' }, { name: 'Staff of X', spell: 'Nova' }]);

let db: Database.Database;
beforeEach(() => { db = new Database(':memory:'); });

describe('hash', () => {
  it('stableStringify is key-order independent', () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(stableStringify({ a: { c: 3, d: 2 }, b: 1 }));
    expect(contentHash({ b: 1, a: 2 })).toBe(contentHash({ a: 2, b: 1 }));
  });

  it('a decoder change moves the mapping version (decoders are data)', () => {
    expect(mappingVersion({ spell: mapped('links[role=ability]') }))
      .not.toBe(mappingVersion({ spell: mapped('links[role=ability]', dropValues('Null')) }));
  });
});

describe('census', () => {
  it('flags sentinels, lists and numerics from the cells, not the header', () => {
    const rows = [{ c: 'Null' }, { c: 'Null' }, { c: 'Fireball' }, { c: '' }];
    const c = censusColumn(rows, 'c');
    expect(c).toMatchObject({ blank: 1, distinct: 2, numeric: false });
    expect(c.sentinels).toEqual([{ value: 'Null', count: 2 }]);
    expect(censusColumn([{ f: 'Fire,Targeted' }], 'f').listLike).toBe(1);
    expect(censusColumn([{ n: '-1' }, { n: '5' }], 'n').numeric).toBe(true);
  });
});

describe('wrapTable', () => {
  it('pairs every raw record with its projection and stamps technique + mapping version', () => {
    const r = wrapTable(DIABLO1, spellSpec, SPELLS, 't0');
    expect(r.wrappers).toHaveLength(2);
    const w = r.wrappers[0];
    expect(w).toMatchObject({ wrapperId: 'diablo1:spells/spelldat.tsv:Firebolt', technique: 'tsv@1', keyKind: 'column', catalogId: 'spellbook' });
    expect(w.raw.manaCost).toBe('6');
    expect(w.entity.id).toBe('d1-Firebolt');
    expect(w.mappingVersion).toBe(mappingVersion(spellSpec.map));
  });

  it('gives a positional row its own wrapper id', () => {
    const r = wrapTable(DIABLO1, itemSpec, ITEMS, 't0');
    expect(r.wrappers.map((w) => w.wrapperId)).toEqual([
      'diablo1:items/itemdat.tsv:IDI_SORC', 'diablo1:items/itemdat.tsv:row1', 'diablo1:items/itemdat.tsv:row2',
    ]);
    expect(r.wrappers[1].keyKind).toBe('positional');
  });
});

describe('resolveLinks', () => {
  it('rewrites a reference to a wrapped entity and reports one that names nothing', () => {
    const all = [...wrapTable(DIABLO1, spellSpec, SPELLS, 't0').wrappers, ...wrapTable(DIABLO1, itemSpec, ITEMS, 't0').wrappers];
    const { wrappers, report } = resolveLinks(all, 'd1');
    const staff = wrappers.find((w) => w.key === 'IDI_SORC')!;
    expect(staff.entity.links).toEqual([{ catalogId: 'spellbook', entityId: 'd1-Firebolt', role: 'ability' }]);
    expect(report.resolved).toBe(1);
    expect(report.unresolved).toEqual([{ wrapperId: 'diablo1:items/itemdat.tsv:row2', role: 'ability', catalogId: 'spellbook', ref: 'Nova' }]);
    // idempotent: resolving resolved wrappers changes nothing
    expect(resolveLinks(wrappers, 'd1').report).toEqual(report);
  });
});

describe('upsertWrappers — the adjustment instrument', () => {
  it('created → unchanged on an identical re-run, even though ingestedAt moved', () => {
    expect(upsertWrappers(db, wrapTable(DIABLO1, spellSpec, SPELLS, 't0').wrappers)).toEqual({ created: 2, rawChanged: 0, reprojected: 0, unchanged: 0 });
    expect(upsertWrappers(db, wrapTable(DIABLO1, spellSpec, SPELLS, 't1').wrappers)).toEqual({ created: 0, rawChanged: 0, reprojected: 0, unchanged: 2 });
  });

  it('a MAPPING change counts as reprojected; a raw change as rawChanged', () => {
    upsertWrappers(db, wrapTable(DIABLO1, spellSpec, SPELLS, 't0').wrappers);
    const adjusted = { ...spellSpec, map: { ...spellSpec.map, manaCost: dropped('test adjustment') } };
    expect(upsertWrappers(db, wrapTable(DIABLO1, adjusted, SPELLS, 't1').wrappers).reprojected).toBe(2);
    const moved = SPELLS.replace('\t6\t', '\t7\t');
    expect(upsertWrappers(db, wrapTable(DIABLO1, adjusted, moved, 't2').wrappers).rawChanged).toBe(1);
  });

  it('round-trips a wrapper and summarizes per table', () => {
    upsertWrappers(db, wrapTable(DIABLO1, itemSpec, ITEMS, 't0').wrappers);
    const back = listWrappers(db, { sourceId: 'diablo1', catalogId: 'items' });
    expect(back).toHaveLength(3);
    expect(back[0].raw.name).toBe('Short Staff');
    expect(summarizeWrappers(db, 'diablo1')).toEqual([{ catalogId: 'items', file: 'items/itemdat.tsv', wrappers: 3, positional: 2, mappingVersions: 1 }]);
  });
});

describe('promotion', () => {
  it('promotes only the selection, and refuses a payload JSON would hollow', () => {
    const ws = wrapTable(DIABLO1, spellSpec, SPELLS, 't0').wrappers;
    const written: string[] = [];
    const sel = selectForPromotion(ws, { entityIds: ['d1-Fireball'] });
    expect(promoteWrappers(sel, (r) => written.push(`${r.source}:${r.entityId}`)).promoted).toEqual(['d1-Fireball']);
    expect(written).toEqual(['ingest:d1-Fireball']);
    const poisoned = [{ ...ws[0], entity: { ...ws[0].entity, data: { icon: Skull } } }];
    const r = promoteWrappers(poisoned, () => { throw new Error('must not write'); });
    expect(r.refused).toEqual([{ entityId: 'd1-Firebolt', reason: 'payload would not survive JSON persistence', unsafeKeys: ['data.icon'] }]);
  });

  it('goes through the same door as a hand-made entity: a guarded id is refused with its reason', () => {
    const ws = wrapTable(DIABLO1, spellSpec, SPELLS, 't0').wrappers;
    const written: string[] = [];
    const r = promoteWrappers(ws, (rec) => written.push(rec.entityId), (_c, id) => (id === 'd1-Firebolt' ? 'is a code seed' : null));
    expect(written).toEqual(['d1-Fireball']);
    expect(r.refused).toEqual([{ entityId: 'd1-Firebolt', reason: 'is a code seed' }]);
  });
});

describe('ingestSourceFromDir', () => {
  it('ingests present tables, reports a missing one, resolves links, records the run', () => {
    const files: Record<string, string> = { 'spells/spelldat.tsv': SPELLS, 'items/itemdat.tsv': ITEMS };
    const readFile = (p: string) => {
      const hit = Object.keys(files).find((f) => p.replace(/\\/g, '/').endsWith(f));
      if (!hit) throw new Error('ENOENT');
      return files[hit];
    };
    const s = ingestSourceFromDir('diablo1', '/data', { db, readFile, now: 't0' });
    expect(s.tables.find((t) => t.catalogId === 'bestiary')!.status).toBe('missing');
    const items = s.tables.find((t) => t.catalogId === 'items')!;
    expect(items).toMatchObject({ status: 'ingested', rows: 3, positionalIds: 2 });
    // `spell`'s Null is dropped by its decoder, so it is NOT a finding; only undecoded ones are.
    expect(items.sentinelColumns).toEqual([]);
    expect(s.links.resolved).toBe(1);
    expect(s.store.created).toBe(5);
    expect(listRuns(db, 'diablo1')).toHaveLength(1);
  });

  it('refuses an unknown source instead of ingesting nothing quietly', () => {
    const unknown: Partial<ReferenceSource> = { id: 'nope' };
    expect(() => ingestSourceFromDir(unknown.id!, '/data', { db })).toThrow(/Unknown reference source/);
  });
});
